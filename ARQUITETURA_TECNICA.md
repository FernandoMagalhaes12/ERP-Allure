# Arquitetura Técnica — Allure ERP

## 1. Visão geral

O Allure ERP é um sistema web full stack voltado para operação comercial brasileira, com foco em:

- cadastro de produtos, clientes e fornecedores;
- controle de estoque;
- vendas e PDV;
- financeiro;
- trilha de auditoria;
- preparação fiscal com emissão de NF-e/NFC-e.

A aplicação segue uma arquitetura de camadas simples e pragmática:

1. **Frontend SPA** em React/Vite.
2. **Backend HTTP** em Express.
3. **Persistência relacional** em PostgreSQL via Drizzle ORM.
4. **Camada fiscal especializada** para XML, assinatura digital, criptografia de certificado e comunicação SOAP.

## 2. Stack tecnológica

### Frontend

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Radix UI
- React Query
- Recharts

### Backend

- Node.js
- Express 5
- TypeScript
- Drizzle ORM
- PostgreSQL
- JWT para sessão
- bcryptjs para senha

### Fiscal / segurança

- `xml-crypto` para assinatura XML
- `node-forge` para tratamento criptográfico/certificados
- SOAP/HTTPS para comunicação SEFAZ
- criptografia AES-256-GCM para PFX em repouso

## 3. Estrutura do projeto

## 3.1 Camadas principais

### `client/`
Contém a SPA e as telas do sistema.

Principais páginas:

- `Dashboard.tsx`
- `Produtos.tsx`
- `Estoque.tsx`
- `Vendas.tsx`
- `Financeiro.tsx`
- `Fiscal.tsx`
- `Configuracoes.tsx`
- `Relatorios.tsx`
- `Login.tsx`

### `server/`
Contém o backend HTTP e a lógica de negócio.

Principais áreas:

- `routes/` → endpoints por domínio
- `services/` → serviços especializados, inclusive fiscal
- `auth.ts` → autenticação/autorização
- `tenant.ts` → resolução de empresa/tenant
- `db.ts` → conexão com banco
- `audit.ts` → trilha de auditoria
- `platform.ts` → bootstrap e infraestrutura lógica

### `drizzle/`
Contém o schema do banco e a modelagem persistente.

### `shared/`
Tipos e contratos compartilhados entre cliente e servidor.

## 4. Módulos funcionais

## 4.1 Autenticação e autorização

### Objetivo
Controlar acesso por usuário e papel.

### Componentes principais

- `server/auth.ts`
- `server/routes/auth.ts`
- `server/routes/users.ts`

### Funcionamento

1. Usuário autentica com email/senha.
2. Backend valida hash com `bcryptjs`.
3. Sistema emite JWT com:
   - `sub`
   - `email`
   - `role`
   - `name`
   - `companyId`
   - `permissions`
4. Token pode trafegar por cookie de sessão e/ou bearer token.
5. Middlewares aplicam autenticação e autorização granular.

### Perfis observados

- `admin`
- `contador`
- `vendedor`

## 4.2 Multiempresa / isolamento lógico

### Objetivo
Garantir que cada usuário opere apenas os dados da sua empresa.

### Componente principal

- `server/tenant.ts`

### Estratégia
O `companyId` do usuário autenticado é usado como delimitador lógico na maioria das rotas. As consultas críticas auditadas filtram por `companyId`.

### Observação de arquitetura
O isolamento é **lógico por coluna** e não por banco físico separado.

## 4.3 Cadastros mestres

### Produtos
Responsável por:

- código interno
- nome
- categoria
- tamanho
- preço/custo/margem
- EAN/NCM/CEST/origem fiscal
- estoque e estoque mínimo

### Clientes
Responsável por:

- identificação
- documento
- contato
- preferências de cashback

### Fornecedores
Responsável por:

- dados cadastrais
- documento
- contato

## 4.4 Estoque

### Objetivo
Controlar saldo e movimentações de produtos.

### Entidades associadas

- `products`
- `stockMovements`

### Fluxos principais

- entrada via compra/ajuste
- saída via venda
- alerta por estoque mínimo

## 4.5 Vendas / PDV

### Componente principal

- `server/routes/sales.ts`

### Responsabilidades

