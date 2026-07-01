# Manual Operacional — Allure ERP

## 1. Objetivo

Este manual orienta o uso do Allure ERP no dia a dia, por perfil de usuário e por tela.

## 2. Perfis de acesso

## 2.1 Administrador

Responsável por:

- configurar a empresa;
- cadastrar usuários;
- acompanhar operação geral;
- administrar produtos, vendas, estoque e financeiro;
- apoiar a parametrização fiscal.

## 2.2 Contador

Responsável por:

- parametrização tributária;
- revisão de regras fiscais;
- conferência de readiness fiscal;
- suporte à emissão e análise de rejeições.

## 2.3 Vendedor

Responsável por:

- registrar vendas;
- consultar clientes/produtos;
- operar o fluxo comercial diário.

## 3. Telas do sistema

## 3.1 Login

### Finalidade
Autenticar o usuário no sistema.

### Ações esperadas

- informar email
- informar senha
- entrar no ambiente da empresa vinculada

## 3.2 Dashboard

### Finalidade
Apresentar visão rápida da operação.

### Indicadores principais

- receita
- despesas
- lucro líquido
- vendas
- clientes ativos
- fornecedores ativos
- estoque baixo
- passivo de cashback
- alertas operacionais

### Uso recomendado
Abrir diariamente no início do expediente para identificar gargalos.

## 3.3 Produtos

### Finalidade
Cadastrar e manter o catálogo.

### Dados principais

- código
- nome
- categoria
- tamanho
- EAN
- NCM
- CEST
- origem fiscal
- custo
- margem
- preço
- estoque
- estoque mínimo
- status ativo/inativo

### Boas práticas

- manter código padronizado;
- preencher NCM/origem já no cadastro;
- revisar preço e margem antes de ativar o item.

## 3.4 Estoque

### Finalidade
Acompanhar saldo disponível e itens próximos da ruptura.

### Rotina operacional

- consultar produtos com estoque mínimo;
- identificar necessidade de reposição;
- validar movimentos após vendas e compras.

## 3.5 Vendas

### Finalidade
Registrar vendas do dia.

### Fluxo básico

1. selecionar cliente, quando houver;
2. incluir produtos e quantidades;
3. conferir estoque disponível;
4. aplicar desconto, se necessário;
5. informar forma de pagamento;
6. aplicar resgate de cashback, se aplicável;
7. concluir a venda.

### O que o sistema faz ao concluir

- grava a venda;
- grava os itens;
- baixa o estoque;
- cria movimento de estoque;
- cria lançamento financeiro;
- registra cashback gerado/resgatado.

### Atenção
Se a empresa usar emissão fiscal automática na venda, o comportamento deve ser revisado conforme o relatório técnico, pois esse fluxo ainda não representa autorização real da SEFAZ.

## 3.6 Financeiro

### Finalidade
Controlar receitas e despesas.

### Uso diário

- revisar entradas de vendas;
- lançar saídas e despesas operacionais;
- acompanhar status pago/pendente;
- fechar período com conferência financeira.

## 3.7 Fiscal

### Finalidade
Controlar readiness fiscal, parametrização e emissão de documentos.

### Blocos principais

- painel de prontidão fiscal;
- regras fiscais por produto;
- perfis de operação fiscal;
- lista de notas emitidas;
- emissão e retransmissão;
- sincronização de status com SEFAZ.

### Rotina do contador/admin

1. verificar readiness score;
2. conferir checks críticos;
3. revisar produtos sem regra fiscal;
4. revisar perfis de operação;
5. testar emissão em homologação;
6. acompanhar retornos e rejeições.

## 3.8 Configurações

### Finalidade
Centralizar dados institucionais e operacionais.

### Seções observadas

- dados da empresa;
- tenant/fiscal/cashback;
- usuários;
- clientes;
- fornecedores;
- etiquetas;

### Campos importantes da empresa

- razão social
- nome fantasia
- CNPJ
- IE
- inscrição municipal
- endereço completo
- email e telefone
- regime tributário
- ambiente fiscal
- série e próximo número
- cashback

### Atenção fiscal
Alguns campos técnicos da integração SEFAZ precisam estar disponíveis e corretos para emissão real, como endpoints e código IBGE da cidade.

## 3.9 Relatórios

### Finalidade
Apoiar conferência gerencial e operacional.

### Uso recomendado
- fechamento diário;
- conferência por período;
- revisão de vendas, estoque e financeiro.

## 4. Rotinas por perfil

## 4.1 Rotina do administrador

### Abertura da operação

1. acessar dashboard;
2. verificar alertas operacionais;
3. confirmar usuários ativos;
4. revisar estoque baixo.

### Durante o dia

- acompanhar vendas;
- corrigir cadastros necessários;
- apoiar equipe comercial;
- monitorar financeiro.

### Fechamento

- validar vendas realizadas;
- verificar lançamentos financeiros;
- conferir alertas de ruptura e fiscal.

## 4.2 Rotina do contador

### Início da implantação

1. preencher dados fiscais da empresa;
2. configurar regime tributário;
3. cadastrar perfis de operação;
4. revisar tributação produto a produto;
5. carregar certificado A1;
6. configurar ambiente e endpoints;
7. testar emissão em homologação.

