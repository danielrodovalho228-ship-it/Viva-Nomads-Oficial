# Achado 182 — propostas: leitura do lead que falha não vira outra resposta

Em `propostas-actions.ts`:
- `enviarProposta` lia `leads` sem olhar o `error`: a falha virava "Escolha um interessado da sua lista." (o dono achava que
  a candidatura não era dele).
- `aceitar` lia `leads` sem olhar o `error`: a falha virava "Esta candidatura não está mais em andamento." e o aceite era
  recusado por engano.

Agora cada leitura com erro responde "Não foi possível ler a candidatura agora. Tente de novo." antes de qualquer outra
resposta.

Teste: `src/lib/data/achado182-leitura-lead-proposta.test.ts` (escrito antes, visto vermelho). Sem migração, sem chave,
sem prova ao vivo.
