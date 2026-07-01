# Módulo Fiscal Allure ERP — Atualização aplicada

## Reforço estrutural implementado nesta rodada

Além da preparação inicial do módulo fiscal, agora o sistema passou a ter também:

- **motor de decisão automática** para resolver a operação fiscal sem depender de escolha manual do usuário na venda;
- **validação fiscal em níveis**:
  - `warning` = avisa, mas não necessariamente bloqueia;
  - `error` = bloqueia emissão;
  - `critical` = impede cenários estruturalmente inválidos;
- **consistência automática de CFOP** com a natureza da operação;
- **fluxo de status da nota** com ciclo interno estruturado:
  - `pending`
  - `validated`
  - `sent`
  - `authorized`
  - `cancelled`
- **versionamento básico de regras fiscais** com:
  - `validFrom`
  - `validTo`
  - `ruleVersion`
- **prioridade e vigência de perfis de operação fiscal**;
- **auditoria fiscal** para criação/alteração de:
  - perfil fiscal da empresa;
  - regras fiscais por produto;
  - perfis de operação fiscal;
  - emissão/reprocessamento/cancelamento de documentos.

## O que o ERP agora garante automaticamente

### 1. Motor de decisão fiscal

O ERP resolve automaticamente, com base nos dados disponíveis:

- operação interna vs interestadual;
- contribuinte ICMS vs não contribuinte;
- consumidor final;
- perfil de operação fiscal compatível;
- CFOP por item conforme destino e tipo de operação.

O usuário **não precisa escolher manualmente CFOP** na emissão.

### 2. Validação anti-erro humano

Antes de avançar no fluxo fiscal, o sistema verifica pontos como:

- CNPJ do emitente;
- UF da empresa;
- regime tributário / CRT;
- certificado / provedor / CSC;
- UF do cliente quando aplicável;
- existência de regra fiscal do produto;
- NCM do produto;
- origem fiscal do produto;
- CST / CSOSN;
- CFOP por item;
- compatibilidade entre CFOP e tipo de operação.

### 3. Bloqueio inteligente

O sistema diferencia severidades:

- **warning**: pendência informativa
- **error**: não autoriza seguir a emissão
- **critical**: identifica falha estrutural grave

Quando houver falha bloqueante, a nota não segue para autorização interna.

### 4. Governança fiscal

Agora há suporte a:

- histórico de decisões fiscais da nota;
- reprocessamento da nota após ajuste das regras;
- cancelamento da nota no fluxo interno;
- rastreabilidade das mudanças fiscais.

## Estrutura fiscal preparada para o contador

O contador continua responsável por informar/preencher os dados oficiais, mas o ERP agora executa a lógica automaticamente com base nessas parametrizações.

Exemplos de dados que seguem dependendo do contador:

- CST / CSOSN corretos por operação
- CFOP definitivo por cenário
- NCM / CEST / origem fiscal corretos
- tabela IBPT utilizada
- certificado, CSC e provedor
- vigência de regras

## Validação executada

- `npm run typecheck` ✅
- `npm run build` ✅

## Arquivos principais reforçados nesta rodada

- `server/routes/fiscal.ts`
- `server/index.ts`
- `server/platform.ts`
- `drizzle/schema.ts`
- `shared/api.ts`

## Nova camada de integração aplicada nesta rodada

Além do motor fiscal, o sistema agora passou a ter também a base real de integração para **NF-e/NFC-e em homologação**:

- **upload seguro de certificado A1 (.pfx)** no backend;
- **criptografia do certificado em repouso** antes de salvar no banco;
- **validação do PFX** antes do cadastro;
- **montagem do XML NF-e/NFC-e** com chave de acesso e estrutura fiscal base;
- **assinatura digital do XML** com certificado ICP-Brasil;
- **transmissão SOAP para SEFAZ** usando certificado do emitente;
- **consulta de retorno por recibo** para atualizar o status da nota;
- **persistência de XML assinado, recibo, protocolo e retorno da SEFAZ**;
- **novos estados operacionais** para a nota:
  - `validated`
  - `signed`
  - `processing`
  - `authorized`
  - `rejected`
  - `cancelled`

## O que ficou realmente pronto

### 1. Certificado digital

O ERP agora consegue:

- receber `PFX` em base64 + senha;
- validar o certificado;
- extrair metadados do certificado;
- guardar o conteúdo **criptografado**;
- usar o certificado na assinatura do XML e na conexão HTTPS com a SEFAZ.

### 2. Fluxo de transmissão

Agora existe fluxo técnico completo para NF-e/NFC-e:

1. validar fiscalmente;
2. gerar XML;
3. assinar XML;
4. enviar para SEFAZ;
5. gravar recibo;
6. consultar retorno;
7. atualizar status com autorização/rejeição.

### 3. Endpoints novos no backend

- `POST /api/v1/fiscal/certificate`
- `GET /api/v1/fiscal/certificate`
- `POST /api/v1/fiscal/invoices/:id/transmit`
- `POST /api/v1/fiscal/invoices/:id/sync`

### 4. Campos adicionais persistidos

No banco agora passam a ser persistidos também:

- certificado criptografado e seus metadados;
- URLs da SEFAZ configuradas por ambiente/UF;
- XML assinado;
- código e mensagem de retorno da SEFAZ;
- XML bruto de resposta;
- timestamp da última sincronização com a SEFAZ.

## Limite importante desta entrega

Para ser correto juridicamente e tecnicamente, eu deixei explícito no sistema que:

- **NF-e/NFC-e**: integração técnica pronta para homologação, dependendo apenas de **certificado válido** e **endpoints corretos da UF/ambiente**;
- **NFS-e**: **não** foi automatizada nesta rodada, porque depende do padrão e do webservice específico de cada município.

## Resultado prático

O módulo fiscal agora não para mais no “motor de decisão”. Ele já está preparado para operar como ponte real com o governo na camada de **assinatura, transmissão, recibo e retorno** — com honestidade técnica sobre o que ainda depende de credenciais reais e parametrização oficial de SEFAZ/município.
