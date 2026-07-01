import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import https from "node:https";
import { SignedXml } from "xml-crypto";
import forge from "node-forge";
import { queryClient } from "../db";

const execFileAsync = promisify(execFile);

type DocumentModel = "55" | "65";

type CompanyConfig = {
  legalName?: string | null;
  tradeName?: string | null;
  cnpj?: string | null;
  stateRegistration?: string | null;
  taxRegime?: string | null;
  taxEnvironment?: string | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  addressNeighborhood?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressZipcode?: string | null;
  addressCityCode?: string | null;
  phone?: string | null;
  email?: string | null;
  certificateAlias?: string | null;
  certificateEncrypted?: string | null;
  certificateUpdatedAt?: Date | string | null;
  certificateExpiresAt?: Date | string | null;
  fiscalApiProvider?: string | null;
  sefazAuthorizationUrl?: string | null;
  sefazReturnUrl?: string | null;
  sefazStatusUrl?: string | null;
  taxAuthorityCode?: string | null;
  cscId?: string | null;
  cscCode?: string | null;
};

type ClientConfig = {
  name?: string | null;
  document?: string | null;
  state?: string | null;
  city?: string | null;
};

type ItemConfig = {
  line: number;
  productCode: string;
  description: string;
  ncm: string;
  cfop: string;
  ean?: string | null;
  unit?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxOrigin?: string | null;
  cstIcms?: string | null;
  csosn?: string | null;
  cstPis?: string | null;
  cstCofins?: string | null;
  cstIpi?: string | null;
  icmsRate?: number | null;
  pisRate?: number | null;
  cofinsRate?: number | null;
  ipiRate?: number | null;
};

type BuildXmlParams = {
  invoiceNumber: string;
  series: string;
  emissionDateIso: string;
  operationNature: string;
  type: "NFe" | "NFC-e";
  environment: "homologacao" | "producao";
  company: CompanyConfig;
  client?: ClientConfig | null;
  items: ItemConfig[];
  totalAmount: number;
  paymentMethod?: string | null;
  additionalInfo?: string | null;
};

type CertificateBundle = {
  pfxBase64: string;
  passphrase: string;
  alias: string;
  certPem: string;
  keyPem: string;
  subject: string;
  expiresAt: string;
};

type TransmissionConfig = {
  certificate: { pfxBase64: string; passphrase: string };
  authorizationUrl: string;
  returnUrl: string;
};

type TransmissionResult = {
  success: boolean;
  status: "processing" | "authorized" | "rejected";
  receipt: string | null;
  protocol: string | null;
  statusCode: string | null;
  statusMessage: string | null;
  responseXml: string;
};

function onlyDigits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function formatDecimal(value: number, scale = 2) {
  return Number(value || 0).toFixed(scale);
}

function xmlEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function envCode(environment: string) {
  return environment === "producao" ? "1" : "2";
}

function modelCode(type: "NFe" | "NFC-e") {
  return type === "NFe" ? "55" : "65";
}

function stateCode(uf: string | null | undefined) {
  const map: Record<string, string> = {
    RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
    MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27", SE: "28", BA: "29",
    MG: "31", ES: "32", RJ: "33", SP: "35", PR: "41", SC: "42", RS: "43",
    MS: "50", MT: "51", GO: "52", DF: "53",
  };
  return map[String(uf || "").trim().toUpperCase()] || "00";
}

