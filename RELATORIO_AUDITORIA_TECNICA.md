# Relatório de Auditoria Técnica — Allure ERP

**Data da auditoria:** 2026-06-19  
**Escopo validado:** autenticação, multiempresa, vendas, dashboard, configurações, módulo fiscal, schema e fluxo de build/testes  
**Método:** revisão estática de código, leitura de rotas e schema, verificação de compilação (`tsc`), testes (`vitest`) e build de produção

## 1. Resumo executivo

O sistema está **compilando, testando e gerando build de produção com sucesso**, o que indica boa integridade estrutural no estado atual. A nova camada fiscal também mostra uma evolução importante: há separação entre parametrização tributária, assinatura de XML, transmissão SOAP e persistência de retorno da SEFAZ.

Mesmo assim, a auditoria encontrou **riscos funcionais e de segurança relevantes** que impedem considerar o sistema totalmente blindado para produção fiscal brasileira. Os principais pontos são:

1. **Emissão automática na venda gera nota “autorizada” fictícia**, sem assinatura nem SEFAZ.
2. **Campos críticos do backend fiscal não estão expostos na tela de configurações**, o que quebra a operação real em produção.
3. **Código de produto está com unicidade global**, causando conflito entre empresas diferentes.
4. **Concorrência no faturamento pode duplicar número de nota**.
5. **Segredo JWT possui fallback inseguro para desenvolvimento**, perigoso se chegar a produção.

## 2. Validações executadas

### 2.1 Compilação e testes

- `npm run typecheck` → **OK**
- `npm test` → **OK**
- `npm run build` → **OK**

### 2.2 Áreas auditadas

- `server/auth.ts`
- `server/tenant.ts`
- `server/routes/settings.ts`
- `server/routes/sales.ts`
- `server/routes/dashboard.ts`
- `server/routes/fiscal.ts`
- `client/pages/Configuracoes.tsx`
- `drizzle/schema.ts`

## 3. Achados críticos

## 3.1 Emissão automática na venda marca nota como autorizada sem SEFAZ

**Severidade:** Crítica  
**Arquivos:** `server/routes/sales.ts:233-256`

### Evidência
No fluxo `createSale`, quando `company.autoInvoiceOnSale` está ativo, o sistema cria uma nota diretamente com:

- `status: "emitted"`
- `fiscalStatus: "authorized"`
- `xmlContent` montado manualmente
- sem assinatura digital
- sem transmissão à SEFAZ
- sem protocolo de autorização

### Impacto
Isso cria uma **falsa sensação de conformidade fiscal**. Operacionalmente o ERP passa a tratar uma nota como autorizada, mas juridicamente ela **não existe perante a SEFAZ**.

### Risco real
- divergência entre ERP e Fisco
- falha em auditorias fiscais
- dificuldade de reconciliação
- possível uso indevido de DANFE/XML inválido

### Recomendação
Substituir esse fluxo por uma destas abordagens:

1. criar a nota com status `pending`/`validated`, e então chamar o mesmo pipeline fiscal real (`emitInvoice`/`signAndTransmitInvoice`);
2. ou desabilitar `autoInvoiceOnSale` até a integração completa ser invocada de forma síncrona/assíncrona segura.

> Esse é o principal bug funcional encontrado na auditoria.

## 3.2 Tela de Configurações não permite preencher todos os campos fiscais exigidos pelo backend

**Severidade:** Crítica  
**Arquivos:**
- `client/pages/Configuracoes.tsx:9-41`
- `client/pages/Configuracoes.tsx:618-623`
- `client/pages/Configuracoes.tsx:1258-1272`
- `server/routes/settings.ts:205-245`

### Evidência
O backend aceita e persiste campos críticos como:

- `taxAuthorityCode`
- `sefazAuthorizationUrl`
- `sefazReturnUrl`
- `sefazStatusUrl`
- `addressCityCode`

