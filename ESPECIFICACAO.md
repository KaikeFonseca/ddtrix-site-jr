Especificação do sistema de Ordens de Serviço da Ddtrix




Especificação do sistema de Ordens de
Serviço da Ddtrix
Documento para o Claude Code. Reúne tudo o que o dono da empresa pediu, em ordem,
com as regras de negócio, o modelo de dados e o plano de construção.


0. Como usar este documento
   1. Crie uma pasta nova do projeto e salve este texto como CLAUDE.md (ou
        ESPECIFICACAO.md ).
   2. Coloque na pasta referencia/ os três modelos de O.S. ( OS_DDT.docx ,
      OS_DSR.docx , OS_Limp_Cx.docx ) e o protótipo gerador-os-ddtrix.html , que já
       funciona e deve ser aproveitado (seção 17).
   3. Peça ao Claude Code para ler tudo, resumir o que entendeu e propor o plano por fases
      antes de escrever código.
   4. Regra de custos: o Claude Code não deve criar contas, contratar nada nem publicar
      sem autorização explícita do dono. Primeiro desenvolve e testa localmente, sem custo.


1. Objetivo
Um sistema web, independente do Claude, para a Ddtrix Desentupidora e Dedetizadora
(Sorocaba/SP) automatizar a criação, organização e gerenciamento das Ordens de Serviço
(O.S.). O funcionário cola uma agenda (mensagens do WhatsApp, com um ou vários
clientes), a IA interpreta, o sistema reconhece clientes já cadastrados, preenche o modelo
oficial da O.S. e gera PDFs individuais ou em lote, tudo com histórico compartilhado.

Serviços da empresa: desentupimento, dedetização, desratização e limpeza de caixa
d'água, gordura, esgoto e fossa.


2. Princípios inegociáveis
       Nunca inventar informação. Se algo não está na agenda, o campo fica vazio e
       sinalizado como pendente.
       Alterar somente o que foi pedido. Se o usuário pede para mudar só o horário, só o
       horário muda. Nome, endereço, data, categoria, observações e o resto do documento
       permanecem idênticos.
       Preservar observações integralmente. Sem resumir, misturar ou descartar.
       Perguntar antes de gerar quando houver informação essencial faltando, ambígua ou
       contraditória.



                                                                                      Page 1 of 14
Especificação do sistema de Ordens de Serviço da Ddtrix




       Nunca substituir dados de cliente automaticamente. Divergências são mostradas e o
       usuário escolhe.
       Os recursos precisam funcionar de verdade, principalmente o banco compartilhado,
       a interpretação de agendas, o reconhecimento de clientes e a geração das O.S. Não
       basta mudança visual.
       Preservar o que já existe no protótipo (seção 17).


3. Acesso e uso em vários aparelhos
       Um único login empresarial (usuário e senha), usado por todos os funcionários. Sem
       cadastro de usuários individuais e sem tela de criar conta.
       Todos acessam o mesmo banco de dados na nuvem, em tempo real. Exemplo: a
       Eduarda cadastra um cliente e o dono vê esse cliente ao abrir o sistema, e vice-versa.
       Funciona em qualquer computador ou celular, sem depender de um aparelho
       específico (mobile first, site responsivo, pode ser instalável como PWA).
       Como o login é único, ao entrar o sistema pede "Quem está usando?" (nome do
       funcionário, lembrado no aparelho). Esse nome é gravado no histórico de alterações.
       Sessão longa, para não exigir login toda hora no celular.


