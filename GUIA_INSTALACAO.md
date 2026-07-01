# Guia de Instalação e Hospedagem — Allure ERP

## 1. Objetivo

Este guia descreve como instalar, configurar, validar e publicar o Allure ERP em ambiente local ou de produção.

## 2. Requisitos

## 2.1 Requisitos de infraestrutura

- Linux recomendado para produção
- Node.js compatível com o projeto
- npm disponível
- PostgreSQL acessível
- variáveis de ambiente configuradas
- acesso HTTPS obrigatório em produção

## 2.2 Dependências do projeto

As dependências estão definidas em `package.json`.

Principais grupos:

- frontend React/Vite
- backend Express
- Drizzle ORM
- JWT / bcrypt
- XML / certificado / fiscal

## 3. Estrutura mínima para rodar

Você precisará de:

- código-fonte do projeto
- banco PostgreSQL
- arquivo `.env`
- usuário administrador inicial ou rotina de seed

## 4. Variáveis de ambiente recomendadas

## 4.1 Obrigatórias

### `DATABASE_URL`
String de conexão do PostgreSQL.

### `JWT_SECRET`
Segredo do token JWT.

> Em produção, **não use valor padrão** e não permita boot sem essa variável.

## 4.2 Recomendadas

### `JWT_EXPIRES_IN`
Tempo de sessão. Exemplo: `7d`.

### `NODE_ENV`
- `development`
- `production`

### Chave mestra do módulo fiscal
A integração fiscal exige uma chave segura para criptografar o certificado A1 em repouso.

> O nome exato da variável deve seguir o que foi implementado no serviço fiscal. Mantenha essa chave em secret manager ou variável protegida.

## 5. Instalação local

## 5.1 Clonar ou obter o projeto

Coloque o projeto em um diretório de trabalho e entre nele.

## 5.2 Instalar dependências

Execute:

```bash
npm install
```

## 5.3 Configurar o ambiente

Crie ou ajuste o `.env` com as credenciais necessárias.

Exemplo mínimo ilustrativo:

