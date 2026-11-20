# E661 (apoio da Pista B) — campos da estrutura do condomínio

**Pedido:** Wi-Fi, recepção e fechadura **do condomínio** não tinham campo próprio (só o Wi-Fi do apartamento); o dono escrevia isso em "regras/contatos do prédio". A Pista A precisa de campos para o bloco "Estrutura do condomínio".
**O que entra:** quatro colunas nulas em `imovel_instrucoes_chegada` (migração **0317**): `condominio_wifi_rede`, `condominio_wifi_senha`, `condominio_recepcao`, `condominio_fechadura`. Mesmos limites e mesma regra das demais instruções: só o dono lê e grava (RLS da tabela), o morador recebe pelo servidor, liberadas 7 dias antes da entrada.
**Como a Pista A consome:** `CAMPOS_CONDOMINIO` (em `src/lib/estadia/instrucoes.ts`) lista as quatro chaves; `CAMPOS_INSTRUCOES` as inclui (rótulos "Wi-Fi do condomínio: rede/senha", "Recepção do condomínio", "Fechadura do condomínio"), então o editor do dono, a leitura do morador/convidado e o e-mail de chegada já mostram os campos sem mexer. Falta só agrupá-los em "Estrutura do condomínio" (no `InstrucoesEmBlocos` do #3114) lendo `CAMPOS_CONDOMINIO`.
**Fora:** exibir na página pública do imóvel (a instrução continua privada até D-7).
**Ordem de migração:** 0314 (E647, #2951), 0315 (E657, #3083), 0316 (E660, #3085), 0317 (este). Se um deles entrar antes, não há renumeração: cada um tem número próprio.
**Teste:** `src/lib/estadia/estrutura-condominio.test.ts`.
