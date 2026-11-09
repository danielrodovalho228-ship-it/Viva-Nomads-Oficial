# E688 (parte Pista B) — Plano de manutenção volta a "Em breve"

Decisão do Daniel (08/11/2026): retirar a promessa da saída AquiResolve das superfícies. Só texto não basta: com `servicos_adicionais.status = 'ativo'` o morador ainda podia escolher o serviço.
- **0333 (só dado, idempotente):** `plano_manutencao` `ativo → em_breve`. Estado em produção antes: `ativo` (0015). `aplicar-0333.sql` registra `20261107000333`; rollback devolve `ativo`.
- **Código:** o catálogo de reserva `SERVICOS_ADICIONAIS` (`src/lib/guarantees.ts`) espelha o banco (`em_breve`); a tela do Fechamento já só deixa escolher `ativo`, então o item aparece desabilitado, como a Assistência 24h.
- **Texto:** não alterei (a parte de texto das superfícies é de outra pista).
- **Testes:** `src/lib/qa/e688-plano-manutencao-em-breve.test.ts` + `guarantees.test.ts` (atualizado: nenhum serviço selecionável) + catálogo, texto, migrações e estilo: 237 verdes; `tsc` limpo. O spec de lab t219 só confere nome e quem paga do plano (não o status). Sem prova ao vivo.
