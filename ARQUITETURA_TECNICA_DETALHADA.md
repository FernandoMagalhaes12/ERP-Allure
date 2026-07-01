# Arquitetura técnica detalhada — Allure ERP

## 1. Visão de alto nível

O Allure ERP é uma aplicação **full-stack TypeScript** com frontend SPA em React e backend HTTP em Express, ambos convivendo no mesmo repositório.

A arquitetura está organizada em quatro camadas principais:

1. **Interface web** (`client/`)
2. **API e regras de aplicação** (`server/`)
3. **Modelo de dados e persistência** (`drizzle/` + `server/db.ts`)
4. **Contratos compartilhados** (`shared/`)

Essa separação é boa para um ERP porque deixa a interface relativamente desacoplada das regras de negócio, ao mesmo tempo em que mantém tipagem compartilhada entre cliente e servidor.

---

## 2. Estrutura do repositório

## 2.1 Pastas principais

- `client/` — frontend React
- `server/` — servidor Express e regras de aplicação
- `drizzle/` — schema e migrações do PostgreSQL
- `shared/` — tipos compartilhados entre frontend e backend
- `public/` — assets públicos
- `dist/` — artefatos gerados de build
- `scripts/` — utilitários e guard rails de manutenção

## 2.2 Organização funcional

### Frontend

- `client/App.tsx` — bootstrap do app, providers e rotas
- `client/pages/` — páginas por módulo
- `client/components/` — layout e componentes reutilizáveis
- `client/components/ui/` — componentes de base/UI
- `client/lib/` — utilidades e cliente de API

### Backend

- `server/index.ts` — composição do servidor e registro de rotas
- `server/node-build.ts` — entrada do build de produção do servidor
- `server/db.ts` — conexão com banco e instância do Drizzle
- `server/auth.ts` — autenticação e autorização
- `server/platform.ts` — bootstrap/ajustes de infraestrutura
- `server/tenant.ts` — resolução de empresa atual
- `server/audit.ts` — logging de auditoria
- `server/routes/*.ts` — endpoints por domínio

### Banco

- `drizzle/schema.ts` — definição das tabelas
- `drizzle/migrations/` — histórico de migrações
- `drizzle.config.ts` — configuração do Drizzle Kit

---

## 3. Stack e papel de cada tecnologia

## 3.1 Frontend

- **React 18** — UI baseada em componentes
- **React Router** — navegação SPA
- **TypeScript** — segurança de tipos
- **Tailwind CSS 3.4.x** — styling utilitário
- **Radix UI** — primitives acessíveis de interface
- **TanStack Query** — disponível no app, embora o uso atual seja discreto
- **Recharts** — gráficos do dashboard
- **JsBarcode** — geração de código de barras na área de etiquetas

## 3.2 Backend

- **Express 5** — camada HTTP da API
- **jsonwebtoken** — emissão/validação de sessão JWT
- **bcryptjs** — hash e verificação de senha
- **zod** — validação de payloads em partes da base

## 3.3 Persistência

- **PostgreSQL** — banco principal
- **postgres** — driver SQL
- **drizzle-orm** — mapeamento tipado
- **drizzle-kit** — geração/migração de schema

## 3.4 Build e execução

- **Vite** — build do cliente e também experiência integrada de desenvolvimento
- **Vite SSR build** — empacotamento do servidor para produção

---

## 4. Arquitetura de execução

## 4.1 Desenvolvimento

Em desenvolvimento, o projeto usa o `vite.config.ts` para subir o frontend e acoplar o Express como middleware no mesmo processo.

### Consequência prática

- frontend e backend compartilham a mesma porta em dev
- a experiência local fica mais simples
- reduz fricção para o time ao rodar `npm run dev`

Fluxo simplificado:

1. Vite sobe o ambiente web
2. `createServer()` é chamado
3. o Express é anexado aos middlewares do Vite
4. rotas `/api/*` passam a responder no mesmo servidor local

## 4.2 Produção

A build é dividida em duas saídas:

- `dist/spa` — artefatos do frontend
- `dist/server` — build do backend em ESM

Scripts:

- `npm run build` → build cliente + servidor
- `npm start` → executa `dist/server/node-build.mjs`

---

## 5. Arquitetura do frontend

## 5.1 Bootstrap da aplicação

`client/App.tsx` faz:

