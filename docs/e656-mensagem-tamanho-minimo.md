# E656 — recusa por tamanho não chama o arquivo de "documento inválido"

As três rotas de envio (`/api/upload/inquilino-doc`, `/triagem-vinculo`, `/documento`) respondiam, para arquivo abaixo de
10 KB: "Arquivo pequeno demais (mín. 10 KB) — parece não ser um documento válido." O tamanho não diz se o documento é
válido. Agora: `mensagemArquivoPequeno()` (upload-limits.ts) = "Arquivo pequeno demais: o tamanho mínimo é 10 KB. Envie um
arquivo maior." — só o tamanho e o caminho. O limite (10 KB) não mudou; a validação por tipo real segue em outra mensagem.
Teste: `src/lib/e656-mensagem-tamanho.test.ts` (visto vermelho antes). Escopo documento + upload: 110/110; `tsc` limpo.
