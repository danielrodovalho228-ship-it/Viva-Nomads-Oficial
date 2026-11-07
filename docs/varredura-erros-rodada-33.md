# Varredura de erros — rodada 33 (achados 153–155)

Padrão: leitura que falha não pode virar "não encontrado". Cada ponto agora lê o `error` e devolve
"Não foi possível ler … agora. Tente de novo." ANTES do "não encontrado".

| # | Arquivo | Tabela | Antes |
|---|---------|--------|-------|
| 153 | `src/lib/data/emitidos-actions.ts` (reenviar e-mail) | documentos_registro | falha → "Documento não encontrado." |
| 154 | `src/lib/data/agentes-actions.ts` (aceitar/reabrir ordem) | agentes_ordens | falha → "Só quem criou a ordem aceita ou reabre." |
| 155 | `src/lib/data/agentes-actions.ts` (nova ordem) | agentes | falha → "Agente não encontrado." |

Teste: `src/lib/data/achado153-155-leitura-admin.test.ts` (escrito primeiro, visto vermelho 0/3, agora 3/3).
Escopo (data + agentes): 188/188; `tsc` limpo.

Restam fora: `vistoria/actions.ts` (4) e `vistoria/laudo-actions.ts` (1) — VISTORIA_ATIVA desligada, sem usuário.
Com isso a varredura das leituras silenciosas voltadas a pessoas está encerrada, salvo as da vistoria.
