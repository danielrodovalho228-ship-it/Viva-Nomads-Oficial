# E1010 — t21 "Moacir gerente": a trilha "ver como apurei" aberta fechava sozinha

**Sintoma (corridas de 16 e 17/11, 4/7):** `passo-gerente` com "Moacir → Viva:" encontrado, mas **oculto** (está dentro de um `<details>` fechado); passa na nova tentativa.

## Causas (lab, 18/11)

1. **Produto.** Ao enviar a pergunta, a tela mostra na hora a pergunta, os passos e a resposta como mensagens otimistas (ids `p-`/`t-`/`r-`); logo depois o `reler()` traz as gravadas (ids do banco) e o `mesclarConversas` descarta as otimistas. A trilha usava `key={g.itens[0].id}`: a troca `t-…` → id gravado mudava a chave, o React remontava o `<details>` e **a trilha que o Daniel acabou de abrir voltava fechada**. Correção: `chavesEstaveis()` (agente, papel, texto + ordem entre as iguais, a mesma regra de igualdade do `mesclarConversas`) dá a cada mensagem uma chave que sobrevive à troca de id, e `chavesDosGrupos()` dá à trilha a chave da mensagem anterior a ela (a pergunta). Assim nem a troca de id nem um passo que entra na frente do grupo (o "Retorno" de uma execução, que também é passo na conversa do Moacir) remontam a trilha aberta.
2. **Teste.** A conversa do admin já traz as perguntas anteriores (outros testes, nova tentativa). O teste abria `trilha-gerente.last()` e lia a bolha `.last()` logo depois do Enviar, antes de a resposta nova chegar: abria/lia a da pergunta anterior. Agora espera a resposta desta pergunta e a trilha nova da consulta, escolhida pelo conteúdo ("Moacir → Viva:" e "Viva: Tenho N chamado"): o caso "Retorno" do mesmo spec, em paralelo, grava um passo na conversa do Moacir que podia virar a última trilha da tela.
3. **Teste.** Com workers em paralelo, outro teste abre um chamado ao mesmo tempo (lab: VN-000162 aqui, VN-000163 no outro); o Moacir responde, certo, pelo **mais novo**. A asserção passou de "cita exatamente o nosso número" para "cita o nosso ou um chamado aberto depois dele" (ver "Asserções alteradas" no PR).

## Provas

- Unidade, `src/lib/agentes/painel.test.ts`: 3 testes novos `E1010 …` (chavesEstaveis ×2, chavesDosGrupos) — vermelhos sem as funções, verdes com elas (pass 18, fail 0).
- E2E na main (1 worker, `--repeat-each=5`): 1 falhou, 4 passaram (passo da trilha não visível).
- E2E no ramo (laboratório recompilado com 7b2081b8e):
  - caso do Moacir, 1 worker, `--repeat-each=10`: 10 passed;
  - t21 inteiro, 2 workers, 4 rodadas com o histórico recente do laboratório limpo (como o banco novo do CI): 11/11 em cada (44/44).
- Cuidados do laboratório para repetir: as rodadas gastam o limite de 60 perguntas/dia do chat, o de disparos (`limites_uso` `agentes-%`) e a trava de "ordem igual em 2 h"; entre rodadas é preciso zerar isso, senão "Executar agora" e "Chat tipo WhatsApp" caem por limite (não por este item).

Fora do escopo: 3 cópias do mesmo teste conversando ao mesmo tempo com o Moacir na MESMA conta misturam as trilhas umas das outras (cenário que não existe na suíte; como no E1011 com 4 workers).
