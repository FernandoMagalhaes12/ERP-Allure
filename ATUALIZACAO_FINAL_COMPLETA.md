# Allure ERP — pacote final desta fase

## Correções aplicadas
- Conta `vendedor` agora acessa **Configurações > Impressão e Scanner** com permissão real de visualização e impressão.
- Impressão de etiquetas ficou liberada para vendedor sem abrir módulos administrativos.
- Cashback no PDV agora permite **definir a porcentagem no ato da venda**.

## Permissões granulares
- Estrutura de permissões por usuário implementada com `permissions_json`.
- Login e sessão agora carregam permissões granulares.
- Servidor passou a validar permissões como:
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
- Tela de usuários agora mostra e salva permissões granulares por usuário.

## Módulos entregues nesta fase
### Compras e entrada de estoque
- Nova rota de compras ativa.
- Compra registra itens, atualiza estoque, gera movimentação e cria conta a pagar automática.
- Tela `Compras e Estoque` agora possui aba de compras com lançamento completo.

### Financeiro empresarial (AP/AR/caixa)
- Financeiro ampliado com:
  - contas a receber
  - contas a pagar
  - fluxo de caixa
  - integrações de pagamento
- Lançamentos financeiros agora aceitam vínculo com cliente e fornecedor.
- Operações financeiras entram na auditoria.

### Auditoria e logs de operação
- Logs para vendas, compras, importações, integrações de pagamento e financeiro.
- Viewer de auditoria disponível em `Relatórios e Governança`.

### Relatórios gerenciais úteis
- Receita, pedidos, ticket médio, itens vendidos e cashback distribuído.
- Ranking de vendedores.
- Top produtos.
- Desempenho por categoria.

### Importação de dados
- Importação operacional para:
  - produtos
  - clientes
  - fornecedores
  - estoque
- Preview e commit implementados.
- Tela de importação disponível no frontend.

### Portal do contador / exportações fiscais organizadas
- Resumo do contador com documentos fiscais, financeiro aberto, compras e vendas recentes.
- Exportação fiscal em JSON pronta para download.

### Integrações de pagamento
- Configuração de Pix e gateway principal.
- Base pronta para Mercado Pago / Pagar.me / Asaas.

## Validação
- `npm run build` executado com sucesso.
- Projeto pronto para empacotamento e continuidade.
