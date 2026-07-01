# Atualização da fase atual do Allure ERP

## O que foi aplicado

### 1. Configurações do vendedor restritas
- A tela `Configurações` agora abre direto em **Impressão e Scanner** para usuário com perfil `vendedor`.
- As abas **Dados da Empresa**, **Usuários**, **Clientes e Fornecedores** e **Configurações do PDV** ficam ocultas para vendedor.
- Para vendedor, a tela também evita chamadas desnecessárias às rotas administrativas.

### 2. Base da nova fase de módulos criada
Foram adicionadas as estruturas iniciais para:
- **Compras** (`purchases` e `purchase_items`)
- **Auditoria operacional** (`audit_logs`)
- **Importação de dados** (preview/commit inicial)
- **Portal do contador** (summary inicial)

### 3. Novas rotas conectadas ao servidor
Rotas adicionadas e registradas em `server/index.ts`:
- `/api/v1/purchases`
- `/api/v1/audit`
- `/api/v1/imports`
- `/api/v1/accountant`

Todas foram conectadas com proteção administrativa no servidor principal.

### 4. Auditoria inicial funcionando
Foi criado o helper `server/audit.ts` para registrar eventos como:
- criação de compra
- commits de importação
- evolução futura de ações críticas

### 5. Build validado
- `npm run build` executado com sucesso
- sem erros de TypeScript/Vite
- apenas permaneceu um **warning** de chunk grande no frontend, sem bloquear entrega

## Arquivos principais alterados
- `server/platform.ts`
- `server/index.ts`
- `server/audit.ts`
- `server/routes/purchases.ts`
- `server/routes/audit.ts`
- `server/routes/imports.ts`
- `server/routes/accountant.ts`
- `client/pages/Configuracoes.tsx`

## Próximo passo recomendado
A próxima etapa natural é implementar a camada funcional completa de:
1. **Permissões granulares por módulo/ação**
2. **Tela de compras + entrada de estoque**
3. **Financeiro AP/AR e caixa empresarial**
4. **Viewer visual de auditoria**
5. **Importador real CSV/XLSX com mapeamento**
6. **Integrações de pagamento**
