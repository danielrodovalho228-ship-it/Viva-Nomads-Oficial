# E777 — preço, selos e totais: uma vez só no código

Auditoria (08–09/11/2026), só código:
- **Regra de composição do total** (valor mensal + condomínio + consumo fixo + limpezas/pet): já era única em `src/lib/precos.ts` (`calcularTudoIncluido`, `precoDoImovel`, `estadiaDoImovel`), usada por cartão, pino do mapa, detalhe, barra fixa, reserva e e-mails. Nada a mover.
- **Resumo "R$ X em N meses"**: estava escrito à mão em 5 lugares (`cartao-preco.ts`, `cartao-estadia.ts`, `barra-fixa-imovel.ts`, `reserva-imovel.ts` ×2) e no JSX do `price-card.tsx`. Agora é `resumoEmMeses(total, meses)` em `cartao-preco.ts` (singular "em 1 mês"), e um teste (`e777-preco-unico.test.ts`) falha se alguém escrever outra cópia.
- **Nível/selos**: o rótulo vem de `ROTULO_NIVEL` (`lib/niveis`) e o selo de foto de `selos-foto.tsx`; sem cópias a unificar.
- **Fora do escopo (não mexi):** `propostas/regras.ts`, `contrato-assinar.ts` e `estadia-em-dias.ts` calculam totais de proposta/contrato (outras regras, com limpezas do mês) — unificar com `precos.ts` é decisão de produto, não de texto.