Mas o tipo `CompanySettingsApi`, o `CompanyForm` e a UI de `Configuracoes.tsx` **não expõem esses campos**. Como o `saveCompany` envia `JSON.stringify(company)`, esses dados não são naturalmente mantidos/operados pela interface principal.

### Impacto
A integração real com a SEFAZ fica **tecnicamente implementada no backend**, porém **operacionalmente incompleta no front**.

### Consequência prática
O usuário administrador pode acreditar que parametrizou o fiscal, mas o sistema continuará falhando em emissão real por falta de:

- endpoints da SEFAZ
- código IBGE do município
- código da UF/autoridade tributária

### Recomendação
Adicionar na tela de configurações:

- código IBGE do município (`addressCityCode`)
- código da UF/autorizador (`taxAuthorityCode`)
- endpoint autorização
- endpoint retorno/recibo
- endpoint status/consulta

Também sugerido: validar no frontend antes de permitir “produção”.

## 3.3 Código de produto está único globalmente e não por empresa

**Severidade:** Crítica  
**Arquivo:** `drizzle/schema.ts:163-167`

### Evidência
O índice está definido como:

- `uniqueIndex("products_code_idx").on(table.code)`

### Impacto
Em ambiente multiempresa, duas empresas diferentes **não conseguem usar o mesmo SKU/código interno**, o que viola o isolamento lógico esperado de tenant.

### Recomendação
Trocar para unicidade composta:

- `(company_id, code)`

Se o banco já estiver populado, preparar migração controlada com reindexação.

## 3.4 Número da nota pode colidir em concorrência

**Severidade:** Crítica  
**Arquivos:**
- `server/routes/fiscal.ts:277-281`
- `server/routes/sales.ts:233-255`

### Evidência
O `nextInvoiceNumber` é lido e incrementado em duas etapas lógicas, sem mecanismo explícito de lock pessimista ou sequência transacional dedicada.

### Impacto
Em carga real, duas emissões simultâneas podem consumir o mesmo número de documento.

### Recomendação
Usar uma das estratégias:

- sequence por empresa/modelo/série;
- update atômico com retorno do valor incrementado;
- lock transacional por registro da empresa antes de reservar o número.

## 4. Achados altos

## 4.1 Segredo JWT inseguro por fallback default

**Severidade:** Alta  
**Arquivo:** `server/auth.ts:9`

### Evidência
Existe fallback:

`process.env.JWT_SECRET || "dev-jwt-secret-change-me"`

### Impacto
Se a variável de ambiente faltar em produção, o sistema sobe com segredo previsível.

### Recomendação
Em produção, falhar o boot se `JWT_SECRET` não existir. O fallback deve existir apenas em ambiente explicitamente local.

## 4.2 Diagnóstico do dashboard não reflete os novos estados fiscais

**Severidade:** Alta  
**Arquivo:** `server/routes/dashboard.ts:33`

### Evidência
`pendingInvoiceRow` conta apenas `fiscalStatus = "pending_config"`, mas o módulo fiscal já trabalha com estados como:

- `critical`
- `error`
- `warning`
- `ready`
- `processing`

### Impacto
O dashboard pode mostrar zero pendências mesmo havendo notas travadas por erro fiscal.

### Recomendação
Revisar a régua de pendência fiscal do dashboard para incluir estados não autorizados e não concluídos.

## 4.3 Fluxo fiscal real e fluxo legado convivem com semântica conflitante

**Severidade:** Alta  
**Arquivos:**
- `server/routes/sales.ts:233-256`
- `server/routes/fiscal.ts:269-316`

### Evidência
O sistema possui dois modelos de emissão coexistindo:

1. fluxo novo: validação → XML → assinatura → transmissão → retorno SEFAZ;
2. fluxo legado: criação direta de invoice simplificada na venda.

### Impacto
O ERP pode gerar documentos com significados operacionais diferentes para a mesma entidade `invoices`.

### Recomendação
Unificar a semântica do ciclo de vida fiscal e impedir inserções “diretas” em `invoices` fora do serviço fiscal central.

## 5. Achados médios

