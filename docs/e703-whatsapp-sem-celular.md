# E703 — WhatsApp "ligado" sem celular cadastrado

**Causa:** `getCanais` devolvia a preferência gravada (padrão: ligada) sem olhar se a conta tem celular. A tela mostrava "Ligado" para quem nunca informou número.

**Correção:**
- `getCanais` lê `phone`; sem celular válido (10+ dígitos) devolve `temCelular: false` e WhatsApp desligado.
- A tela desliga e desabilita o interruptor do WhatsApp e mostra o convite "Cadastre o seu celular para receber avisos no WhatsApp" com o link "Cadastrar celular" (`/dashboard/conta/perfil`).
- Regra pura em `src/lib/conta/tela-notificacoes.ts` (`canaisComDado`, `CONVITE_CELULAR_WHATSAPP`); a preferência gravada não é apagada.
- Textos de `CANAIS_AVISO` sem "via WhatsApp" repetido; linguagem direta.

**Testes:** `src/lib/conta/e703-whatsapp-sem-celular.test.ts` (+ guardas antigas ajustadas).
**Sem migração. `AUTOMACOES_ATIVO` intocado. Sem prova ao vivo (QA).**