4. Arquitetura recomendada
Sugestão, que o Claude Code pode ajustar se justificar:

       Front e API: Next.js (TypeScript) responsivo, em português do Brasil.
       Banco, arquivos, login e tempo real: Supabase (Postgres, Storage para modelos e
       PDFs, Auth com uma única conta da empresa, Realtime para sincronizar telas).
       IA: API da Anthropic chamada somente no servidor (a chave nunca vai para o
       navegador). Modelo barato e rápido para ler agendas (por exemplo Haiku 5.5), com
       opção de modelo maior se a leitura falhar.
       Preenchimento do .docx: biblioteca de zip e manipulação do XML no servidor (portar
       a lógica do protótipo, seção 8).
       PDF: começar pela opção sem custo extra (conversão em servidor ou no navegador).
       Se a fidelidade ao Word não ficar boa, avaliar um conversor com LibreOffice em um
       servidor pequeno e informar o custo ao dono antes de usar.
       Hospedagem: plataforma que permita uso comercial. Observação de custo: o plano
       grátis da Vercel não permite uso comercial; alternativas grátis que permitem (como
       Cloudflare Pages) existem. Decisão fica com o dono.




                                                                                       Page 2 of 14
Especificação do sistema de Ordens de Serviço da Ddtrix




Custos e contas (nada deve ser contratado sem aprovação)
Valores aproximados consultados em novembro de 2026, a confirmar antes de assinar:

       GitHub: grátis.
       Banco (Supabase): plano grátis tem 500 MB, mas o projeto pausa após 7 dias sem uso.
       Para uso diário o plano Pro custa cerca de US$ 25 por mês e não pausa.
       Hospedagem: Vercel Pro cerca de US$ 20 por mês (uso comercial), ou alternativa
       grátis que permita uso comercial.
       IA (Anthropic): pagamento por uso, com cartão internacional. Ler uma agenda de 20
       clientes custa centavos no modelo pequeno.
       Domínio próprio: opcional, custo anual pequeno.
       Total estimado de produção: cerca de US$ 45 por mês mais a IA. Para testar, usar tudo
       no plano grátis.


4.1 Segurança e LGPD
       Dados de clientes (nome, endereço, telefone) são dados pessoais: senha forte, HTTPS,
       acesso só com login, regras de acesso no banco (RLS) para que nada seja público.
       Chaves e segredos só em variáveis de ambiente do servidor.
       Backup automático do banco e do armazenamento (confirmar o que o plano escolhido
       oferece).
       Limite de tentativas de login e de chamadas à IA.


5. Categorias de serviço e classificação
Três categorias fixas, extensíveis pela área administrativa:


  Categoria                           Código              O que inclui

  Limpeza de caixas                    caixas             Caixa d'água, caixa de gordura, caixa de esgoto,
                                                          gordura/esgoto, fossa e outras caixas que forem
                                                          adicionadas

  Dedetização                          dedet              Dedetização simples, completa, foco em praga
                                                          específica, e Dedetização/Desratização (serviço
                                                          combinado)

  Desratização                         desr               Somente controle de roedores


Regras:




                                                                                                             Page 3 of 14
