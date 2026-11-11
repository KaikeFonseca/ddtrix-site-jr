# Ddtrix · Ordens de Serviço

Sistema web para criar, organizar e emitir as Ordens de Serviço da Ddtrix Desentupidora e
Dedetizadora (Sorocaba/SP).

## Rodar localmente

1. Tenha Node 22 e um Postgres 14 ou mais novo.
2. Copie `.env.example` para `.env.local` e preencha (gere a senha com `npm run senha -- "sua senha"`).
3. `npm install`
4. `npm run db:migrar`
5. `npm run dev` e abra http://localhost:3000

Detalhes de arquitetura e decisões em `CLAUDE.md`. Especificação completa em `ESPECIFICACAO.md`.