function mod11Nfe(base: string) {
  let weight = 2;
  let total = 0;
  for (let i = base.length - 1; i >= 0; i -= 1) {
    total += Number(base[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const remainder = total % 11;
  return remainder === 0 || remainder === 1 ? "0" : String(11 - remainder);
}

function randomNumeric(length: number) {
  return String(Math.floor(Math.random() * 10 ** length)).padStart(length, "0").slice(0, length);
}

function inferIndicadorIE(document: string) {
  return document.length === 14 ? "1" : "9";
}

function fiscalSecret() {
  const configured = process.env.FISCAL_SECRET?.trim() || process.env.JWT_SECRET?.trim();
  const isProduction = process.env.NODE_ENV === "production";
  if (configured) return configured;
  if (isProduction) throw new Error("FISCAL_SECRET ou JWT_SECRET é obrigatório em produção");
  return "allure-fiscal-local-secret";
}

function secretKey() {
  return createHash("sha256").update(fiscalSecret()).digest();
}

export function encryptFiscalPayload(payload: { pfxBase64: string; passphrase: string; alias: string }) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptFiscalPayload(value: string): { pfxBase64: string; passphrase: string; alias: string } {
  const raw = Buffer.from(value, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", secretKey(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  return JSON.parse(decrypted);
}

export function parseCertificateBundle(pfxBase64: string, passphrase: string, alias = "Certificado A1") {
  const p12Der = forge.util.decode64(pfxBase64);
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, passphrase);
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [];
  const cert = certBags[0]?.cert;
  const key = keyBags[0]?.key;
  if (!cert || !key) throw new Error("Certificado inválido ou sem chave privada utilizável.");
  const certPem = forge.pki.certificateToPem(cert);
  const keyPem = forge.pki.privateKeyToPem(key);
  const subject = cert.subject.attributes.map((item) => `${item.shortName || item.name}=${item.value}`).join(", ");
  const expiresAt = cert.validity.notAfter.toISOString();
  return { alias, certPem, keyPem, subject, expiresAt };
}

export function loadCertificateFromEncrypted(value: string): CertificateBundle {
  const payload = decryptFiscalPayload(value);
  const parsed = parseCertificateBundle(payload.pfxBase64, payload.passphrase, payload.alias);
  return { ...payload, ...parsed };
}

export async function reserveNextInvoiceNumber(companyId: string) {
  const rows = await queryClient<{ reserved: number }[]>`
    UPDATE company_settings
    SET next_invoice_number = next_invoice_number + 1,
        updated_at = now()
    WHERE id = ${companyId}
    RETURNING next_invoice_number - 1 AS reserved
  `;
  const reserved = rows[0]?.reserved;
  if (!reserved) throw new Error("Não foi possível reservar a numeração fiscal da empresa.");
  return String(reserved);
}

export async function validatePfxWithOpenSsl(pfxBase64: string, passphrase: string) {
  const base = join(tmpdir(), `allure-cert-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const pfxPath = `${base}.pfx`;
  await fs.writeFile(pfxPath, Buffer.from(pfxBase64, "base64"));
  try {
    await execFileAsync("openssl", ["pkcs12", "-in", pfxPath, "-passin", `pass:${passphrase}`, "-nokeys", "-clcerts"]);
  } finally {
    await fs.rm(pfxPath, { force: true });
  }
}

export function buildNfeXml(params: BuildXmlParams) {
  const cUF = stateCode(params.company.addressState || null);
  const cNF = randomNumeric(8);
  const dhEmi = params.emissionDateIso;
  const yearMonth = dhEmi.slice(2, 4) + dhEmi.slice(5, 7);
  const cnpj = onlyDigits(params.company.cnpj);
  const model = modelCode(params.type);
  const serie = String(params.series || "1").padStart(3, "0");
  const nNF = String(params.invoiceNumber).padStart(9, "0");
  const tpEmis = "1";
  const baseKey = `${cUF}${yearMonth}${cnpj}${model}${serie}${nNF}${tpEmis}${cNF}`;
  const cDV = mod11Nfe(baseKey);
  const accessKey = `${baseKey}${cDV}`;
  const idDest = params.client?.state && String(params.client.state).toUpperCase() !== String(params.company.addressState || "").toUpperCase() ? "2" : "1";
  const indFinal = params.client?.document ? (onlyDigits(params.client.document).length === 11 ? "1" : "0") : "1";
  const indPres = params.type === "NFC-e" ? "1" : "9";
  const crt = String(params.company.taxRegime || "1");
  const vProd = params.items.reduce((acc, item) => acc + Number(item.totalPrice || 0), 0);
  const vBC = params.items.reduce((acc, item) => acc + Number(item.totalPrice || 0), 0);
  const vICMS = params.items.reduce((acc, item) => acc + (Number(item.totalPrice || 0) * Number(item.icmsRate || 0)) / 100, 0);
  const vPIS = params.items.reduce((acc, item) => acc + (Number(item.totalPrice || 0) * Number(item.pisRate || 0)) / 100, 0);
  const vCOFINS = params.items.reduce((acc, item) => acc + (Number(item.totalPrice || 0) * Number(item.cofinsRate || 0)) / 100, 0);
  const homText = params.environment === "homologacao" ? "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL" : "";

  const detXml = params.items.map((item) => {
    const origin = String(item.taxOrigin || "0");
    const csosn = item.csosn ? String(item.csosn) : null;
    const cstIcms = item.cstIcms ? String(item.cstIcms) : null;
    const qCom = Number(item.quantity || 0);
    const vUnCom = Number(item.unitPrice || 0);
    const vProdItem = Number(item.totalPrice || 0);
    const icmsXml = csosn
      ? `<ICMSSN102><orig>${origin}</orig><CSOSN>${xmlEscape(csosn)}</CSOSN></ICMSSN102>`
      : `<ICMS00><orig>${origin}</orig><CST>${xmlEscape(cstIcms || "00")}</CST><modBC>3</modBC><vBC>${formatDecimal(vProdItem)}</vBC><pICMS>${formatDecimal(Number(item.icmsRate || 0))}</pICMS><vICMS>${formatDecimal((vProdItem * Number(item.icmsRate || 0)) / 100)}</vICMS></ICMS00>`;
    const pisCst = item.cstPis || "99";
    const cofinsCst = item.cstCofins || "99";
    return `<det nItem="${item.line}">
      <prod>
        <cProd>${xmlEscape(item.productCode)}</cProd>
        <cEAN>${xmlEscape(onlyDigits(item.ean) || "SEM GTIN")}</cEAN>
        <xProd>${xmlEscape(item.description)}</xProd>
        <NCM>${xmlEscape(item.ncm)}</NCM>
        <CFOP>${xmlEscape(item.cfop)}</CFOP>
        <uCom>${xmlEscape(item.unit || "UN")}</uCom>
        <qCom>${formatDecimal(qCom, 4)}</qCom>
        <vUnCom>${formatDecimal(vUnCom, 10)}</vUnCom>
        <vProd>${formatDecimal(vProdItem)}</vProd>
        <cEANTrib>${xmlEscape(onlyDigits(item.ean) || "SEM GTIN")}</cEANTrib>
        <uTrib>${xmlEscape(item.unit || "UN")}</uTrib>
        <qTrib>${formatDecimal(qCom, 4)}</qTrib>
        <vUnTrib>${formatDecimal(vUnCom, 10)}</vUnTrib>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <ICMS>${icmsXml}</ICMS>
        <PIS><PISAliq><CST>${xmlEscape(pisCst)}</CST><vBC>${formatDecimal(vProdItem)}</vBC><pPIS>${formatDecimal(Number(item.pisRate || 0))}</pPIS><vPIS>${formatDecimal((vProdItem * Number(item.pisRate || 0)) / 100)}</vPIS></PISAliq></PIS>
        <COFINS><COFINSAliq><CST>${xmlEscape(cofinsCst)}</CST><vBC>${formatDecimal(vProdItem)}</vBC><pCOFINS>${formatDecimal(Number(item.cofinsRate || 0))}</pCOFINS><vCOFINS>${formatDecimal((vProdItem * Number(item.cofinsRate || 0)) / 100)}</vCOFINS></COFINSAliq></COFINS>
      </imposto>
    </det>`;
  }).join("\n");

  const destDocument = onlyDigits(params.client?.document);
  const destDocTag = destDocument.length === 14
    ? `<CNPJ>${destDocument}</CNPJ>`
    : destDocument.length === 11
      ? `<CPF>${destDocument}</CPF>`
      : "";
  const indIEDest = inferIndicadorIE(destDocument);
  const destXml = `<dest>${destDocTag}<xNome>${xmlEscape(params.client?.name || "CONSUMIDOR FINAL")}</xNome><indIEDest>${indIEDest}</indIEDest></dest>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe versao="4.00" Id="NFe${accessKey}">
    <ide>
      <cUF>${cUF}</cUF>
      <cNF>${cNF}</cNF>
      <natOp>${xmlEscape(params.operationNature)}</natOp>
      <mod>${model}</mod>
      <serie>${Number(params.series || "1")}</serie>
      <nNF>${Number(params.invoiceNumber)}</nNF>
      <dhEmi>${xmlEscape(dhEmi)}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>${idDest}</idDest>
      <cMunFG>${xmlEscape(params.company.addressCityCode || "")}</cMunFG>
      <tpImp>${params.type === "NFC-e" ? "4" : "1"}</tpImp>
      <tpEmis>${tpEmis}</tpEmis>
      <cDV>${cDV}</cDV>
      <tpAmb>${envCode(params.environment)}</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>${indFinal}</indFinal>
      <indPres>${indPres}</indPres>
      <procEmi>0</procEmi>
      <verProc>AllureERP-1.0</verProc>
    </ide>
    <emit>
      <CNPJ>${cnpj}</CNPJ>
      <xNome>${xmlEscape(params.company.legalName || params.company.tradeName || "")}</xNome>
      <xFant>${xmlEscape(params.company.tradeName || params.company.legalName || "")}</xFant>
      <enderEmit>
        <xLgr>${xmlEscape(params.company.addressStreet || "")}</xLgr>
        <nro>${xmlEscape(params.company.addressNumber || "S/N")}</nro>
        <xCpl>${xmlEscape(params.company.addressComplement || "")}</xCpl>
        <xBairro>${xmlEscape(params.company.addressNeighborhood || "CENTRO")}</xBairro>
        <cMun>${xmlEscape(params.company.addressCityCode || "")}</cMun>
        <xMun>${xmlEscape(params.company.addressCity || "")}</xMun>
        <UF>${xmlEscape(params.company.addressState || "")}</UF>
        <CEP>${xmlEscape(onlyDigits(params.company.addressZipcode || ""))}</CEP>
        <cPais>1058</cPais>
        <xPais>BRASIL</xPais>
        <fone>${xmlEscape(onlyDigits(params.company.phone || ""))}</fone>
      </enderEmit>
      <IE>${xmlEscape(onlyDigits(params.company.stateRegistration || "ISENTO"))}</IE>
      <CRT>${xmlEscape(crt)}</CRT>
    </emit>
    ${destXml}
    ${detXml}
    <total>
      <ICMSTot>
        <vBC>${formatDecimal(vBC)}</vBC>
        <vICMS>${formatDecimal(vICMS)}</vICMS>
        <vICMSDeson>0.00</vICMSDeson>
        <vFCP>0.00</vFCP>
        <vBCST>0.00</vBCST>
        <vST>0.00</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTRet>0.00</vFCPSTRet>
        <vProd>${formatDecimal(vProd)}</vProd>
        <vFrete>0.00</vFrete>
        <vSeg>0.00</vSeg>
        <vDesc>0.00</vDesc>
        <vII>0.00</vII>
        <vIPI>0.00</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>${formatDecimal(vPIS)}</vPIS>
        <vCOFINS>${formatDecimal(vCOFINS)}</vCOFINS>
        <vOutro>0.00</vOutro>
        <vNF>${formatDecimal(params.totalAmount)}</vNF>
      </ICMSTot>
    </total>
    <transp><modFrete>9</modFrete></transp>
    <pag><detPag><indPag>0</indPag><tPag>${params.paymentMethod === "pix" ? "17" : params.paymentMethod === "credit_card" ? "03" : params.paymentMethod === "debit_card" ? "04" : "01"}</tPag><vPag>${formatDecimal(params.totalAmount)}</vPag></detPag></pag>
    <infAdic><infCpl>${xmlEscape([homText, params.additionalInfo].filter(Boolean).join(" | "))}</infCpl></infAdic>
  </infNFe>
</NFe>`;

  return { xml, accessKey, modelCode: model as DocumentModel };
}

export function signXml(xml: string, certPem: string, keyPem: string) {
  const sig = new SignedXml({ privateKey: keyPem, publicCert: certPem });
  sig.canonicalizationAlgorithm = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
  sig.signatureAlgorithm = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
  sig.addReference({
    xpath: "//*[local-name()='infNFe']",
    digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    ],
  });
  (sig as any).keyInfoProvider = {
    getKeyInfo: () => `<X509Data><X509Certificate>${certPem.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\r|\n/g, "")}</X509Certificate></X509Data>`,
    getKey: () => keyPem,
  } as any;
  sig.computeSignature(xml, { location: { reference: "//*[local-name()='infNFe']", action: "after" } });
  return sig.getSignedXml();
}

function wrapSoap(body: string) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>${body}</soap12:Body>
</soap12:Envelope>`;
}

function extractTag(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "i"));
  return match ? match[1].trim() : null;
}

async function postSoap(url: string, soapBody: string, certificate: { pfxBase64: string; passphrase: string }) {
  const endpoint = new URL(url);
  const payload = Buffer.from(soapBody, "utf8");
  return new Promise<string>((resolve, reject) => {
    const req = https.request(
      {
        protocol: endpoint.protocol,
        hostname: endpoint.hostname,
        port: endpoint.port ? Number(endpoint.port) : 443,
        path: `${endpoint.pathname}${endpoint.search}`,
        method: "POST",
        pfx: Buffer.from(certificate.pfxBase64, "base64"),
        passphrase: certificate.passphrase,
        headers: {
          "Content-Type": "application/soap+xml; charset=utf-8",
          "Content-Length": payload.length,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => {
          const response = Buffer.concat(chunks).toString("utf8");
          if ((res.statusCode || 500) >= 400) {
            reject(new Error(`SEFAZ retornou HTTP ${res.statusCode}: ${response.slice(0, 500)}`));
            return;
          }
          resolve(response);
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

export async function transmitSignedNfe(params: { signedXml: string; accessKey: string; modelCode: DocumentModel; config: TransmissionConfig }) {
  const loteId = randomNumeric(15);
  const envioXml = `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>${loteId}</idLote><indSinc>0</indSinc>${params.signedXml}</enviNFe>`;
  const soap = wrapSoap(`<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">${envioXml}</nfeDadosMsg>`);
  const authorizationResponse = await postSoap(params.config.authorizationUrl, soap, params.config.certificate);
  const cStat = extractTag(authorizationResponse, "cStat");
  const xMotivo = extractTag(authorizationResponse, "xMotivo");
  const nRec = extractTag(authorizationResponse, "nRec");
  if (cStat === "104") {
    return {
      success: true,
      status: extractTag(authorizationResponse, "protNFe") ? "authorized" : "rejected",
      receipt: extractTag(authorizationResponse, "nRec"),
      protocol: extractTag(authorizationResponse, "nProt"),
      statusCode: extractTag(authorizationResponse, "cStat"),
      statusMessage: extractTag(authorizationResponse, "xMotivo"),
      responseXml: authorizationResponse,
    } satisfies TransmissionResult;
  }
  if (!nRec) {
    return {
      success: false,
      status: "rejected",
      receipt: null,
      protocol: null,
      statusCode: cStat,
      statusMessage: xMotivo,
      responseXml: authorizationResponse,
    } satisfies TransmissionResult;
  }
  return {
    success: true,
    status: "processing",
    receipt: nRec,
    protocol: null,
    statusCode: cStat,
    statusMessage: xMotivo,
    responseXml: authorizationResponse,
  } satisfies TransmissionResult;
}

export async function queryNfeReceipt(params: { receipt: string; config: TransmissionConfig }) {
  const xml = `<consReciNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>2</tpAmb><nRec>${xmlEscape(params.receipt)}</nRec></consReciNFe>`;
  const soap = wrapSoap(`<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4">${xml}</nfeDadosMsg>`);
  const responseXml = await postSoap(params.config.returnUrl, soap, params.config.certificate);
  const cStat = extractTag(responseXml, "cStat");
  const xMotivo = extractTag(responseXml, "xMotivo");
  const protocol = extractTag(responseXml, "nProt");
  return {
    success: cStat === "100" || cStat === "104",
    status: cStat === "100" ? "authorized" : cStat === "105" ? "processing" : "rejected",
    receipt: extractTag(responseXml, "nRec"),
    protocol,
    statusCode: cStat,
    statusMessage: xMotivo,
    responseXml,
  } satisfies TransmissionResult;
}

export function resolveTransmissionConfig(company: CompanyConfig): TransmissionConfig {
  if (!company.certificateEncrypted) throw new Error("Certificado digital não cadastrado.");
  if (!company.sefazAuthorizationUrl || !company.sefazReturnUrl) {
    throw new Error("Endpoints da SEFAZ não configurados. Informe URLs de autorização e retorno para homologação/produção.");
  }
  const cert = decryptFiscalPayload(company.certificateEncrypted);
  return {
    certificate: { pfxBase64: cert.pfxBase64, passphrase: cert.passphrase },
    authorizationUrl: String(company.sefazAuthorizationUrl),
    returnUrl: String(company.sefazReturnUrl),
  };
}
