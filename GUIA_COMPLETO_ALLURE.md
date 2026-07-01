# Allure ERP — guia da versão atual

## Visão geral
O projeto **Allure ERP** está estruturado como um ERP moderno com:
- **Frontend** em React + TypeScript
- **Backend** em Node/Express
- **Banco** com Drizzle ORM sobre PostgreSQL
- **Arquitetura multiempresa** baseada em `company_id`

---

## O que cada área faz

### 1. Vendas e PDV
Arquivo principal:
- `client/pages/Vendas.tsx`
- `server/routes/sales.ts`

Função:
- registrar vendas
- vincular cliente
- aplicar desconto
- resgatar cashback
- escolher percentual de cashback no ato da venda
- atualizar estoque automaticamente
- gerar movimentação de estoque
- gerar receita financeira automática

Alterações feitas:
- adicionada configuração do percentual de cashback na própria venda
- adicionada auditoria de venda
- adicionado endpoint de contexto de venda para buscar a configuração da empresa

---

### 2. Compras e entrada de estoque
Arquivo principal:
- `client/pages/Estoque.tsx`
- `server/routes/purchases.ts`

Função:
- registrar compras
- escolher fornecedor
- lançar itens comprados
- atualizar estoque por entrada
- gerar conta a pagar automática
- registrar movimentação de estoque

Alterações feitas:
- busca de produtos em nova compra ficou ampla e pesquisável
- busca agora considera nome, código, categoria e tamanho
- layout da tela de compra foi afinado para ficar mais profissional
- campos visuais ficaram menores e mais compactos

---

### 3. Financeiro empresarial
Arquivo principal:
- `client/pages/Financeiro.tsx`
- `server/routes/financial.ts`

Função:
- contas a receber
- contas a pagar
- fluxo de caixa
- quitação de lançamentos
- vínculo com cliente e fornecedor

Alterações feitas:
- removida a aba de integrações do frontend porque o fluxo real usa dinheiro, pix e cartão direto na operação
- mantida a base financeira com AP/AR/caixa
- operações financeiras agora entram na auditoria

---

### 4. Fiscal e notas
Arquivo principal:
- `server/routes/fiscal.ts`
- `client/pages/Fiscal.tsx`
- `client/pages/Relatorios.tsx`

Função:
- emitir nota fiscal simplificada
- armazenar XML
- listar notas emitidas
- baixar XML
- baixar PDF

Alterações feitas:
- criado download de nota fiscal em **PDF**
- portal do contador agora consegue baixar **PDF** e **XML**
- portal do contador também consegue emitir nota a partir das vendas recentes

---

### 5. Portal do contador
Arquivo principal:
- `server/routes/accountant.ts`
- `client/pages/Relatorios.tsx`

Função:
- mostrar compras recentes
- mostrar vendas recentes
- mostrar documentos fiscais
- mostrar financeiro em aberto
- exportar dados fiscais organizados

Alterações feitas:
- portal foi ampliado para ficar operacional
- adicionado fluxo de emissão de nota a partir das vendas recentes
- adicionado download de PDF/XML por documento fiscal

---

### 6. Importação de dados
Arquivo principal:
- `server/routes/imports.ts`
- `client/pages/Relatorios.tsx`

Função:
- importar produtos
- importar clientes
- importar fornecedores
- importar estoque

Alterações feitas:
- importação agora aceita **JSON** e **CSV com cabeçalho**
- front-end ganhou parser para os dois formatos
- backend aplica criação/atualização real
- importação registra auditoria

---

### 7. Auditoria
Arquivo principal:
- `server/audit.ts`
- `server/routes/audit.ts`
- `client/pages/Relatorios.tsx`

Função:
- registrar eventos importantes do sistema
- permitir rastreabilidade operacional

O que a auditoria mostra:
- **Entidade**: qual módulo foi afetado
- **Ação**: o que aconteceu
- **Descrição**: resumo da operação
- **Detalhes**: dados extras úteis

Alterações feitas:
- auditoria melhorada visualmente
- adicionados textos explicativos para facilitar entendimento
- vendas, compras, importações, financeiro e pagamentos passaram a registrar logs

---

### 8. Configurações e conta vendedor
Arquivo principal:
- `client/pages/Configuracoes.tsx`
- `server/routes/settings.ts`
- `client/components/Layout.tsx`

Função:
- dados da empresa
- usuários
- cadastros
- impressão e scanner
- layout de etiquetas

Alterações feitas:
- vendedor ficou com acesso real à área de **Impressão e Scanner**
- impressão continua funcionando sem liberar partes administrativas
- permissões granulares passaram a controlar o menu e as rotas
- tabela de usuários recebeu edição de permissões granulares

---

## Permissões granulares
Arquivos principais:
- `server/auth.ts`
- `server/permissions.ts`
- `server/routes/users.ts`
- `client/pages/Configuracoes.tsx`

Função:
- controlar o acesso por ação e não só por perfil bruto

Exemplos de permissões:
- `sales.view`
- `sales.create`
- `products.view`
- `clients.view`
- `settings.labels.view`
- `settings.labels.print`
- `settings.labels.manage`
- `purchases.view`
- `financial.view`
- `reports.view`
- `fiscal.view`

---

## Estrutura principal do projeto

### Frontend
- `client/components/` → layout e componentes reutilizáveis
- `client/pages/` → telas do sistema
- `client/lib/api.ts` → cliente de API e sessão

### Backend
- `server/index.ts` → ponto central das rotas
- `server/auth.ts` → autenticação e autorização
- `server/platform.ts` → bootstrap de infraestrutura e colunas auxiliares
- `server/tenant.ts` → isolamento por empresa
- `server/audit.ts` → helper de logs
- `server/routes/` → rotas por módulo

### Banco / schema
- `drizzle/schema.ts` → definição das tabelas
- `drizzle/migrations/` → histórico de migrações

### Compartilhado
- `shared/api.ts` → tipos usados entre frontend e backend

---

## Resumo das correções mais recentes
1. Corrigida a busca de produtos em **nova compra** para aparecerem mais resultados relevantes.
2. Ajustado o layout de compra para um visual mais fino e profissional.
3. Removida a aba de integrações do financeiro no frontend.
4. Portal do contador passou a baixar nota fiscal em **PDF** e **XML**.
5. Importação passou a aceitar **CSV** e **JSON** com aplicação real.
6. Auditoria ficou mais compreensível e útil.
7. Conta vendedor em configurações foi estabilizada para uso focado em impressão.

---

## Arquivos mais impactados nesta fase
- `client/pages/Estoque.tsx`
- `client/pages/Financeiro.tsx`
- `client/pages/Relatorios.tsx`
- `client/pages/Vendas.tsx`
- `client/pages/Configuracoes.tsx`
- `client/components/Layout.tsx`
- `client/lib/api.ts`
- `server/routes/sales.ts`
- `server/routes/purchases.ts`
- `server/routes/financial.ts`
- `server/routes/fiscal.ts`
- `server/routes/imports.ts`
- `server/routes/accountant.ts`
- `server/routes/users.ts`
- `server/auth.ts`
- `server/platform.ts`
- `server/permissions.ts`
- `drizzle/schema.ts`

---

## Estado atual
A versão atual está com build validado e pronta para continuidade.
Os próximos passos naturais seriam:
- melhorar emissão fiscal com layout DANFE mais rico
- importar também via upload de arquivo CSV/XLSX
- criar tela dedicada do contador
- adicionar filtros avançados de auditoria
- conciliação financeira operacional
