# Sistema de Ordens de Serviço da Ddtrix

A especificação completa está em `ESPECIFICACAO.md`. Os modelos .docx, a logo e o protótipo
(`gerador-os-ddtrix.html`) estão em `referencia/`. Leia a especificação antes de mudar regras de negócio.

## Decisões já tomadas com o dono

- **Sem IA paga.** A leitura da agenda é um interpretador por regras, no próprio sistema.
  Nenhuma chamada à Anthropic ou a outra IA paga. O que não for reconhecido fica pendente,
  nunca é inventado.
- **Numeração da O.S.:** data invertida `AAAAMMDD` + sufixo da modalidade
  (`CX` água, `EG` esgoto, `FS` fossa, `GX` gordura, `DD` dedetização, `DR` desratização).
  Mais de uma O.S. do mesmo tipo no mesmo dia: `P1`, `P2`... (ex.: `20261111CXP1`).
- **Observações e pagamento** vão na parte "Observações:" do modelo.
- **Pagamento:** se a agenda disser só "cartão", escrever "cartão". Crédito/débito/cartão leva
  LEVAR A MAQUININHA em vermelho; linha em amarelo.
- **Administração sem senha própria.**
- **CEVS:** validade é configuração (`configuracoes.cevs_validade`), não texto fixo no modelo.
- **Hospedagem e plano de banco:** ainda não decididos. Nada de criar contas ou publicar sem
  aprovação do dono.

## Arquitetura

- Next.js 15 (App Router, TypeScript), interface em português do Brasil, mobile first.
- Postgres puro via `postgres` (postgres.js), sem depender de recursos exclusivos do Supabase,
  para funcionar em qualquer Postgres (local, Supabase ou outro). Migrações SQL em
  `db/migracoes`, aplicadas por `npm run db:migrar`. RLS ligado em todas as tabelas sem
  políticas: só o servidor acessa.
- Login único da empresa por variáveis de ambiente (`EMPRESA_USUARIO`, `EMPRESA_SENHA_HASH`),
  sessão assinada em cookie (90 dias), limite de 5 tentativas erradas em 15 minutos.
- "Quem está usando?" fica em cookie no aparelho e vai para a `auditoria`.
- Toda alteração de cadastro, modelo ou O.S. chama `registrarAuditoria` (`src/lib/auditoria.ts`).

## Comandos

- `npm run dev` — sistema em http://localhost:3000 (precisa de `.env.local`, veja `.env.example`)
- `npm run db:migrar` — aplica migrações
- `npm run senha -- "senha"` — gera o hash da senha da empresa
- `npm test` — testes de unidade (defina `DATABASE_URL_TESTE` para os testes de banco)
- `npm run e2e` — testes no navegador (computador e celular)
- `npm run typecheck` e `npm run lint`

## Design

Skills instaladas em `.claude/skills`: `impeccable`, `taste` (taste-skill), `emil-design-eng`,
`animate`, `review-animations`, `animation-performance`. Cores da logo: azul-marinho e vermelho
sobre branco. A proposta visual precisa ser aprovada pelo dono antes de aplicar no sistema todo.
