# Achado 180 — aprovarSugestao: leitura que falha não vira "sugestão não encontrada"

`aprovarSugestao` ("Aprovar e enviar" a resposta sugerida pela Viva em um chamado) lia a nota da IA em
`chamado_mensagens` sem olhar o `error`. Uma leitura falha virava "Sugestão não encontrada neste chamado.", e a equipe
podia descartar uma sugestão que existia. Agora a leitura com erro responde "Não foi possível ler a sugestão agora. Tente
de novo." antes de qualquer "não encontrada" e antes de enviar a resposta.

Teste: `src/lib/data/achado180-leitura-aprovar-sugestao.test.ts` (escrito antes, visto vermelho). Sem migração, sem chave,
sem prova ao vivo.
