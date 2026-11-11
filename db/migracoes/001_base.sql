-- Esquema base do sistema de O.S. da Ddtrix (especificação, seção 15).
-- Funciona em qualquer Postgres 14+ (local, Supabase ou outro).

create extension if not exists pgcrypto;
create extension if not exists unaccent;

create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nome_normalizado text not null,
  telefones text[] not null default '{}',
  observacoes text,
  criado_em timestamptz not null default now(),
  criado_por text,
  atualizado_em timestamptz not null default now()
);
create index clientes_nome_normalizado_idx on clientes (nome_normalizado);

create table cliente_enderecos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes on delete cascade,
  rua text not null,
  bairro text,
  cidade text not null default 'Sorocaba/SP',
  referencia text,
  principal boolean not null default false
);
create index cliente_enderecos_cliente_idx on cliente_enderecos (cliente_id);

create table categorias_servico (
  codigo text primary key,
  nome text not null,
  palavras_chave text[] not null default '{}',
  ativa boolean not null default true
);

-- Modalidades: o tipo exato de serviço dentro da categoria. Define o sufixo do número da O.S.
-- (CX, EG, FS, GX, DD, DR) e pode ser ampliado pela administração sem programar.
create table modalidades_servico (
  id uuid primary key default gen_random_uuid(),
  categoria text not null references categorias_servico,
  nome text not null,
  sufixo_os text not null,
  palavras_chave text[] not null default '{}',
  ordem int not null default 0,
  ativa boolean not null default true
);

create table modelos (
  id uuid primary key default gen_random_uuid(),
  categoria text not null references categorias_servico,
  nome text not null
);

create table modelo_versoes (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid not null references modelos on delete cascade,
  numero int not null,
  arquivo_path text not null,
  campos jsonb not null,            -- [{k, texto_exemplo, ocorrencia}]
  oficial boolean not null default false,
  notas text,
  criado_em timestamptz not null default now(),
  criado_por text,
  unique (modelo_id, numero)
);
-- Só uma versão oficial por modelo.
create unique index modelo_versoes_oficial_idx on modelo_versoes (modelo_id) where oficial;

create table agendas (
  id uuid primary key default gen_random_uuid(),
  texto_original text not null,
  criado_em timestamptz not null default now(),
  criado_por text
);

create table ordens (
  id uuid primary key default gen_random_uuid(),
  numero text,
  agenda_id uuid references agendas,
  cliente_id uuid references clientes,
  categoria text references categorias_servico,
  servico text,
  data_execucao date,
  hora text,
  rua text,
  bairro text,
  cidade text,
  observacoes text,
  pagamento_forma text,
  status text not null default 'rascunho' check (status in ('rascunho', 'confirmada', 'emitida')),
  modelo_versao_id uuid references modelo_versoes,
  dados jsonb not null,             -- snapshot completo
  pdf_path text,
  criado_em timestamptz not null default now(),
  criado_por text
);
-- Número da O.S. nunca se repete.
create unique index ordens_numero_idx on ordens (numero) where numero is not null;
create index ordens_data_idx on ordens (data_execucao);
create index ordens_cliente_idx on ordens (cliente_id);

create table auditoria (
  id bigserial primary key,
  quando timestamptz not null default now(),
  quem text,
  acao text not null,
  entidade text not null,
  entidade_id uuid,
  antes jsonb,
  depois jsonb
);
create index auditoria_quando_idx on auditoria (quando desc);

create table configuracoes (
  chave text primary key,
  valor jsonb not null
);

-- Limite de tentativas de login (seção 4.1).
create table login_tentativas (
  id bigserial primary key,
  ip text not null,
  quando timestamptz not null default now(),
  sucesso boolean not null
);
create index login_tentativas_ip_idx on login_tentativas (ip, quando desc);

-- RLS ligado em tudo, sem nenhuma política: ninguém de fora acessa as tabelas
-- (no Supabase, isso bloqueia a API pública). Só o servidor do sistema, que conecta
-- como dono das tabelas, lê e grava.
alter table clientes enable row level security;
alter table cliente_enderecos enable row level security;
alter table categorias_servico enable row level security;
alter table modalidades_servico enable row level security;
alter table modelos enable row level security;
alter table modelo_versoes enable row level security;
alter table agendas enable row level security;
alter table ordens enable row level security;
alter table auditoria enable row level security;
alter table configuracoes enable row level security;
alter table login_tentativas enable row level security;

-- Dados iniciais
insert into categorias_servico (codigo, nome, palavras_chave) values
  ('caixas', 'Limpeza de caixas', array['caixa', 'agua', 'gordura', 'esgoto', 'fossa', 'reservatorio']),
  ('dedet',  'Dedetização',       array['dedetizacao', 'dedetizar', 'barata', 'escorpiao', 'formiga', 'cupim', 'aranha', 'pulga', 'carrapato', 'percevejo', 'mosquito', 'praga']),
  ('desr',   'Desratização',      array['desratizacao', 'desratizar', 'rato', 'ratos', 'roedor', 'roedores', 'ratazana']);

insert into modalidades_servico (categoria, nome, sufixo_os, palavras_chave, ordem) values
  ('caixas', 'Caixa d''água',       'CX', array['caixa d agua', 'caixa dagua', 'caixa de agua', 'reservatorio'], 1),
  ('caixas', 'Caixa de esgoto',     'EG', array['esgoto'], 2),
  ('caixas', 'Fossa',               'FS', array['fossa'], 3),
  ('caixas', 'Caixa de gordura',    'GX', array['gordura'], 4),
  ('dedet',  'Dedetização',         'DD', array['dedetizacao'], 1),
  ('desr',   'Desratização',        'DR', array['desratizacao'], 1);

insert into configuracoes (chave, valor) values
  ('empresa', '{"nome": "DDTRIX Desentupidora e Dedetizadora Eirele.", "cnpj": "28.709.469/0001-13", "inscricao_municipal": "354.986", "endereco": "Alameda das Hortênsias, 754 – Jd. Simus 18055-190 – Sorocaba/SP", "telefones": "(15) 3202-3180 (15) 99654-3180", "email": "contato@ddtrix.com.br"}'),
  ('cevs_validade', '"10/11/2026"'),
  ('cidade_padrao', '"Sorocaba/SP"'),
  ('fonte_minima_pt', '7'),
  ('numeracao', '{"formato": "AAAAMMDD + sufixo da modalidade + P1, P2... quando houver mais de uma no mesmo dia"}');
