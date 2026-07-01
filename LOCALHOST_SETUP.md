# Como rodar o ERP em localhost

## 1. Pré-requisitos

Você precisa ter instalado:

- Node.js 20+
- npm
- PostgreSQL local rodando

## 2. Criar o banco

```bash
createdb fitness_store_erp
```

## 3. Variáveis de ambiente

O projeto já inclui `.env` para localhost e também `.env.example`.

Se seu PostgreSQL usar outro usuário, senha ou porta, ajuste:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fitness_store_erp
DATABASE_URL_UNPOOLED=postgresql://postgres:postgres@localhost:5432/fitness_store_erp
JWT_SECRET=troque-este-segredo-no-ambiente-real
JWT_EXPIRES_IN=7d
PORT=3000
PING_MESSAGE=pong
```

## 4. Instalar dependências

```bash
npm install
```

## 5. Rodar migrations

```bash
npm run db:migrate
```

## 6. Popular dados iniciais

```bash
npm run db:seed
```

## 7. Subir em desenvolvimento

```bash
npm run dev
```

A aplicação ficará disponível em:

- `http://localhost:8080`

## 8. Usuários iniciais

### Admin
- Email: `admin@completefitness.com.br`
- Senha: `password123`

### Vendedor
- Email: `vendedor@completefitness.com.br`
- Senha: `password123`

## 9. O que esta versão já entrega

- sidebar e layout corrigidos
- PDV com fluxo visual no padrão solicitado
- vendedor vinculado ao login realizado
- histórico de vendas no financeiro
- produtos com filtro por categoria
- cadastro de produto em modal no layout solicitado
- SKU automático único por produto
- tabela de produtos com SKU, nome, tamanho, categoria, custo, margem, preço, estoque, status e ações
- compras e estoque com abas de posição e movimentações
- textos principais em pt-BR

## 10. Build local de produção

```bash
npm run build
npm start
```

## 11. Observação fiscal

O módulo fiscal continua em fase 1 local, com persistência e XML interno. A integração oficial com SEFAZ ainda entra em fase posterior.