- import do CSS global
- montagem dos providers
- inicialização do React root
- registro das rotas
- proteção de páginas por autenticação/papel

Providers ativos:

- `QueryClientProvider`
- `TooltipProvider`
- `Toaster`
- `Sonner`

## 5.2 Roteamento

Rotas principais:

- `/login`
- `/dashboard`
- `/vendas`
- `/produtos`
- `/estoque`
- `/financeiro`
- `/fiscal`
- `/relatorios`
- `/configuracoes`

Há uma `ProtectedRoute` que:

1. tenta usar o usuário cacheado no `localStorage`
2. se necessário, chama `/api/v1/auth/me`
3. redireciona para login ou dashboard/vendas conforme o papel

## 5.3 Sessão no frontend

`client/lib/api.ts`:

- faz `fetch` com `credentials: include`
- salva o usuário autenticado no `localStorage`
- limpa a sessão local ao receber `401`

### Modelo adotado

A sessão real fica no cookie HTTP-only do backend, enquanto o frontend guarda um espelho do usuário para renderização imediata.

## 5.4 Layout e navegação

`client/components/Layout.tsx` define:

- sidebar desktop/mobile
- seções de menu
- visibilidade condicionada por papel e permissão
- cabeçalho e bloco de usuário autenticado

Esse layout concentra boa parte da ergonomia do ERP.

---

## 6. Arquitetura do backend

## 6.1 Composição do servidor

`server/index.ts`:

- cria a instância Express
- registra CORS e parsers
- define rotas públicas
- aplica `authenticate` ao namespace `/api/v1`
- registra rotas protegidas por papel/permissão
- adiciona handler global de erro

## 6.2 Organização por domínio

Rotas divididas por módulo:

- `auth.ts`
- `dashboard.ts`
- `products.ts`
- `clients.ts`
- `suppliers.ts`
- `sales.ts`
- `stock.ts`
- `financial.ts`
- `fiscal.ts`
- `settings.ts`
- `users.ts`
- `purchases.ts`
- `imports.ts`
- `accountant.ts`
- `audit.ts`
- `payments.ts`

Essa organização é adequada para ERP porque acompanha os domínios de negócio.

## 6.3 Autenticação e autorização

`server/auth.ts` implementa:

- geração de token JWT
- leitura do token por cookie ou Bearer token
- middleware `authenticate`
- middleware `authorize(...roles)`
- middleware `authorizePermission(...permissions)`

### Modelo de segurança

O backend combina:

- **papel** (`admin`, `vendedor`)
- **permissões granulares** (`sales.view`, `settings.labels.print`, etc.)

Isso é uma boa base para expansão do ERP sem depender só de perfis fixos.

## 6.4 Tenant / empresa atual

`server/tenant.ts` encapsula a leitura da empresa (`companyId`) do usuário autenticado.

A maior parte das consultas multiempresa depende disso para filtrar dados.

---

## 7. Camada de dados

## 7.1 Conexão

`server/db.ts`:

- lê `DATABASE_URL`
- cria `queryClient` com `postgres`
- instancia o `db` do Drizzle usando o schema

## 7.2 Schema principal

`drizzle/schema.ts` modela os domínios centrais:

- empresa/configurações
- usuários
- clientes
- fornecedores
- produtos
- vendas e itens de venda
- movimentações de estoque
- lançamentos financeiros
- notas fiscais

## 7.3 Entidades operacionais relevantes

### Empresa

`company_settings`

Responsável por:

- dados cadastrais
- parâmetros fiscais
- série e numeração fiscal
- regras de cashback
- PIX / integrações de pagamento
- configuração operacional da empresa

### Usuários

`users`

Campos estratégicos:

- `role`
- `permissions_json`
- `company_id`
- `is_active`

### Produtos

`products`

Campos relevantes:

- código
- categoria
- tamanho
- custo/margem/preço
- estoque/estoque mínimo
- atributos fiscais (`ean`, `ncm`, `cest`, etc.)

### Vendas

`sales` + `sale_items`

Capturam:

- operador
- cliente
- subtotal/desconto/total
- cashback gerado ou resgatado
- forma de pagamento
- itens vendidos

### Financeiro

`financial_entries`

Captura:

- receita ou despesa
- categoria
- status
- vencimento/pagamento
- origem do lançamento
- vínculo com cliente/fornecedor

