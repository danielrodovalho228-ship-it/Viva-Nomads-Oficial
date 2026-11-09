# Erros/estados vazios — rodada 14 (estadia)
Mesmo padrão das rodadas 9–13: leitura que falha não vira recusa nem "não encontrado".
- Instruções de chegada e de saída: erro ao ler o imóvel devolve "Não foi possível conferir os dados da estadia agora" (antes: "Só o proprietário edita…", que negava a quem é dono).
- Instruções por contrato: erro ao ler o contrato não vira "Contrato não encontrado".
- Aditivo: erro ao ler a proposta de aditivo não vira "Proposta não encontrada".
Teste: `src/lib/data/e293-leituras-estadia.test.ts`. Sem migração, sem prova ao vivo. `AUTOMACOES_ATIVO` intocado.

## CI (head do #3488)
`verify`, `e2e`, `lab-critico` e Vercel verdes (08/11, 15:55–15:59 UTC). Nenhuma falha a corrigir.
