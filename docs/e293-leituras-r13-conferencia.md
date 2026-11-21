# Erros/estados vazios — rodada 13 (conferência de entrada/saída)
Mesmo padrão das rodadas 9–12: leitura que falha não vira "vazio".
- `estaFechada` virou `motivoFechada`: erro de leitura devolve "Não foi possível conferir o estado da conferência agora" (antes: contava como "ainda aberta" e a ação seguia até o banco recusar). Vale para as 4 ações que a usam.
- Anexo do laudo: erro ao ler o laudo existente não vira "sem laudo" (antes: "Não há laudo anexado para trocar" ou um segundo anexo).
Teste: `src/lib/data/e293-leituras-conferencia.test.ts`. Sem migração, sem prova ao vivo. `AUTOMACOES_ATIVO` intocado.
