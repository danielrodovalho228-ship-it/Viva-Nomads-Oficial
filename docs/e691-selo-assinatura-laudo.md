# E691 — emissão/assinatura do laudo no painel do avaliador (auditoria E683, P8)

**Achado:** a emissão e a assinatura já existem no painel do avaliador (`/dashboard/parceiro/avaliacao/[pedido]`: revisão do resultado, caixa "Assino este laudo…", botão "Enviar o laudo" → `enviarLaudo` → `emitirLaudo` grava `assinado_em`, `assinatura_hash`, `assinatura_termo`). O que faltava: o avaliador e o dono **não viam** o número com o hash — só a página pública prometia.

**Correção (só UI, sem migração):** componente `SeloAssinatura` (número + versão, data/hora de Brasília, hash curto e hash inteiro selecionável) no painel do avaliador (depois de emitir) e no bloco do laudo do dono. Pura: `seloDaAssinatura` / `hashCurto` em `telas-laudo.ts`. Laudo sem assinatura (anterior ao E648) não mostra selo.

**Atrás de VISTORIA_ATIVA:** as duas telas só existem com a chave ligada (continua desligada).

**Dúvida:** o hash mostrado é o `assinatura_hash` (assinatura do avaliador). O hash do PDF vive no registro do documento (`/conferir`); se quiserem os dois no selo, é um acréscimo.

Testes: `src/lib/vistoria/e691-selo-assinatura.test.ts`. Sem prova ao vivo.