### Fiscal

`invoices`

Armazena:

- número/série
- tipo (`NFe`, `NFC-e`)
- cliente
- valor
- status fiscal
- ambiente
- chave de acesso

---

## 8. Bootstrap de infraestrutura

`server/platform.ts` é uma peça importante da arquitetura atual.

Ele executa, ao subir a aplicação:

- `ALTER TABLE IF NOT EXISTS` em colunas antigas
- `CREATE TABLE IF NOT EXISTS` para entidades complementares
- preenchimento de `company_id` em registros legados
- criação de empresa padrão se a base estiver vazia
- injeção de permissões padrão em usuários existentes

### Leitura arquitetural

Isso funciona como uma camada híbrida entre:

- bootstrap operacional
- migração corretiva
- compatibilidade com bases antigas

### Vantagem

- acelera subida de ambientes legados

### Desvantagem

- mistura responsabilidade de infraestrutura com runtime da aplicação

---

## 9. Fluxos de negócio principais

## 9.1 Login

1. frontend envia credenciais para `/api/v1/auth/login`
2. backend valida email/senha
3. backend resolve permissões e empresa
4. backend gera JWT e grava cookie
5. frontend salva `user` no `localStorage`

## 9.2 Venda

1. usuário acessa contexto de venda
2. frontend monta carrinho
3. backend registra a venda
4. backend baixa estoque
5. backend registra movimento de estoque
6. backend cria efeito financeiro
7. backend pode registrar cashback/auditoria

## 9.3 Compra / entrada de estoque

1. usuário registra compra
2. backend grava compra/itens
3. estoque é incrementado
4. movimentações são registradas
5. financeiro pode receber conta a pagar

## 9.4 Emissão fiscal

1. usuário solicita emissão
2. backend cria/consulta documento fiscal
3. XML/PDF podem ser disponibilizados para download

## 9.5 Etiquetas / impressão

1. frontend carrega `label-settings`
2. usuário ajusta parâmetros de layout
3. preview é gerado localmente via canvas + JsBarcode
4. configurações são persistidas via API
5. há fluxo de teste de impressão

---

## 10. Contratos compartilhados

`shared/api.ts` é um ponto positivo importante.

Ele concentra interfaces como:

- `User`
- `Product`
- `Sale`
- `StockMovement`
- `FinancialEntry`
- `Invoice`
- `DashboardMetrics`
- `Purchase`

### Benefício arquitetural

Reduz divergência entre:

- shape retornado pela API
- shape esperado no frontend

Nos refinamentos aplicados, o uso desses tipos foi ampliado em pontos onde havia duplicação local.

---

## 11. Estilo e design system

O projeto usa:

- `tailwind.config.ts`
- `postcss.config.js`
- `client/global.css`
- `components.json`

A base visual segue um tema escuro com dourado/vinho, bem alinhado ao branding atual.

### Observação

A arquitetura de CSS está claramente montada para **Tailwind 3**, não para v4.

---

## 12. Build e entregáveis técnicos atuais

Validação realizada após refinamentos:

- `npm install` ✅
- `npm run typecheck` ✅
- `npm run build` ✅

Resultado importante:

- frontend gera bundle principal de aproximadamente **1.26 MB** minificado
- backend gera build em ESM com sourcemap

---

## 13. Pontos fortes da arquitetura

1. **Monorepo simples e legível**
2. **Boa separação entre cliente, servidor e schema**
3. **Domínios de negócio claramente mapeados**
4. **Permissões granulares já previstas**
5. **Tipagem compartilhada disponível**
6. **Modelo multiempresa já iniciado**
7. **Build de produção validada**

---

## 14. Limitações arquiteturais atuais

1. **Bootstrap estrutural em runtime**
2. **Cobertura de testes pouco madura e dependente de banco local**
3. **Bundle frontend grande**
4. **Parte fiscal ainda parece em estágio intermediário de maturidade**
5. **Documentação e configuração tinham pequenos desalinhamentos internos**

---

## 15. Resumo executivo da arquitetura

**Arquiteturalmente, o Allure ERP é um monorepo full-stack TypeScript com SPA React no cliente, API Express no servidor, PostgreSQL + Drizzle na persistência e um início consistente de domínio multiempresa, já adequado para operação real, mas ainda com espaço para endurecimento de infraestrutura, testes e performance.**
