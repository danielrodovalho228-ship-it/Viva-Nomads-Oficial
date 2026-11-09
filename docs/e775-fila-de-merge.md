# E775 — gate de merge: o CI testa a COMBINAÇÃO e só mescla com o gate completo verde

## Correção de premissa (09/11/2026)
A versão anterior deste documento dizia que a fila de merge nativa do GitHub funcionava em repositório público sem organização. **Está errado:** a fila só existe em repositório de **organização**; este é de conta pessoal. O ruleset com `merge_queue` não pode ser criado. O caminho adotado é a **fila própria / gate aprovado**, abaixo. Os gatilhos `merge_group:` e o nome estável `suite-completa` ficam nos workflows (inofensivos; valem se o repositório um dia for para uma organização).

## O problema que a fila resolvia
O CI de um PR testa o PR contra a main **do momento em que foi aberto/atualizado**. Dois PRs verdes podem quebrar a main juntos (conflito semântico): foi o que aconteceu com o #3505 (E727/E728) × E731/E651, que deixou a main vermelha. A regra é: **quem pousa na main já foi testado COM a ponta atual da main dentro.**

## O gate próprio (este PR)
1. **Script `scripts/gate/pode-mesclar.mjs <PR> [--com-suite]`** (só lê a API; nunca mescla). "PODE" só se: PR aberto, fora do rascunho, base `main`; a branch **contém a ponta atual da main** (`behind_by = 0`); e cada check exigido tem conclusão `success` **no head** (vale o mais recente de cada nome). Lógica pura e testada: `tests/laboratorio/gate-pode-mesclar.test.ts` (4).
2. **Workflow `gate-pode-mesclar.yml`** (`workflow_dispatch`, entrada: número do PR e se exige a suíte): roda o script com o `GITHUB_TOKEN` somente-leitura e escreve o veredito no resumo. É o que a rotina de merge chama antes de cada merge.
3. **Lista de checks exigidos em `scripts/gate/exigidos.json`:** hoje `verify` e `lab-critico`. `suite-completa` (o consolidar da suíte de 16 fatias, E744) entra com `--com-suite` **quando a suíte estiver verde na main** — antes disso ela está vermelha (falhas reais de teste ainda a triar, ver `docs/e744-suite-fatiada.md`) e exigi-la travaria todos os merges.

## Procedimento da rotina de merge (um PR por vez)
1. Rodar o gate no PR. Se "atrás da main": atualizar a branch com a main (merge, sem reescrever histórico) e **esperar o CI do novo head**.
2. Rodar o gate de novo. Só com "PODE": mesclar.
3. Depois de cada merge, os demais PRs ficam "atrás da main" e voltam ao passo 1. Isso serializa os merges — é o preço de não ter a fila nativa, e é o que evita a combinação não testada.

## O que depende de admin do repositório (o agente não tem essa permissão)
- **Proteção da `main`** (Settings → Branches → regra para `main`): exigir PR, exigir os checks `verify` e `lab-critico` e marcar **"Require branches to be up to date before merging"**. Isso faz o próprio GitHub bloquear o botão de merge de branch desatualizada, o mesmo que o gate faz por script.
- Depois que a suíte completa estiver verde na `main`: acrescentar `suite-completa` aos checks obrigatórios (rodar uma vez o laboratório por `workflow_dispatch` para o nome existir) e passar a chamar o gate com `--com-suite`.

## Limites conhecidos
- Sem um token que dispare workflows, a atualização automática de branch por Action não reroda o CI (push do `GITHUB_TOKEN` não dispara workflows); por isso a atualização da branch é feita pela rotina de merge, com as credenciais dela.
- O gate vê o estado de agora; entre o gate e o clique de merge a main pode andar. A proteção "up to date" do GitHub fecha essa janela.