### Operação contínua

- revisar rejeições da SEFAZ;
- acompanhar validade do certificado;
- atualizar regras fiscais quando legislação ou operação mudar;
- monitorar readiness score.

## 4.3 Rotina do vendedor

1. localizar cliente ou operar como consumidor final;
2. selecionar itens;
3. conferir quantidades;
4. finalizar pagamento;
5. entregar comprovante conforme processo interno.

## 5. Procedimentos operacionais detalhados

## 5.1 Cadastrar produto

1. acessar **Produtos**;
2. criar novo cadastro;
3. preencher código, nome, categoria e tamanho;
4. preencher custo, margem e preço;
5. preencher estoque inicial, se aplicável;
6. preencher NCM, CEST e origem fiscal;
7. salvar.

## 5.2 Criar usuário

1. acessar **Configurações**;
2. abrir seção de usuários;
3. informar nome, email, senha e perfil;
4. salvar;
5. confirmar se o usuário aparece ativo.

## 5.3 Registrar venda

1. acessar **Vendas**;
2. escolher cliente, se houver;
3. adicionar itens;
4. ajustar quantidade;
5. revisar subtotal, desconto e cashback;
6. escolher forma de pagamento;
7. concluir.

## 5.4 Configurar fiscal da empresa

1. acessar **Configurações** e **Fiscal**;
2. preencher dados fiscais da empresa;
3. carregar certificado A1;
4. configurar ambiente;
5. revisar série e numeração;
6. cadastrar perfis de operação;
7. vincular regra fiscal aos produtos.

## 5.5 Emitir uma nota

1. acessar **Fiscal**;
2. escolher a venda pendente ou iniciar emissão correspondente;
3. validar pendências apontadas;
4. emitir;
5. acompanhar status:
   - validada
   - processando
   - autorizada
   - rejeitada
6. se necessário, sincronizar recibo/retorno.

## 5.6 Retransmitir ou sincronizar nota

Use quando:

- a nota ficou em processamento;
- houve instabilidade de retorno;
- o recibo existe, mas o status ainda não foi atualizado.

## 6. Regras operacionais importantes

## 6.1 Cadastro fiscal do produto

Para emissão robusta, o produto deve ter pelo menos:

- NCM
- origem
- CST ou CSOSN
- CFOP adequado por cenário

## 6.2 Estoque

Se a empresa bloquear venda sem estoque, a conclusão da venda falhará quando o saldo for insuficiente.

## 6.3 Cashback

### Geração
O sistema pode gerar cashback automaticamente conforme configuração da empresa e adesão do cliente.

### Resgate
O resgate só ocorre se houver saldo disponível e cliente vinculado à venda.

## 7. Tratamento de problemas comuns

## 7.1 Não consigo vender

Verifique:

- estoque insuficiente;
- item inativo;
- forma de pagamento inválida;
- desconto maior que subtotal.

## 7.2 Não consigo emitir nota

Verifique:

- certificado ausente ou vencido;
- empresa sem código IBGE/cadastro completo;
- regra fiscal do produto incompleta;
- endpoint SEFAZ não configurado;
- série/numeração inconsistente.

## 7.3 Produto não aparece corretamente no fiscal

Verifique:

- empresa correta;
- produto ativo;
- NCM e origem preenchidos;
- regra fiscal vinculada ao produto.

## 7.4 Dashboard sem refletir toda pendência fiscal

Use a tela **Fiscal** como fonte principal de conferência até a régua de alertas ser totalmente alinhada ao novo fluxo fiscal.

## 8. Boas práticas operacionais

- manter cadastros completos;
- não operar produção fiscal sem testar homologação;
- revisar validade do certificado periodicamente;
- não compartilhar usuários/senhas;
- acompanhar logs de auditoria em ações críticas;
- fazer conferência diária de vendas, estoque e financeiro.

## 9. Controles internos recomendados

## 9.1 Diário

- conferir vendas do dia;
- conferir itens sem estoque;
- conferir caixa/financeiro;
- conferir notas pendentes ou rejeitadas.

## 9.2 Semanal

- revisar produtos com cadastro fiscal incompleto;
- revisar usuários ativos;
- revisar lançamentos financeiros em aberto.

## 9.3 Mensal

- revisar validade do certificado A1;
- revisar regime/configuração fiscal;
- validar backups e exportações críticas;
- fechar indicadores gerenciais.

## 10. Limites atuais conhecidos

Com base na auditoria técnica:

1. emissão automática na venda ainda não deve ser usada como prova de autorização fiscal real;
2. a configuração fiscal precisa refletir todos os campos técnicos de backend;
3. a numeração fiscal precisa ser protegida contra concorrência em operação intensa.

## 11. Conclusão

O Allure ERP já oferece um fluxo operacional consistente para comercial, estoque, financeiro e preparação fiscal. Para a rotina diária, os usuários podem operar o sistema normalmente dentro das regras descritas neste manual. Para operação fiscal em produção, recomenda-se seguir também o relatório técnico e o guia de instalação, garantindo que os pontos críticos levantados sejam tratados antes da massificação do uso.