## 5.1 Certificado criptografado está bem protegido, mas depende de governança de chave mestra

**Severidade:** Média  
**Contexto:** serviço fiscal

### Observação
A estratégia com AES-256-GCM para armazenar o PFX é correta, mas a segurança final depende totalmente da proteção da chave mestra em ambiente.

### Recomendação
- armazenar a master key apenas via secret manager/variável segura;
- rotação planejada de chave;
- política de backup com criptografia;
- trilha de auditoria para upload/substituição de certificado.

## 5.2 Usuário é único global por email

**Severidade:** Média  
**Arquivos:**
- `server/routes/users.ts:51-52`
- `server/routes/users.ts:94-102`

### Observação
O email está sendo tratado como único globalmente, não por empresa. Isso pode ser decisão de produto, mas restringe cenários onde o mesmo contador ou operador atua em múltiplos tenants.

### Recomendação
Definir a regra de negócio explicitamente:

- se o sistema for single-tenant por identidade global, manter;
- se quiser multiempresa compartilhada por pessoa, ajustar modelagem.

## 5.3 Status HTTP e semântica de retorno podem ser padronizados no fiscal

**Severidade:** Média  
**Arquivo:** `server/routes/fiscal.ts`

### Observação
O módulo fiscal está funcional, mas alguns retornos misturam estados de validação, negócio e transmissão. Isso dificulta automação do frontend.

### Recomendação
Padronizar payloads com:

- `phase`: `validation | signing | transmission | authorization | sync`
- `status`: `ok | warning | blocked | error`
- `retryable`: boolean

## 6. Pontos positivos confirmados

- O projeto está **compilando e buildando** sem erro.
- O teste automatizado existente está passando.
- Há **boa separação de responsabilidades** no módulo fiscal.
- O backend já persiste dados úteis de rastreabilidade fiscal:
  - XML assinado
  - recibo
  - protocolo
  - códigos SEFAZ
  - última sincronização
- O isolamento por `companyId` está presente na maior parte das rotas críticas auditadas.
- O upload de certificado faz validação prévia e registra metadados operacionais.
- O módulo fiscal registra eventos em auditoria, o que ajuda em governança.

## 7. Priorização recomendada

### Corrigir imediatamente

1. remover/fixar a autorização fictícia em `autoInvoiceOnSale`
2. expor os campos fiscais faltantes na UI de configurações
3. corrigir unicidade de `products.code` para escopo por empresa
4. blindar reserva de número fiscal contra concorrência
5. exigir `JWT_SECRET` válido em produção

### Corrigir na sequência

6. alinhar dashboard aos novos estados fiscais
7. unificar fluxo legado e fluxo fiscal real
8. revisar regra de unicidade de usuário por email
9. padronizar resposta do backend fiscal

## 8. Conclusão

O Allure ERP está em um estágio **tecnicamente promissor**, especialmente após a introdução do pipeline fiscal real. Contudo, ainda existem **gaps críticos de operação e confiabilidade** que impedem classificá-lo como totalmente pronto para produção fiscal brasileira sem correções adicionais.

A conclusão objetiva desta auditoria é:

- **estrutura geral:** boa
- **build/teste:** aprovados
- **módulo fiscal real:** bem encaminhado
- **prontidão para produção fiscal:** ainda parcial
- **itens bloqueantes principais:** emissão automática legada, lacunas de UI fiscal, concorrência de numeração e unicidade global de código de produto

## 9. Anexos de evidência

### Evidências de validação bem-sucedida
- `npm run typecheck` → sucesso
- `npm test` → sucesso
- `npm run build` → sucesso

### Trechos-chave auditados
- `server/routes/sales.ts:233-256`
- `client/pages/Configuracoes.tsx:9-41`
- `client/pages/Configuracoes.tsx:618-623`
- `client/pages/Configuracoes.tsx:1258-1272`
- `server/routes/settings.ts:205-245`
- `drizzle/schema.ts:163-167`
- `server/auth.ts:9`
- `server/routes/dashboard.ts:33`
