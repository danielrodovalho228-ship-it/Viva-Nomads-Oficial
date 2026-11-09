# Evidência do Superpowers — Pista C (E778)

Escopo: o que esta pista (laboratório/varredura) fez entre 08/11 19h e 09/11 00h30, medido contra as "regras da casa" do CLAUDE.md.
Honestidade: **nesta janela da sessão não houve chamada explícita à ferramenta `Skill` do plugin**; a evidência abaixo é de prática e está
ligada a runs e PRs, não a um log de skill. Se o coordenador quiser o log de invocação de skills, ele precisa vir da telemetria do plugin.

| Regra da casa | O que a pista fez | Prova |
|---|---|---|
| 1. O prompt é a decisão; dúvida vai para o PR | Dúvidas registradas na seção "Dúvidas" de cada PR de spec e bloco; nenhuma pergunta bloqueou o trabalho | PRs #3538–#3542, #3544, #3546, #3548, #3553–#3554, #3558–#3559, #3562, #3564, #3567, #3570–#3572, #3575–#3576, #3581–#3582, #3587, #3590–#3592, #3600–#3601 |
| 2. Plano só na descrição do PR | Nenhum arquivo de plano no repositório; só relatório (`relatorio-pista-c-2026-11-08.md`) e evidências | `scripts/lab/` |
| 3. Nunca merge, nunca apagar ramo, nunca push na `main` | Zero merges, zero ramos apagados, zero pushes na `main`; todo PR em draft | histórico dos PRs |
| 4. Subagentes só em tarefa grande | Nenhum subagente usado nesta janela | — |
| 5. TDD, depuração sistemática, revisão e verificação | **Depuração sistemática:** cada vermelho foi lido no log antes de mexer (causa raiz, não tentativa): t1563 (marcador `laudo-assinatura` herdado), t1573 (simulador só em modo demonstração), t1574 (`total-junto-da-acao` é o total mensal do E528), t1577/t1578 (máscara antes do hífen; linha some sem dado), t1587 (`sp-aceite` não existe para visitante), run do E760 (infra: porta 54322). **Verificação:** nada foi dado como verde sem run id; `tsc` e os guardas de numeração/cobertura rodados antes de cada push. **TDD:** specs sobre draft nascem para falhar na `main` e passar com o draft (t1560–t1564, t1584–t1586) | runs 42520974587, 42533621122, 42534229148, 42536077552, 42538551226, 42534468214 |
| 6. AGENTS.md, vocabulário da casa, 3S | Sem migração, sem código de produto; escopo só `tests/e2e` e `scripts/lab` | diffs dos PRs |

Falhas da própria pista (para não esconder): 5 vermelhos por premissa errada de spec (t1563, t1573, t1574, t1577/t1578, t1587) — todos corrigidos em commit novo, nenhum
era defeito de produto. Nenhum achado L-110 até agora.
