# E690 — massa: avaliador de teste UDI-002 ativo (migração 0331)

**Decisão:** pedido do coordenador (08/11/2026) de ter um avaliador de teste ATIVO e exercitável para a prova do E682.
Isso substitui a leitura conservadora do levantamento (`docs/e690-avaliador-teste-etapa5.md`, #3330), que deixava a ativação para o admin com AAL2.

## O que a 0331 faz (só dado, idempotente)
`avaliadores_credenciamento` do **UDI-002**: `em_teste → ativo`, `ativado_em`, `decidido_em`, motivo "Massa de teste E690: ativado por migração (conta is_teste), sem decisão de admin."
Só entra se: conta do avaliador `is_teste` **e** status ainda `em_teste` **e** avaliação de teste concluída (`vistoria_pedidos.teste` + `laudo_emitido`, a mesma condição da tela do admin).
Não toca UDI-001 (suspenso), contas reais, chaves (`AUTOMACOES_ATIVO`, `VISTORIA_ATIVA`) nem outras tabelas. `decidido_por` fica vazio: nenhum admin decidiu, e o registro diz isso.
`supabase/producao/aplicar-0331.sql` (registra `20261107000331`) + rollback que só desfaz o que a própria 0331 fez.

## O que isto NÃO é
Não passa pelo AAL2 do admin. O risco que o E30 fechou ("Ativo" sem passar pelo admin) fica limitado a uma conta `is_teste`, com motivo gravado. O merge do PR é a aprovação.

## E691 — laudo assinado de teste: NÃO gerado por SQL
Com o UDI-002 ativo, o pedido `a0256000-…-0a2` (designado, `teste=true`) já está pronto para o avaliador responder. O laudo assinado nasce no envio pelo painel (caixa "assino": hash + termo calculados pelo app). Gravar `assinatura_hash` por SQL criaria uma evidência que o fluxo nunca produziu e invalidaria a prova do E691. Quem exerce o fluxo é a QA (laboratório, `VISTORIA_ATIVA` por cookie `vn_lab_vistoria`, nunca em produção).

## Conferência (só leitura)
```sql
select numero_credenciado, status, ativado_em from avaliadores_credenciamento where numero_credenciado in ('UDI-001','UDI-002');
```
Antes: UDI-002 `em_teste`, sem `ativado_em`. Depois da 0331: `ativo` com `ativado_em`.
Teste: `src/lib/qa/massa-avaliador-udi002-ativo-e690.test.ts`. Sem prova ao vivo.