- validar itens e forma de pagamento
- verificar estoque
- calcular subtotal, descontos e total
- registrar itens vendidos
- baixar estoque
- criar lançamento financeiro de receita
- registrar cashback resgatado/gerado

### Fluxo resumido

1. Recebe itens e cliente opcional.
2. Busca produtos ativos da empresa.
3. Valida disponibilidade de estoque.
4. Calcula totais.
5. Persiste venda e itens.
6. Gera movimentação de estoque.
7. Gera lançamento financeiro.
8. Atualiza cashback quando aplicável.

## 4.6 Financeiro

### Objetivo
Controlar receitas e despesas da operação.

### Entidade central

- `financialEntries`

### Usos observados

- receita de vendas
- composição de métricas no dashboard
- base para lucro líquido resumido

## 4.7 Dashboard executivo

### Componente principal

- `server/routes/dashboard.ts`

### Indicadores levantados

- receita total
- despesa total
- lucro líquido
- quantidade de vendas
- produtos ativos
- clientes ativos
- fornecedores ativos
- margem média
- produtos com estoque baixo
- passivo de cashback
- séries temporais resumidas

## 4.8 Auditoria

### Objetivo
Registrar eventos críticos com rastreabilidade.

### Casos observados

- upload de certificado
- criação/atualização de perfis fiscais
- criação/atualização de regras fiscais
- criação/transmissão/sincronização de notas
- criação de venda

### Benefício
Permite reconstruir ações relevantes para governança, troubleshooting e compliance.

## 5. Módulo fiscal

## 5.1 Objetivo
Habilitar emissão fiscal brasileira com validação prévia, assinatura digital e integração com a SEFAZ.

## 5.2 Componentes principais

- `server/routes/fiscal.ts`
- `server/services/fiscalIntegration.ts`
- `client/pages/Fiscal.tsx`
- `client/pages/Configuracoes.tsx`

## 5.3 Subcamadas do módulo fiscal

### A. Parametrização fiscal
Controla:

- regime tributário / CRT
- perfis de operação
- CFOP
- CST/CSOSN
- PIS/COFINS/IPI
- NCM / CEST / origem
- CSC para NFC-e
- ambiente homologação/produção

### B. Motor de decisão fiscal
Resolve automaticamente:

- destino da operação: interna / interestadual / exterior
- contribuinte / não contribuinte
- consumidor final
- perfil fiscal aplicável
- CFOP resultante por item

### C. Validação pré-emissão
Antes de transmitir, o backend verifica:

- CNPJ da empresa
- endereço fiscal
- código IBGE da cidade
- IE do emitente
- certificado A1
- endpoints SEFAZ
- fornecedor fiscal / ambiente
- cadastro tributário dos produtos
- consistência entre CFOP e destino

### D. Geração de XML
O serviço monta XML de NF-e/NFC-e contendo:

- dados do emitente
- dados do destinatário
- itens
- tributos
- valores totais
- informações complementares
- chave de acesso

### E. Assinatura digital
O XML é assinado com certificado A1, em padrão ICP-Brasil, sobre o nó fiscal apropriado.

### F. Transmissão e retorno
Após assinatura:

1. XML é transmitido via webservice.
2. O sistema registra recibo, protocolo e status.
3. Se necessário, sincroniza situação posterior via consulta de recibo.

## 5.4 Estados relevantes da nota

Os estados observados ou derivados incluem:

- `pending`
- `validated`
- `signed`
- `processing`
- `authorized`
- `rejected`

E, no campo fiscal:

- `critical`
- `error`
- `warning`
- `ready`
- `processing`

## 5.5 Persistência fiscal ampliada

O schema já suporta armazenamento de artefatos importantes, como:

- XML base
- XML assinado
- chave de acesso
- recibo SEFAZ
- protocolo
- código e mensagem de retorno
- timestamp de sincronização
- metadados de certificado

## 5.6 Segurança aplicada ao certificado

### Medidas implementadas

- validação do PFX antes do uso
- armazenamento criptografado do payload fiscal
- extração controlada para assinatura/transmissão
- persistência de alias, assunto e validade

### Dependência operacional
A segurança final depende da proteção adequada da chave mestra e das variáveis de ambiente.

## 6. Banco de dados

## 6.1 Tecnologia

- PostgreSQL
- Drizzle ORM

## 6.2 Entidades centrais identificadas

### Estruturais
- `users`
- `companySettings`
- `auditLogs`

