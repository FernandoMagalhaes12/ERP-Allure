# Diagnóstico técnico, problemas e riscos — Allure ERP

## Escopo da análise

A análise foi feita a partir de:

- inspeção estrutural do repositório
- validação de `npm install`
- validação de `npm run typecheck`
- validação de `npm run build`
- execução de `npm test`
- auditoria de dependências com `npm audit`
- leitura dos principais arquivos de frontend, backend e banco

---

## Resumo executivo

O projeto está **funcional e buildável** após pequenos ajustes seguros, mas ainda apresenta riscos importantes de manutenção, testes, performance e endurecimento de infraestrutura.

### Situação atual validada

- `npm install` ✅
- `npm run typecheck` ✅ *(após correções)*
- `npm run build` ✅ *(após correções)*
- `npm test` ⚠️ falha por dependência de PostgreSQL local

---

## Correções aplicadas nesta rodada

Foram corrigidos problemas objetivos que impediam validação limpa do projeto:

1. **Erro de tipagem em `Configuracoes.tsx`**
   - havia um tipo local de `Product` divergente do contrato compartilhado
   - correção: uso de `Product` vindo de `shared/api.ts`

2. **Erro estrutural no preset de etiquetas**
   - faltava a chave `parcel` em `elementLayouts` em um preset específico
   - correção: inclusão do bloco faltante

3. **Erro de compilação no backend**
   - `server/routes/stock.ts` tinha propriedade duplicada `createdByName`
   - correção: remoção da duplicidade

4. **Erro/ruído de tooling UI**
   - `components.json` apontava para `client/index.css`, arquivo inexistente
   - correção: caminho ajustado para `client/global.css`

5. **Onboarding de ambiente**
   - adicionado `.env.example`

---

## Problemas e riscos encontrados

## 1. Testes automatizados frágeis e dependentes de ambiente local

### Evidência

`npm test` falhou tentando conectar em `localhost:5432`.

### Risco

- CI fica instável sem banco provisionado
- devs diferentes podem ter experiências inconsistentes
- regressões podem passar sem cobertura real de fluxos críticos

### Impacto

**Alto** para manutenção contínua.

### Recomendação

- separar testes unitários puros de testes integrados
- criar banco de teste provisionável ou mocks controlados
- adicionar script de teste que não dependa implicitamente do banco local

---

## 2. Bundle frontend muito grande

### Evidência

A build gerou um bundle principal de aproximadamente **1.26 MB** minificado.

### Risco

- carregamento inicial mais pesado
- pior experiência em redes lentas
- impacto em TTI/TBT e performance percebida

### Impacto

**Alto** em UX e performance web.

### Possíveis causas

- páginas grandes e pouco fragmentadas
- ausência de lazy loading por rota
- bibliotecas densas carregadas no bundle principal

### Recomendação

- aplicar `React.lazy` / code splitting por rota
- revisar importações pesadas
- medir se `recharts`, `three`, `xlsx`, `jsbarcode` e módulos de configuração entram cedo demais

---

## 3. Migração estrutural sendo feita em runtime

### Evidência

`server/platform.ts` executa `ALTER TABLE`, `CREATE TABLE` e updates corretivos ao subir a aplicação.

### Risco

- comportamento diferente entre ambientes
- debugging mais difícil
- chance de efeitos colaterais ao subir produção
- mistura de responsabilidade entre inicialização e migração

### Impacto

**Alto** em confiabilidade operacional.

### Recomendação

- mover alterações estruturais para migrações formais do Drizzle
- manter `platform.ts` apenas para bootstrap lógico, não DDL
- deixar runtime idempotente, mas enxuto

---

## 4. Documentação e configuração tinham inconsistências internas

### Evidência

Foram observados pequenos desalinhamentos como:

- `components.json` apontando para CSS inexistente
- documentação falando em Tailwind v4/v3 em momentos diferentes
- coexistência de `package-lock.json` e `pnpm-lock.yaml`

### Risco

- onboarding confuso
- comandos diferentes entre devs
- baixa previsibilidade de ambiente

### Impacto

**Médio**.

### Recomendação

- padronizar oficialmente o gerenciador de pacotes
- revisar documentação técnica de setup
- manter um único fluxo preferencial de instalação

---

## 5. Tailwind CSS v4 não é upgrade seguro “de passagem”

### Evidência

A base atual está claramente estruturada para **Tailwind 3.4.x**:

- `tailwind.config.ts`
- `postcss.config.js` modelo v3
- `@tailwind base/components/utilities`
- tema e design system já consolidados nessa convenção

### Risco de migrar agora

- quebra visual silenciosa
- incompatibilidade com pipeline atual
- alterações em plugins e convenções do CSS base

### Impacto

**Médio/alto**, dependendo do grau de validação visual.

### Decisão aplicada

**Não migrar nesta rodada**.

### Recomendação

Tratar Tailwind v4 como projeto dedicado, com:

