# Correções aplicadas — 2026-06-19

## Escopo desta rodada

Esta rodada corrigiu o problema reportado no **Financeiro do perfil contador** e tratou os principais bloqueios técnicos que impediam o Allure ERP de ficar pronto para produção fiscal.

## 1. Correção do Financeiro no perfil contador

### Problema encontrado
A tela `Financeiro` carregava 4 APIs em paralelo com `Promise.all`:

- `/api/v1/financial/entries`
- `/api/v1/sales`
- `/api/v1/clients`
- `/api/v1/suppliers`

Quando **uma** delas falhava, o carregamento inteiro quebrava e o contador via tudo zerado, mesmo existindo dados.

### Causa raiz
O perfil `contador` não tinha acesso consistente à rota de clientes e o frontend não era resiliente a falhas parciais.

### Correções aplicadas
- a rota `/api/v1/clients` agora também aceita permissões de contador/financeiro/fiscal para leitura;
- o preset padrão de permissões do contador passou a incluir `clients.view`;
- a normalização de permissões passou a **mesclar permissões padrão do papel com permissões já gravadas**, evitando usuários antigos ficarem defasados;
- a página `Financeiro.tsx` foi alterada para usar `Promise.allSettled`, carregando o máximo possível mesmo com falha parcial.

## 2. Fim da nota fake na venda

### Problema encontrado
O fluxo de venda criava nota fiscal marcada como autorizada sem assinatura digital e sem SEFAZ real.

### Correção aplicada
O fluxo legado foi removido de `server/routes/sales.ts`.

### Resultado
A venda não cria mais documento fiscal “falso”. O fiscal passa a depender do pipeline real do módulo fiscal.

## 3. Numeração fiscal com reserva atômica

### Problema encontrado
O número da nota era lido e incrementado em etapas separadas, com risco de concorrência.

### Correção aplicada
Foi criada reserva atômica de número fiscal em `server/services/fiscalIntegration.ts` com `UPDATE ... RETURNING` no banco.

### Resultado
A emissão padrão sem número manual agora reserva a numeração diretamente no banco, reduzindo o risco de colisão concorrente.

## 4. Correção multiempresa de índice de produto

### Problema encontrado
O índice de produto era global:

- `UNIQUE(code)`

### Correção aplicada
Foi alterado para unicidade composta por empresa:

- `UNIQUE(company_id, code)`

Também foi adicionada a migração defensiva na infraestrutura para remover o índice antigo e criar o novo.

## 5. Correção de unicidade fiscal das notas

### Problema encontrado
As notas também tinham índice global por número, o que era inadequado para múltiplas empresas/séries/modelos.

### Correção aplicada
Foi substituído por índice composto:

- `UNIQUE(company_id, type, series, number)`

## 6. Endurecimento do JWT e do segredo fiscal

### Problema encontrado
Existia fallback inseguro para segredo JWT e segredo fiscal.

### Correções aplicadas
- `JWT_SECRET` agora é obrigatório em produção;
- o serviço fiscal também exige segredo válido em produção (`FISCAL_SECRET` ou `JWT_SECRET`), sem fallback inseguro.

## 7. Configuração fiscal completada no frontend

### Problema encontrado
O backend já aceitava campos críticos da SEFAZ, mas a tela de configurações não permitia editar tudo.

### Campos adicionados na UI
- código UF/autorizador
- código IBGE da cidade
- URL SEFAZ autorização
- URL SEFAZ recibo
- URL SEFAZ consulta

## 8. Dashboard fiscal alinhado

### Problema encontrado
O dashboard contava pendências fiscais por um status antigo e incompleto.

### Correção aplicada
A régua foi ajustada para considerar notas não autorizadas e estados fiscais relevantes (`critical`, `error`, `warning`, `processing`, etc.).

## 9. Arquivos principais alterados

- `client/pages/Financeiro.tsx`
- `client/pages/Configuracoes.tsx`
- `server/auth.ts`
- `server/permissions.ts`
- `server/index.ts`
- `server/routes/sales.ts`
- `server/routes/fiscal.ts`
- `server/routes/dashboard.ts`
- `server/services/fiscalIntegration.ts`
- `server/platform.ts`
- `drizzle/schema.ts`

## 10. Validação executada após as correções

### TypeScript
- `npm run typecheck` ✅

### Testes
- `npm test` ✅

### Build de produção
- `npm run build` ✅

## 11. Resultado objetivo

Nesta rodada, o sistema ficou significativamente mais seguro e coerente para produção, com correção direta dos pontos que você destacou:

- financeiro do contador corrigido;
- fluxo fake de nota eliminado;
- numeração fiscal endurecida;
- multiempresa corrigido em produto e nota;
- JWT/fiscal secrets endurecidos;
- configurações fiscais completadas no frontend;
- dashboard fiscal ajustado.

## 12. Observação importante

As mudanças foram aplicadas no código-fonte do projeto dentro do workspace atual. O próximo passo recomendado é testar em homologação com:

1. login como contador;
2. conferência do Financeiro com dados reais;
3. parametrização SEFAZ completa;
4. upload de certificado A1;
5. emissão real em homologação;
6. verificação de concorrência de emissão em cenário controlado.