Especificação do sistema de Ordens de Serviço da Ddtrix




       "Dedetização/Desratização" é dedetização (usa o modelo de dedetização, campo
       Praga(s) Alvo preenchido com o texto combinado). Nunca confundir com
       desratização isolada.
       Qualquer tipo de caixa cai em caixas .
       A classificação é automática pelo serviço descrito na agenda. Se o serviço for
       ambíguo (ex.: só "limpeza"), perguntar.
       Manter também o texto exato do serviço como aparece na agenda (ex.: "Limpeza de
       caixa de gordura"), que vai para a O.S.
       Novas modalidades devem poder ser cadastradas sem programar.


6. Cadastro e histórico de clientes
Cadastro permanente, compartilhado, com:

       nome;
       endereço completo (rua e número), bairro e cidade (padrão Sorocaba/SP), podendo
       ter vários endereços por cliente;
       telefones;
       pontos de referência;
       histórico de serviços realizados;
       observações importantes.

Reconhecimento: quando um cliente já cadastrado aparece numa nova agenda (comparar
nome normalizado, sem acento e sem maiúsculas, com tolerância a pequenas variações, e
telefone quando houver), o sistema o reconhece e aproveita os dados existentes, sempre
mostrando "Cliente reconhecido: X" para confirmação.

Divergência de endereço: se o endereço da agenda difere do salvo, mostrar um alerta
com os dois e perguntar qual está correto (usar o novo só nesta O.S., salvar como novo
endereço, ou manter o antigo). Não substituir nada automaticamente.


7. Interpretação inteligente de agendas
O usuário cola uma agenda inteira, mesmo com vários clientes, no formato bagunçado de
mensagens do WhatsApp (com horários de envio, nomes de quem mandou, emojis,
abreviações). A IA deve:

   1. Separar cada atendimento.
   2. Extrair por atendimento: nome do cliente, data, horário, serviço, endereço (rua,
      número, bairro, cidade), telefone se houver, observações e forma de pagamento se
       houver.



                                                                                        Page 4 of 14
Especificação do sistema de Ordens de Serviço da Ddtrix




   3. Classificar o serviço (seção 5).
   4. Preservar o texto original de cada observação.
   5. Gerar uma O.S. independente por cliente.

Requisitos técnicos:

       A IA devolve JSON estruturado (validar com schema). Cada campo vem com o trecho
       do texto original de onde foi tirado ( origem ), para o usuário conferir.
       Campo ausente = null e entra na lista de pendências. Nunca preencher por
       suposição.
       Datas relativas ("amanhã", "sexta") são resolvidas usando a data de hoje enviada no
       prompt (fuso America/Sao_Paulo).
       Horário aceita "14h30", "14:30", "às 8", "de manhã/tarde" (se for período vago, manter o
       texto como veio, ex.: "Tarde", e sinalizar).
       Se dois dados se contradizem, devolver uma pergunta em vez de escolher.
       Pedidos de alteração pontual ("altere só o horário para 15h") devolvem apenas o
       campo alterado.
       Ter um interpretador simples de reserva por regras (como no protótipo) para quando
       a IA estiver fora do ar, avisando que a leitura foi simples.
       Pedir ao dono 3 a 5 agendas reais (com dados anonimizados) para criar testes de
       verdade.


8. Modelos de O.S. e preenchimento
Existem três modelos .docx, um por categoria: OS_Limp_Cx.docx (caixas), OS_DDT.docx
(dedetização) e OS_DSR.docx (desratização). Têm cabeçalho fixo da empresa (CEVS,
CNPJ, endereço, telefone, e-mail), número da O.S., bloco Informações do Cliente, bloco
Informações do Serviço, bloco de produtos químicos (dedet e desr), observações,
responsável técnico e linhas de assinatura.


Campos que o sistema preenche

  Campo                                  Onde está no modelo

  Validade (CEVS)                        Topo: "DATA DE VALIDADE" (hoje 10/11/2026 nos
                                         três modelos)

  Nº da O.S.                             "ORDEM DE SERVIÇO NÚMERO"

  Data                                   "Data da execução"

  Horário                                "Hora início:"



                                                                                         Page 5 of 14
Especificação do sistema de Ordens de Serviço da Ddtrix




  Campo                                  Onde está no modelo

  Cliente                                Campo Cliente

  Rua e número                           Campo Endereço do bloco do cliente

  Bairro                                 Campo Bairro (ou Bairro/Cidade)

  Cidade/UF                              Campo da cidade

  Endereço completo                      Linha "Endereço:" do bloco Informações do Serviço

  Serviço                                "Praga(s) Alvo:" (dedet e desr) ou "SERVIÇO:"
                                         (caixas)

  Observações                            Campo "Observações:" (hoje vazio nos três
                                         modelos)


O endereço aparece em dois lugares: fragmentado nos campos estruturados e completo,
em linha contínua, na linha do bloco de serviço. Preencher os dois sempre.

Tudo que não é campo (garantia, produto químico, diluição, instruções de acidente,
responsável técnico, CREA, telefone de intoxicação, assinaturas, "Valor Total: Contrato"
no modelo de desratização) não pode ser alterado. A garantia varia por modelo (3 meses
em dedet e desr, 6 meses em caixas).


Como o protótipo preenche (reaproveitar)
       Cada campo é localizado pelo texto de exemplo que está no modelo e pela ocorrência
       (n-ésima vez que o texto aparece). Exemplo: a cidade "Sorocaba/SP" aparece no
       cabeçalho (1ª) e no bloco do cliente (2ª), então o campo cidade usa a 2ª.
       O texto do Word vem quebrado em vários trechos (runs). A troca concatena o texto
       do parágrafo, acha a posição, escreve o novo valor no primeiro trecho envolvido e
       limpa o resto, mantendo a formatação.
       As posições de todos os campos são localizadas no documento original antes de
       qualquer troca, e as trocas são aplicadas de trás para frente. Isso evita que um valor
       novo (ex.: um cliente chamado "Condomínio Campolim") seja confundido com o texto
       de exemplo de outro campo.
       As fontes embutidas dos .docx (cerca de 3,5 MB) foram removidas dos modelos
       guardados, porque Arial e Cambria existem em qualquer computador.
       Os textos de exemplo atuais estão no protótipo (objeto BASE , campo fields ) e
       devem ser migrados para o banco.




                                                                                             Page 6 of 14
Especificação do sistema de Ordens de Serviço da Ddtrix




Observações e pagamento
       Colocar cada observação, inteira, no campo "Observações:" da O.S. correspondente.
       O modelo hoje não tem linha de pagamento. Propor onde inserir (sugestão: nova linha
       logo após "Observações:") e confirmar com o dono antes de alterar os modelos.
       Pagamento:
              Dinheiro ou Pix: registrar a forma de pagamento.
              Crédito ou débito: registrar a forma e acrescentar o aviso LEVAR A MAQUININHA
              em vermelho.
              A linha do pagamento fica destacada em amarelo (realce do Word).
              Se a agenda não disser a forma, não escrever nada e não inventar.
       Isso exige inserir parágrafos e trechos formatados no XML, algo além da simples troca
       de texto do protótipo.


Número da O.S. (ponto em aberto)
Os números atuais seguem padrões diferentes (por exemplo 202605686N , 20261105CA ,
 20251110 ). Perguntar ao dono qual é a regra (data + sequência + letra da categoria?) e
implementar numeração automática sem repetição. Até lá, campo editável.


9. Ajuste automático para uma folha A4
       Toda O.S. deve caber em uma única folha A4.
       Se as observações forem longas: reduzir a fonte aos poucos (com piso de legibilidade,
       por exemplo não abaixo de 7 pt) e depois ajustar espaçamentos entre linhas e
       parágrafos.
       Medir o resultado renderizando o documento (contar páginas). Se mesmo no limite
       não couber, mostrar aviso claro e nunca cortar texto nem deixar ilegível.
       Mostrar na pré-visualização o tamanho de fonte aplicado e o aviso, quando houver.


10. Várias O.S. de uma vez (lote)
Ao colar uma agenda com vários clientes, o sistema mostra uma lista com todas as O.S.
identificadas e permite:

       conferir e editar cada atendimento individualmente;
       ver pendências e alertas de cada um (dado faltando, divergência de endereço, cliente
       novo);
       selecionar uma, várias ou todas;
       gerar PDFs individuais;



                                                                                       Page 7 of 14
Especificação do sistema de Ordens de Serviço da Ddtrix




       gerar, se possível, um PDF único com todas as O.S. selecionadas (uma por página A4),
       e também baixar tudo em ZIP.


11. Pré-visualização e confirmação
Antes da geração definitiva, mostrar como cada O.S. vai ficar (renderização do
documento) ao lado dos dados interpretados, com a possibilidade de corrigir qualquer
campo. Uma O.S. com pendência não pode ser emitida enquanto não houver correção ou
confirmação.


12. Histórico e compartilhamento
Histórico central e compartilhado, com:

       busca por cliente, data, categoria e serviço;
       consulta de O.S. anteriores e dos serviços feitos para cada cliente;
       abrir e baixar PDF;
       reutilizar dados de uma O.S. anterior para uma nova;
       compartilhar pelo WhatsApp (compartilhamento nativo do celular com o PDF, ou link
       para o arquivo);
       imprimir direto.

Uma O.S. emitida guarda o snapshot dos dados e a versão do modelo usada, então
mudanças futuras em modelos ou cadastros não alteram O.S. já emitidas.


13. Duas áreas do sistema
Área operacional (uso diário): colar agendas, interpretar, identificar clientes, conferir e
editar O.S., gerar PDFs, consultar histórico e clientes.

Área administrativa: gerenciar modelos de O.S. (importar, substituir, versionar, voltar a
uma versão antiga), mapear e testar os campos de cada modelo, configurar categorias e
modalidades de serviço, configurações gerais (dados fixos da empresa, validade do CEVS,
cidade padrão, regras de numeração, tamanho mínimo de fonte) e consultar o histórico de
alterações (quem mudou o quê e quando). Como não há permissões por usuário, a área
administrativa pode ter uma segunda senha simples, a definir com o dono.




                                                                                       Page 8 of 14
Especificação do sistema de Ordens de Serviço da Ddtrix




14. Modelos editáveis e versionados
        Importar um novo .docx, mapear os campos (texto de exemplo e ocorrência, com
        campos não encontrados destacados em vermelho), testar com dados falsos e só
        então marcar como oficial.
        Guardar todas as versões e permitir voltar a uma antiga.
        Ao importar uma versão nova, copiar o mapeamento de campos da versão oficial como
        ponto de partida, porque o layout deve mudar pouco.
        O dono vai atualizar o layout da O.S. em breve. Trocar o modelo nunca pode exigir
        reprogramar o sistema.
        Atenção: o texto de validade do CEVS (10/11/2026 nos modelos atuais) precisa ser
        atualizado quando for renovado. Tratar como configuração geral, não como texto
        perdido no modelo.


15. Modelo de dados (Postgres)
   create table clientes (
        id uuid primary key default gen_random_uuid(),
        nome text not null,
        nome_normalizado text not null,
        telefones text[] default '{}',
        observacoes text,
        criado_em timestamptz default now(), criado_por text,
        atualizado_em timestamptz default now()
   );
   create table cliente_enderecos (
      id uuid primary key default gen_random_uuid(),
        cliente_id uuid references clientes on delete cascade,
        rua text not null, bairro text, cidade text default 'Sorocaba/SP',
        referencia text, principal boolean default false
   );
   create table categorias_servico (
     codigo text primary key,          -- caixas | dedet | desr
     nome text not null, palavras_chave text[], ativa boolean default true
   );
   create table modelos (
        id uuid primary key default gen_random_uuid(),
        categoria text references categorias_servico, nome text not null
   );
   create table modelo_versoes (
      id uuid primary key default gen_random_uuid(),
        modelo_id uuid references modelos on delete cascade,
        numero int not null, arquivo_path text not null,




                                                                                       Page 9 of 14
Especificação do sistema de Ordens de Serviço da Ddtrix




        campos jsonb not null,                            -- [{k, texto_exemplo, ocorrencia}]
        oficial boolean default false, notas text,
        criado_em timestamptz default now(), criado_por text
   );
   create table agendas (
     id uuid primary key default gen_random_uuid(),
     texto_original text not null, criado_em timestamptz default now(),
   criado_por text
   );
   create table ordens (
      id uuid primary key default gen_random_uuid(),
        numero text, agenda_id uuid references agendas,
        cliente_id uuid references clientes,
        categoria text references categorias_servico,
        servico text, data_execucao date, hora text,
        rua text, bairro text, cidade text,
        observacoes text, pagamento_forma text,
        status text default 'rascunho',   -- rascunho | confirmada | emitida
        modelo_versao_id uuid references modelo_versoes,
        dados jsonb not null,             -- snapshot completo
        pdf_path text,
        criado_em timestamptz default now(), criado_por text
   );
   create table auditoria (
      id bigserial primary key, quando timestamptz default now(), quem text,
        acao text, entidade text, entidade_id uuid, antes jsonb, depois jsonb
   );
   create table configuracoes (chave text primary key, valor jsonb);


Todas as tabelas com RLS ligado, acessíveis só para a conta empresarial autenticada. Toda
alteração de cadastro, modelo ou O.S. grava uma linha em auditoria com o nome
informado em "Quem está usando?".


16. Interface
        Português do Brasil, simples e rápida, pensada para celular e computador.
        Tela inicial operacional: caixa grande para colar a agenda, botão Interpretar, lista de
        O.S. identificadas com status (ok, pendência, alerta).
        Menu: Emitir, Clientes, Histórico, Administração.
        Mensagens de erro claras e sem termos técnicos.




                                                                                                Page 10 of 14
Especificação do sistema de Ordens de Serviço da Ddtrix




17. O que já existe e deve ser preservado
Protótipo em um único arquivo ( gerador-os-ddtrix.html ), publicado dentro do Claude,
que já faz:

       colar uma mensagem e interpretar com IA (com leitura de reserva por regras);
       formulário com categoria, serviço, cliente, data, horário, rua, bairro, cidade e nº da O.S.;
       preenchimento fiel dos três modelos .docx (testado), com o endereço nos dois
       lugares;
       pré-visualização, download em .docx e impressão;
       histórico simples e reutilização de dados;
       administração com importação de novos modelos, versões, teste, tornar oficial e
       edição dos campos.

Limitações dele, que o novo sistema resolve: dados só no navegador de cada aparelho,
uma mensagem por vez, sem cadastro de clientes, sem PDF nativo, sem observações e
pagamento, sem ajuste para A4 e sem login próprio.

O Claude Code deve portar essa lógica (principalmente a função de preenchimento do
.docx e a gestão de versões de modelo) em vez de reescrever do zero.


18. Plano de construção por fases
   1. Base: projeto, login único, banco local de desenvolvimento, tela "Quem está usando?",
       auditoria.
   2. Modelos e preenchimento: migrar os três modelos e os campos, motor de
       preenchimento no servidor, testes automáticos que comparam o XML antes e depois
       (só os campos mudaram).
   3. Clientes: cadastro, múltiplos endereços, reconhecimento e alerta de divergência.
   4. Agenda com IA: interpretação de uma e de várias mensagens, JSON validado,
       pendências, testes com as agendas reais.
   5. Observações, pagamento e A4: inserção formatada, cores, ajuste de fonte e aviso.
   6. Lote e PDFs: lista, seleção, PDF individual, PDF único, ZIP, compartilhamento por
       WhatsApp.
   7. Histórico e administração: busca, versões de modelo, configurações, histórico de
       alterações.
   8. Publicação: só depois da aprovação do dono, com a lista de contas e custos já
       explicada (seção 4).

Cada fase termina com testes e uma demonstração rápida antes de seguir.




                                                                                           Page 11 of 14
Especificação do sistema de Ordens de Serviço da Ddtrix




19. Critérios de aceite
       Duas pessoas em aparelhos diferentes veem o mesmo cliente cadastrado, quase em
       tempo real.
       Colar uma agenda com 10 clientes gera 10 O.S. corretas, sem inventar dados e com
       observações idênticas ao original.
       "Altere só o horário" muda apenas o horário.
       Endereço divergente gera alerta e nunca é sobrescrito sozinho.
       Pagamento em cartão mostra LEVAR A MAQUININHA em vermelho e a linha em
       amarelo; sem forma informada, nada é escrito.
       Toda O.S. cabe em uma A4 ou mostra aviso claro.
       Trocar o modelo pela área administrativa funciona sem mexer no código, e voltar à
       versão anterior também.
       Nenhuma chave secreta aparece no navegador.


20. Perguntas que o Claude Code deve fazer ao dono antes de
começar
   1. Qual é a regra de numeração das O.S.?
   2. Onde inserir pagamento e observações nos modelos (e como o novo layout vai ficar)?
   3. Pode enviar 3 a 5 agendas reais de WhatsApp (dados anonimizados)?
   4. Qual hospedagem e qual plano de banco o dono aprova, com o custo mensal em vista?
   5. A área administrativa terá senha própria?
   6. A validade do CEVS foi renovada? (vence em 10/11/2026 nos modelos atuais)

21. Identidade visual e interface do aplicativo

Quero reformular a interface visual do aplicativo para que ela tenha uma identidade
própria, alinhada à marca da Ddtrix.

Vou disponibilizar a imagem da logo da empresa como referência. Quero que você utilize
essa logo para desenvolver uma identidade visual coerente, aproveitando suas cores e
características para definir a aparência do sistema.

Objetivo visual:

Quero uma interface moderna, elegante, profissional e agradável de utilizar. Não quero
algo visualmente carregado, exagerado ou com muitos elementos desnecessários. A
prioridade é unir beleza, simplicidade e facilidade de uso.

Diretrizes de design:

       Utilizar as cores da logo da Ddtrix como base da identidade visual.


                                                                                     Page 12 of 14
Especificação do sistema de Ordens de Serviço da Ddtrix




       Criar uma paleta de cores harmoniosa, com cores principais, secundárias e neutras.
       Utilizar fundo claro e limpo, com bom contraste e leitura confortável.
       Criar botões modernos, com aparência consistente e fácil identificação.
       Utilizar ícones simples e elegantes.
       Organizar as informações em cartões e seções bem distribuídas, sem excesso de
       caixas ou bordas.
       Utilizar uma tipografia moderna, profissional e de fácil leitura.
       Criar uma hierarquia visual clara entre títulos, informações, campos e ações.
       Utilizar animações discretas e transições suaves, somente quando contribuírem para
       a experiência.
       Evitar excesso de sombras, gradientes, efeitos e elementos decorativos.

Organização da interface:

Quero uma tela inicial bonita e objetiva, com acesso rápido às principais funções:

       Emitir O.S.
       Interpretar agenda
       Clientes
       Histórico
       Administração

A área de emissão de O.S. deve ser especialmente prática, com destaque para o campo de
colagem da agenda e para o botão de interpretação.

As listas de clientes e Ordens de Serviço devem ser organizadas, fáceis de consultar e
visualmente agradáveis.

Responsividade:

A interface precisa funcionar muito bem tanto em computadores quanto em celulares. No
celular, os elementos devem se adaptar à tela, sem ficar apertados, sobrepostos ou exigir
rolagem horizontal.

Desempenho:

Um requisito muito importante é que o aplicativo continue leve e rápido.

Evite bibliotecas visuais desnecessárias, imagens pesadas, efeitos excessivos e
animações que prejudiquem o desempenho.

Referência visual:

Utilize a logo que vou enviar como principal referência para desenvolver a identidade
visual. Quero que o resultado pareça um sistema profissional desenvolvido especialmente
para a Ddtrix, e não um painel genérico.


                                                                                       Page 13 of 14
Especificação do sistema de Ordens de Serviço da Ddtrix




Antes de implementar, apresente uma proposta visual das telas principais para que eu
possa aprovar a aparência. Depois da aprovação, aplique o mesmo padrão visual em todo o
aplicativo.

Importante: essa mudança deve afetar somente a interface e a experiência visual, sem
prejudicar as funcionalidades, regras de negócio ou estruturas já especificadas
anteriormente.




                                                                                  Page 14 of 14