- branch própria
- checklist visual por tela
- homologação completa

---

## 6. Segurança de dependências com alertas abertos

### Evidência do `npm audit`

Total identificado:

- **4 moderadas**
- **1 alta**

Principais pontos:

#### `xlsx` — severidade alta

Alertas para:

- Prototype Pollution
- ReDoS

**Fix automático indisponível** via `npm audit`.

#### `drizzle-kit` / `@esbuild-kit/*` / `esbuild`

Alertas moderados ligados a cadeia de tooling de desenvolvimento.

### Risco

- superfície de risco em importação/processamento de arquivos
- fragilidade em ferramentas de desenvolvimento

### Impacto

- **alto** para `xlsx` se houver ingestão de arquivos não confiáveis
- **médio** para o restante, por ser mais ligado a dev tooling

### Recomendação

- revisar uso de `xlsx` em fluxos expostos ao usuário
- considerar sandbox/validação forte de arquivos
- acompanhar versão segura/alternativa para parsing de planilhas
- revisar upgrade do tooling em uma janela dedicada

---

## 7. Cobertura de tipos compartilhados ainda não está totalmente consolidada

### Evidência

Havia duplicação local de tipos no frontend onde já existia contrato em `shared/api.ts`.

### Risco

- divergência entre payload real e expectativa do componente
- bugs silenciosos em refactors

### Impacto

**Médio**.

### Recomendação

- continuar migrando tipos duplicados para `shared/api.ts`
- padronizar DTOs/contratos por módulo

---

## 8. Área fiscal parece parcialmente madura, mas não totalmente endurecida

### Evidência

A documentação local indica que a integração oficial com SEFAZ ainda é fase posterior.

### Risco

- expectativa funcional maior que a cobertura real do módulo
- diferenças entre homologação local e produção fiscal oficial

### Impacto

**Alto**, se o sistema for vendido como fiscal completo.

### Recomendação

- separar claramente o que é emissão interna/local do que é integração oficial
- formalizar roadmap fiscal por fases
- adicionar checklist de conformidade por ambiente

---

## 9. Sessão híbrida cookie + localStorage precisa disciplina contínua

### Evidência

- cookie HTTP-only mantém sessão real
- `localStorage` mantém espelho do usuário

### Risco

- inconsistência temporária entre estado local e sessão real
- UI renderizando permissões antigas até revalidação

### Impacto

**Médio**.

### Recomendação

- reforçar reidratação/refresh do usuário autenticado em pontos críticos
- centralizar melhor o estado de sessão

---

## 10. Páginas muito grandes podem dificultar manutenção

### Evidência

`client/pages/Configuracoes.tsx` é muito extensa.

### Risco

- baixa legibilidade
- maior chance de regressão em manutenção
- revisão de código mais difícil

### Impacto

**Médio**.

### Recomendação

- quebrar páginas grandes em subcomponentes por domínio
- extrair hooks para lógica de carregamento e persistência
- separar rendering, state orchestration e helpers visuais

---

## Matriz resumida de risco

| Tema | Severidade | Observação |
|---|---:|---|
| Testes dependentes de banco local | Alta | trava automação confiável |
| Bundle frontend grande | Alta | impacta performance inicial |
| DDL em runtime (`platform.ts`) | Alta | risco operacional/infra |
| Vulnerabilidade em `xlsx` | Alta | atenção especial em importação |
| Fiscal ainda parcial | Alta | risco de expectativa funcional |
| Inconsistências de docs/tooling | Média | atrito de manutenção |
| Tipos duplicados | Média | divergência de contratos |
| Sessão híbrida cookie/localStorage | Média | risco de estado inconsistente |
| Páginas grandes | Média | piora manutenção |
| Upgrade Tailwind v4 agora | Médio/alto | melhor tratar em projeto dedicado |

---

## Prioridades recomendadas

## Prioridade 1 — endurecimento técnico imediato

1. mover DDL do `platform.ts` para migrações formais
2. isolar testes para não dependerem de PostgreSQL local implícito
3. revisar uso de `xlsx` em entradas externas

## Prioridade 2 — performance e manutenibilidade

4. aplicar code splitting por rota
5. quebrar páginas grandes, começando por `Configuracoes.tsx`
6. consolidar mais contratos em `shared/api.ts`

## Prioridade 3 — padronização e evolução

7. padronizar documentação e gerenciador de pacotes
8. tratar Tailwind v4 em trilha própria de migração
9. amadurecer o módulo fiscal com escopo formal por fase

---

## Veredito final

**O projeto está em condição boa para continuidade e empacotamento, mas ainda não está “endurecido” como uma base enterprise madura.**

Ele já tem estrutura forte de produto e negócio, porém precisa principalmente de:

- mais previsibilidade de infraestrutura
- melhor estratégia de testes
- redução de risco em dependências e performance
- consolidação arquitetural em torno de contratos e migrações formais
