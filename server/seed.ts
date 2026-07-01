import { randomUUID } from "node:crypto";
import { db } from "./db";
import { clients, companySettings, fiscalCompanyProfiles, fiscalOperationProfiles, products, suppliers, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "./auth";
import { ensureEnterpriseInfrastructure } from "./platform";
import { seedProductsIfood } from "./seed-products-ifood";
import { ACCOUNTANT_DEFAULT_PERMISSIONS, SELLER_DEFAULT_PERMISSIONS } from "./permissions";

async function seedCompany() {
  const [existingCompany] = await db.select().from(companySettings).limit(1);
  if (existingCompany) return existingCompany;

  const [created] = await db
    .insert(companySettings)
    .values({
      id: randomUUID(),
      tenantCode: "allure-demo",
      tenantStatus: "active",
      legalName: "Allure Comércio e Gestão LTDA",
      tradeName: "Allure ERP",
      cnpj: "00000000000100",
      stateRegistration: "ISENTO",
      municipalRegistration: "123456",
      taxRegime: "Simples Nacional",
      taxEnvironment: "homologacao",
      fiscalApiProvider: "Integração futura",
      invoiceSeries: "1",
      nextInvoiceNumber: 1,
      cashbackEnabled: true,
      cashbackPercent: "7.50",
      cashbackExpiryDays: 45,
      email: "contato@allureerp.local",
      phone: "(11) 99999-9999",
      addressCity: "São Paulo",
      addressState: "SP",
      blockSaleWithoutStock: true,
      autoInvoiceOnSale: false,
      defaultSellerName: "Administrador",
    })
    .returning();

  return created;
}

async function seedUsers(companyId: string) {
  const defaultUsers = [
    { email: "admin@completefitness.com.br", name: "Administrador", role: "admin", permissions: ["*"] },
    { email: "contador@completefitness.com.br", name: "Contador", role: "contador", permissions: ACCOUNTANT_DEFAULT_PERMISSIONS },
    { email: "vendedor@completefitness.com.br", name: "Ana Paula - Vendas", role: "vendedor", permissions: SELLER_DEFAULT_PERMISSIONS },
  ];

  for (const user of defaultUsers) {
    const [existing] = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
    if (!existing) {
      await db.insert(users).values({
        id: randomUUID(),
        companyId,
        name: user.name,
        email: user.email,
        passwordHash: await hashPassword("password123"),
        role: user.role,
        permissionsJson: JSON.stringify(user.permissions),
        isActive: true,
      });
    }
  }
}

async function seedFiscal(companyId: string) {
  const [existingProfile] = await db.select().from(fiscalCompanyProfiles).where(eq(fiscalCompanyProfiles.companyId, companyId)).limit(1);
  if (!existingProfile) {
    await db.insert(fiscalCompanyProfiles).values({
      id: randomUUID(),
      companyId,
      crtCode: "1",
      nfseEnvironment: "homologacao",
      nfseSeries: "1",
      additionalInfo: "Base fiscal pronta para receber parametrização real do contador.",
    });
  }

  const existingOps = await db.select().from(fiscalOperationProfiles).where(eq(fiscalOperationProfiles.companyId, companyId));
  if (existingOps.length === 0) {
    await db.insert(fiscalOperationProfiles).values([
      {
        id: randomUUID(),
        companyId,
        name: "Venda varejo consumidor final",
        documentModel: "NFC-e",
        direction: "saida",
        destination: "interna",
        finalConsumer: true,
        taxpayerType: "nao_contribuinte",
        purpose: "normal",
        presenca: "1",
        cfop: "5102",
        operationNature: "Venda de mercadoria",
        isDefault: true,
        isActive: true,
      },
      {
        id: randomUUID(),
        companyId,
        name: "Venda interestadual consumidor final",
        documentModel: "NFe",
        direction: "saida",
        destination: "interestadual",
        finalConsumer: true,
        taxpayerType: "nao_contribuinte",
        purpose: "normal",
        presenca: "2",
        cfop: "6108",
        operationNature: "Venda interestadual para consumidor final",
        isDefault: false,
        isActive: true,
      },
    ]);
  }
}

async function seedSuppliers(companyId: string) {
  const existing = await db.select().from(suppliers).limit(1);
  if (existing.length > 0) return existing[0];

  const [supplier] = await db
    .insert(suppliers)
    .values({
      id: randomUUID(),
      companyId,
      legalName: "Fornecedor Premium Têxtil LTDA",
      tradeName: "Premium Têxtil",
      document: "12345678000190",
      email: "comercial@premiumtextil.local",
      phone: "(11) 4002-9000",
      contactName: "Carla Souza",
      category: "Confecção",
      notes: "Fornecedor homologado para linha principal.",
      isActive: true,
    })
    .returning();

  return supplier;
}

async function seedClients(companyId: string) {
  const existing = await db.select().from(clients).limit(1);
  if (existing.length > 0) return;

  await db.insert(clients).values([
    {
      id: randomUUID(),
      companyId,
      name: "Marina Alves",
      document: "12345678901",
      email: "marina@cliente.local",
      phone: "(11) 98888-0001",
      city: "São Paulo",
      state: "SP",
      segment: "VIP",
      cashbackOptIn: true,
      isActive: true,
    },
    {
      id: randomUUID(),
      companyId,
      name: "Carlos Henrique",
      document: "98765432100",
      email: "carlos@cliente.local",
      phone: "(11) 97777-0002",
      city: "São Paulo",
      state: "SP",
      segment: "Atacado",
      cashbackOptIn: true,
      isActive: true,
    },
  ]);
}

async function seedProducts(companyId: string, supplierId?: string) {
  await db.delete(products).where(eq(products.companyId, companyId));

  await db.insert(products).values(
    seedProductsIfood.map((product) => ({
      id: randomUUID(),
      companyId,
      supplierId,
      code: String(product.code),
      name: String(product.name),
      category: String(product.category),
      size: String(product.size || "Único"),
      ncm: product.ncm || null,
      cost: String(product.cost),
      margin: String(product.margin),
      price: String(product.price),
      stock: Number(product.stock || 0),
      minStock: Number(product.minStock || 0),
      isActive: true,
    }))
  );
}

async function main() {
  await ensureEnterpriseInfrastructure();
  const company = await seedCompany();
  await seedUsers(company.id);
  await seedFiscal(company.id);
  const supplier = await seedSuppliers(company.id);
  await seedClients(company.id);
  await seedProducts(company.id, supplier?.id);
  console.log("Seed completed");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
