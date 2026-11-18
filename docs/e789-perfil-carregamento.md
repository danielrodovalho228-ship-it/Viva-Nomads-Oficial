# E789 — Conta/Perfil com cartões brancos vazios antes dos dados

**Devolução do julgamento (11/11):** a correção anterior estava verde, mas não provava que a espera tinha sumido. Pedido: medir o tempo até o primeiro conteúdo útil.

## Causa
A página `/dashboard/conta/[secao]` era de cliente. Na tela de Perfil, o HTML chegava com o esqueleto. Depois disso, o navegador pedia o perfil e os dados por Server Action, e o Next enfileira essas ações uma atrás da outra.

## Correção
A página passou a ser de **servidor**:
- O Perfil lê o perfil e os dados (`getPerfilInicial`) antes da primeira pintura e entrega tudo à `PerfilTela`.
- A tela já nasce preenchida e não pede nada do navegador.
- Se a leitura no servidor falhar, a tela volta à leitura do navegador, com "Tentar de novo" (achado 70).

## Medição
Spec `t1601`, no mesmo laboratório (`lab-critico`): tempo do início da navegação até o nome aparecer no campo.

| | 390 px | 1280 px | Server Actions antes do conteúdo |
|---|---|---|---|
| Antes (código da main, commit `c0ee2ee2d`) | 2.434 / 2.665 ms | 2.840 / 2.929 ms | 8–11, entre elas a leitura do perfil |
| Depois (commit `587b947e2`) | 751 / 983 ms | 1.459 / 1.035 ms | 3–4 do painel; nenhuma com os dados do perfil (conferido pelo teste no commit seguinte) |

## O que sobra (fora do escopo do E789)
O `AuthGuard` do painel inteiro desenha, no servidor e no primeiro quadro, só o esqueleto `auth-guard-carregando`. Ele libera o conteúdo depois que o navegador confere a sessão. É isso que ainda separa a resposta do conteúdo desenhado (cerca de 0,75 a 1,5 s no laboratório) em **todas** as telas do painel.

Mudar isso significa desenhar as telas do painel no servidor com a sessão conferida lá. Isso mexe em todo o painel e no risco de diferenças de hidratação. Fica como proposta para um item próprio.