### Comerciais
- `products`
- `clients`
- `suppliers`
- `sales`
- `saleItems`
- `stockMovements`
- `purchases`

### Financeiras
- `financialEntries`
- `customerCashbackLedger`

### Fiscais
- `invoices`
- `fiscalCompanyProfiles`
- `fiscalOperationProfiles`
- `fiscalProductRules`

### Impressão / operação
- `labelSettings`
- `printLogs`

## 6.3 Relacionamentos funcionais

- uma empresa possui muitos usuários, produtos, clientes, fornecedores, vendas e notas;
- uma venda possui muitos itens;
- itens referenciam produtos;
- venda pode gerar movimentação de estoque e lançamento financeiro;
- nota fiscal pode referenciar venda e cliente;
- regras fiscais se vinculam a produtos e empresa.

## 7. Fluxos de ponta a ponta

## 7.1 Venda com baixa de estoque

1. Operador lança venda.
2. Sistema valida estoque.
3. Persistem venda e itens.
4. Sistema reduz saldo do produto.
5. Gera movimento de estoque.
6. Gera lançamento financeiro.
7. Atualiza cashback, quando aplicável.

## 7.2 Emissão fiscal real

1. Usuário solicita emissão.
2. Backend resolve contexto fiscal da empresa, cliente e itens.
3. Motor fiscal define operação.
4. Sistema gera lista de issues.
5. Se houver bloqueio, emissão para.
6. Se estiver ok, gera XML.
7. Assina XML com A1.
8. Transmite para a SEFAZ.
9. Persiste retorno.
10. Consulta recibo posteriormente, se necessário.

## 7.3 Gestão de certificado

1. Usuário faz upload do PFX em base64 + senha.
2. Backend valida integridade do certificado.
3. Criptografa o payload.
4. Persiste metadados de validade/assunto.
5. Registra auditoria.

## 8. Arquitetura das telas

## 8.1 Login
Entrada de autenticação do sistema.

## 8.2 Dashboard
Painel executivo e operacional com KPIs.

## 8.3 Produtos
Gestão do catálogo, precificação e dados fiscais básicos.

## 8.4 Estoque
Consulta de saldos e ajustes operacionais.

## 8.5 Vendas
PDV e histórico de vendas.

## 8.6 Financeiro
Gestão de receitas e despesas.

## 8.7 Fiscal
Painel de readiness, regras fiscais, operações e emissão.

## 8.8 Configurações
Dados da empresa, usuários, cashback e parte da parametrização operacional/fiscal.

## 8.9 Relatórios
Área para visão consolidada e extrações operacionais.

## 9. Hospedagem e execução

## 9.1 Modo desenvolvimento

- frontend servido por Vite
- backend empacotado/servido no projeto
- banco PostgreSQL externo

## 9.2 Build de produção

Scripts identificados:

- `npm run build`
- `npm run start`

## 9.3 Artefatos de produção

- SPA compilada em `dist/spa`
- servidor compilado em `dist/server/node-build.mjs`

## 10. Limitações atuais de arquitetura

1. coexistência de fluxo fiscal real e fluxo legado simplificado de venda;
2. ausência de proteção explícita contra concorrência na reserva do número fiscal;
3. campos fiscais críticos ainda não totalmente refletidos na tela de configurações;
4. alguns indicadores do dashboard ainda não absorveram o novo ciclo fiscal.

## 11. Recomendações arquiteturais

### Curto prazo

- centralizar toda criação de `invoices` em um único serviço fiscal;
- separar claramente estados de negócio, validação e transmissão;
- ajustar índices multiempresa no banco;
- fortalecer requisitos de segredos de ambiente.

### Médio prazo

- criar fila assíncrona para emissão fiscal;
- adicionar retry controlado de transmissão;
- adicionar health checks para SEFAZ e certificado;
- expandir cobertura de testes de integração.

## 12. Conclusão

A arquitetura do Allure ERP é moderna, coerente e suficientemente flexível para suportar a operação comercial e fiscal brasileira. O maior avanço técnico é o módulo fiscal especializado, que já está desenhado com separação de responsabilidades adequada. Para atingir padrão de produção mais robusto, o próximo passo é **consolidar a camada fiscal como único caminho de emissão** e eliminar os atalhos legados ainda existentes.