```env
DATABASE_URL=postgres://usuario:senha@host:5432/allure
JWT_SECRET=troque-por-um-segredo-forte
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

## 5.4 Preparar banco de dados

Conforme o fluxo do projeto, utilize as rotinas Drizzle já previstas.

Comandos disponíveis:

```bash
npm run db:generate
npm run db:migrate
```

Se houver seed inicial:

```bash
npm run db:seed
```

## 5.5 Executar em desenvolvimento

```bash
npm run dev
```

## 6. Validação pós-instalação

Após subir o sistema, valide na sequência:

1. login funcionando;
2. leitura de dashboard;
3. cadastro e listagem de produtos;
4. criação de venda simples;
5. persistência em banco;
6. acesso ao módulo fiscal;
7. upload de certificado em homologação;
8. emissão de teste bloqueada ou autorizada conforme parametrização.

## 7. Comandos úteis do projeto

### Desenvolvimento

```bash
npm run dev
```

### Typecheck

```bash
npm run typecheck
```

### Testes

```bash
npm test
```

### Build

```bash
npm run build
```

### Produção

```bash
npm run start
```

## 8. Publicação em produção

## 8.1 Fluxo recomendado

1. provisionar PostgreSQL;
2. configurar variáveis seguras;
3. instalar dependências;
4. aplicar migrações;
5. gerar build;
6. iniciar servidor;
7. expor via proxy reverso HTTPS.

## 8.2 Build de produção

```bash
npm run build
```

Esse processo gera:

- frontend em `dist/spa`
- backend em `dist/server/node-build.mjs`

## 8.3 Subida do serviço

```bash
npm run start
```

## 8.4 Proxy reverso

Recomendado usar Nginx ou equivalente para:

- TLS/HTTPS
- compressão
- cabeçalhos de segurança
- roteamento estável
- controle de timeout

## 9. Configuração de hospedagem

## 9.1 Banco de dados

Boas práticas:

- PostgreSQL gerenciado ou com backup automatizado;
- conexão com TLS quando disponível;
- rotação de credenciais;
- política de restore testada.

## 9.2 Aplicação

Boas práticas:

- rodar como serviço gerenciado (`systemd`, container ou plataforma equivalente);
- reinício automático em falha;
- logs centralizados;
- ambiente isolado por secrets.

## 9.3 Arquivos sensíveis

Não persistir em disco público:

- certificados A1 em claro;
- senhas de banco;
- segredos JWT;
- chave mestra fiscal.

## 10. Configuração fiscal em homologação

Antes de emissão real, configure:

- CNPJ do emitente
- IE
- regime tributário / CRT
- endereço completo
- código IBGE do município
- ambiente fiscal
- certificado A1
- endpoints da SEFAZ
- perfis fiscais de operação
- regras fiscais por produto
- CSC/ID CSC para NFC-e quando aplicável

## 11. Checklist de entrada em produção

## 11.1 Infraestrutura

- [ ] Banco PostgreSQL disponível
- [ ] Backup validado
- [ ] HTTPS ativo
- [ ] `JWT_SECRET` forte configurado
- [ ] chave mestra fiscal segura configurada
- [ ] `NODE_ENV=production`

## 11.2 Aplicação

- [ ] `npm run typecheck` sem erros
- [ ] `npm test` sem falhas
- [ ] `npm run build` concluído
- [ ] usuário admin criado
- [ ] empresa parametrizada

## 11.3 Fiscal

- [ ] certificado A1 válido
- [ ] ambiente em homologação testado
- [ ] endpoints corretos
- [ ] série e numeração revisadas
- [ ] regras fiscais completas por produto
- [ ] emissão de teste confirmada

## 12. Riscos operacionais observados na auditoria

A implantação deve considerar estes pontos atuais do sistema:

1. `autoInvoiceOnSale` não deve ser tratado como emissão fiscal real até correção;
2. a UI de configurações ainda precisa expor todos os campos fiscais críticos;
3. a reserva de numeração fiscal deve ser endurecida antes de alto volume;
4. o índice de código de produto precisa ser revisado em cenário multiempresa.

## 13. Rotina de atualização segura

Sempre que publicar nova versão:

1. executar backup do banco;
2. revisar changelog interno;
3. aplicar migrações;
4. rodar `typecheck`, testes e build;
5. subir em homologação;
6. validar login, vendas, estoque, financeiro e fiscal;
7. promover para produção;
8. monitorar logs e emissão fiscal nas primeiras horas.

## 14. Troubleshooting

## 14.1 Erro de autenticação

Verificar:

- `JWT_SECRET`
- cookies/sessão
- data/hora do servidor
- usuário ativo no banco

## 14.2 Falha ao conectar no banco

Verificar:

- `DATABASE_URL`
- firewall/rede
- credenciais
- TLS exigido pelo provedor

## 14.3 Falha ao emitir nota

Verificar:

- certificado A1
- validade do certificado
- código IBGE da cidade
- endpoints da SEFAZ
- regras fiscais dos produtos
- série/número
- ambiente homologação/produção

## 14.4 Build falhando

Executar:

```bash
npm install
npm run typecheck
npm test
npm run build
```

## 15. Recomendação final de hospedagem

Para produção estável, o cenário recomendado é:

- aplicação Node dedicada;
- PostgreSQL gerenciado com backup;
- HTTPS obrigatório;
- secret manager para chaves;
- monitoramento de logs e alertas;
- homologação fiscal separada da produção.

## 16. Conclusão

O Allure ERP já pode ser instalado e operado tecnicamente com o fluxo padrão de projeto Node + PostgreSQL. Para uma entrada em produção fiscal madura, a publicação deve ocorrer junto com as correções levantadas na auditoria técnica, especialmente nos pontos de emissão automática, parâmetros fiscais de UI, numeração e segurança de segredo.
