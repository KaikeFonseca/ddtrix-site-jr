-- Arquivo do modelo guardado no próprio banco (funciona em qualquer Postgres, sem serviço de arquivos).
alter table modelo_versoes add column arquivo bytea;
alter table modelo_versoes alter column arquivo_path drop not null;

-- Sufixo da modalidade (CX, EG, FS, GX, DD, DR) usado no número da O.S.
alter table ordens add column sufixo text;
alter table ordens add column cliente_nome text;
alter table ordens add column atualizado_em timestamptz not null default now();
create index ordens_agenda_idx on ordens (agenda_id);
create index ordens_criado_idx on ordens (criado_em desc);

-- Texto que marca o campo de observações nos modelos.
insert into configuracoes (chave, valor) values ('marcador_observacoes', '"Observações"')
  on conflict (chave) do nothing;
