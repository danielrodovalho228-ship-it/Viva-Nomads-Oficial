# E290 — revisão de segurança do link da visita por vídeo (01/11/2026)

**Escopo:** o link externo da chamada (Meet, Zoom, Teams, WhatsApp) que o proprietário informa ao confirmar uma
visita por vídeo, na `main` de 01/11 e no banco de produção, que só foi lido.

**Fora do escopo:**
- a fase 3 (prova de presença), que aguarda o parecer da Dra. Beatriz;
- qualquer mudança no desenho do link externo.

**Resultado:** nenhum vazamento para quem não é parte da visita, e nada fica visível antes da confirmação. Não houve
correção de código. Fica uma guarda permanente (`src/lib/visitas/e290-link-acesso.test.ts`) para os pontos de
acesso abaixo, que ainda não tinham teste.

## 1. Quem grava o link e com que forma

- O link só entra quando o **proprietário confirma** ou **propõe outro horário** numa visita **por vídeo**
  (`src/lib/visitas-video.ts:208`, dentro de `mudancaDeStatus`). Presencial nunca tem link.
- Formato aceito (`validarLinkChamada`, `src/lib/visitas-video.ts:106`):
  - só `https:`;
  - sem usuário ou senha na URL;
  - até 300 caracteres;
  - só os hosts de `HOSTS_CHAMADA` (`:99`): Meet, Zoom, Teams e chamada do WhatsApp. `wa.me` fica de fora porque
    expõe o número.
- Só o servidor grava, com a chave de serviço e depois de conferir que quem age é dono ou morador daquela visita
  (`src/lib/data/visitas-video-actions.ts:290`). O usuário não tem permissão de escrita na tabela.

## 2. Quem enxerga

| Caminho | Quem | Onde está a trava |
|---|---|---|
| Banco (PostgREST, sessão do usuário) | só o morador, o dono e o admin | política `visitas_video_ler` (`supabase/migrations/0148_visitas_video.sql:40`); `anon` sem nada; `authenticated` só com SELECT por coluna (`0148:34`, `0165:23`) |
| Lista do dono | só visitas dos imóveis dele | `listVisitasDono` filtra por `owner_id = sessão` (`visitas-video-actions.ts:216`) |
| Lista do morador | só as visitas dele | `listMinhasVisitas` filtra por `tenant_id = sessão` (`visitas-video-actions.ts:249`) |
| Cartão no topo da conversa | só o par dono e morador daquela conversa | `visitaDaConversa` exige (dono = eu e morador = o outro) ou o contrário (`visitas-video-actions.ts:356`), e só aceita UUID |
| Detalhe `/dashboard/visitas/<id>` | só as duas partes; quem não é parte recebe 404 | `visitaDetalhe` devolve `null` sem papel (`visitas-video-actions.ts:401`) |
| E-mail de confirmação | a outra parte | o texto leva só o tipo e o horário, **não leva o link** (`visitas-video-actions.ts:315`) |
| E-mail da véspera | só o morador e o dono | `for (const para of [v.tenant_id, v.owner_id])` (`src/lib/visitas/avisos-servidor.ts:178`); botão "Entrar na chamada" (`emails-e205b.ts:326`) |
| Agenda e painel de decisões | — | não leem a coluna `link_chamada` |

Conferido no banco de produção em 01/11:
- RLS ligada;
- a única política é SELECT para `authenticated` (morador, dono ou admin);
- nenhum grant de escrita.

## 3. A partir de quando aparece e até quando

- **Pedido:** não há link (`link_chamada` vazio).
- **Remarcar:** o dono informa o link junto com o novo horário. O cartão **não** mostra o link nesse estado; só mostra
  com o status `confirmado` (`src/components/visitas/cartao-visita.tsx:120`).
- **Confirmada:** o botão "Entrar na chamada" aparece desde a confirmação, que pode acontecer até 14 dias antes (`CONFIRMAR_ATE_DIAS`, `src/lib/visitas-video.ts:143`), até o
  horário mais 3 horas (`FOLGA_ENDERECO_MS`, `src/lib/visitas/endereco-visita.ts:8`;
  `cartao-visita.tsx:126`, E184).
- **Cancelada ou concluída:** o link é **apagado do banco** (`src/lib/visitas-video.ts:226`, E290). Em produção,
  nenhuma visita encerrada guarda link.

## 4. Reuso do mesmo link e efeito de um vazamento (riscos do desenho, sem mudança)

- **Reuso.** Nada impede o dono de usar a mesma sala fixa (por exemplo, a sala pessoal do Meet) em várias visitas.
  Quem já recebeu o link (pelo e-mail da véspera, ou copiado da tela) continua com uma sala que segue valendo, mesmo
  depois que a Viva apaga o link do banco. Em produção hoje: **nenhum link repetido entre moradores diferentes**.
- **Vazamento.** Quem tiver o link pode tentar entrar na sala no horário. A proteção é a sala de espera do provedor:
  o dono admite ou não quem entra. A Viva não controla isso, e o desenho é de link externo.
- **Confirmada que passou e não foi marcada como concluída.** O link continua no banco, legível só pelas duas partes
  e pelo admin. A tela esconde o link 3 horas depois do horário. Não vaza para terceiros.

## 5. Propostas (não executadas: mexem no desenho ou dependem de decisão)

1. Na hora de confirmar, um texto curto: "Use um link novo para cada visita, não a sua sala fixa".
2. Uma rotina que apague o link 3 horas depois do horário de uma confirmada não concluída (alinhado ao E293).
3. Prova de presença: é a fase 3, que aguarda o parecer.
