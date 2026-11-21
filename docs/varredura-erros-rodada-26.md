# Varredura de erros — rodada 26 (06/11/2026)

Família das rodadas 21–25: a falha de leitura do banco não pode virar "vazio" calado.

## Achados
- **134 — pets do candidato** (`src/lib/data/leads.ts`, leitura de `pets_inquilino`): a falha virava "sem pets" na ficha do candidato; o dono decidiria sem ver o pet. Com `exigir` (tela Interessados), lança.
- **135 — contrato mais recente do candidato** (`leads.ts`, leitura de `contratos`): é essa leitura que tira da ficha o candidato de contrato encerrado ou cancelado; se falhava, a ficha continuava à vista. Com `exigir`, lança.

A tela Interessados já chama `listLeads({ exigir: true })` e mostra "Tentar de novo" (achado 5). Quem não pede `exigir` segue best-effort, como antes.

## Fora desta rodada (de propósito)
- Leitura de `profiles` (nome e foto) no mesmo cartão: a falha só tira nome/foto, não muda o que o dono decide.
- As demais ~350 leituras sem `error` de `src/lib/data` e `src/app`: são rotinas internas, escritas com guarda própria ou telas sem decisão em cima do dado. Uma varredura exaustiva é rodada à parte.

## Teste
`src/lib/data/achado134-135-ficha-candidato.test.ts` (3 casos, escritos antes e vistos vermelhos).
