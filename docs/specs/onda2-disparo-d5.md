# ONDA 2 — prova do disparo automático da limpeza em D-5 (Prompt 38)

Pista B · medição, não correção · sem migração. Situação em 24/10/2026.

## O caminho do disparo (código)

- Cron diário da Vercel `/api/cron/automacoes` (`vercel.json`, `0 13 * * *`, só em deploy de produção), com
  `Authorization: Bearer CRON_SECRET`. Chama `automacaoDaEstadia(admin, agora, simular)` (`src/lib/automacao/servidor.ts`).
- Mesmo passo na hora: Admin › Parceiros › Pedidos › "Rodar a automação de hoje" → `rodarAutomacaoAgora`
  (`src/lib/automacao/acoes.ts`) → a MESMA `automacaoDaEstadia`.
- Regra: contrato `ativo` com as duas assinaturas; saída = maior `fim` dos blocos válidos; dispara quando
  `hoje < saída ≤ hoje + 5` (Brasília). Limpeza/lavanderia com vínculo ATIVO → pedido automático (chave única por
  imóvel+categoria+contrato: a 2ª rodada não duplica). Sem limpeza vinculada → aviso único ao dono.
- Janela da limpeza: saída (`checkout_before`, padrão 11:00) + 2 h até + 48 h, ou até a próxima entrada se vier antes.

## Simulação × real — a chave

| Onde | Comparação | Efeito sem a chave |
|---|---|---|
| Cron (`src/lib/automacoes/regras.ts`, `modoSimulado`) | `AUTOMACOES_ATIVO !== "1"` → simula | só conta; não cria, não envia, não marca |
| Botão do admin (`src/lib/automacao/acoes.ts`) | real com `AUTOMACOES_ATIVO === "1"` ou no laboratório | idem |

Só o valor exato `"1"` liga. Vercel em 24/10: Production com o valor do Muse (`"on"`) → **produção simula**;
Preview `AUTOMACOES_ATIVO=1` (criada pela Pista B por decisão da coordenação, vale no próximo deploy de Preview);
Development sem a chave. Ligar em produção é decisão do Daniel.

## Evidências obtidas

1. **Laboratório — `t443` (PR #1310, rascunho).** Lab-critico verde no run 40134571312. Contas is_teste, Supabase
   local, `INTEGRACOES_SIMULADAS=on`, e-mails no LAB_OUTBOX. Mecanismo real (botão do admin → `automacaoDaEstadia`).
   - A (D+5, automático): 1 pedido à parceira de limpeza, `solicitado`, `automatico`, `saida_limpeza`, enviado,
     janela 13:00 do dia da saída → 11:00 de dois dias depois (Brasília); e-mail "Novo pedido de orçamento" à parceira.
   - B (D+6): nenhum pedido (fora da janela).
   - C (D+5, sem vínculo): nenhum pedido; "Saída em 5 dias: quer agendar a limpeza?" ao dono.
   - D (D+5, confirmar): pedido com `aguardando_dono=true`, sem envio; "Confirme o pedido de serviço do imóvel" ao dono.
   - Moradores: "Precisa de ajuda com a mudança?" (D-7 da saída). 2ª rodada: 0 pedidos e 0 e-mails novos.
2. **Leitura por dentro** (2ª versão do `t443`): o teste agora imprime e confere o corpo de cada e-mail (texto e
   destino do botão) e as 2 mensagens que o pedido abre no chat da parceira — boas-vindas + "Limpeza depois da saída
   do morador: entre DD/MM às 13:00 e DD/MM às 11:00." + "Serviço: Limpeza completa (a partir de R$ 250,00 por
   serviço)." Os e-mails do disparo não levam valor. O caminho D-5 não gera PDF.
3. **Produção (só leitura):** 0 vínculos ativos de limpeza, 0 pedidos automáticos, 2 contratos ativos assinados
   (is_teste), fora da janela. Nenhum dado criado.

## Achados de vocabulário (medidos, não corrigidos)

- `saida_sem_parceiro` diz sempre "o morador sai em 5 dias", mas o aviso pode sair de D-5 a D-1 (caso E do `t443`:
  saída em D+2 recebe "5 dias").
- `pedido_auto_confirmar` diz "Confira o valor-base"; com vínculo sem serviço não há valor-base.

## O que falta (bloqueios)

- **Preview não é ambiente de teste isolado:** usa o Supabase de produção e o Resend real (as mesmas variáveis em
  Production e Preview). Rodar o disparo no Preview grava pedidos em produção e passa por todos os contratos reais.
- **Botão do admin no Preview** exige login de admin; não há admin is_teste em produção (0). Sem credencial inventada.
- **Rota do cron no Preview** exige `CRON_SECRET` (não usado pela Pista B); a Vercel não agenda cron em Preview.
- Para destravar: (a) um Preview com Supabase próprio (decisão do Daniel: trocar as variáveis do Preview), ou
  (b) admin de teste + autorização para criar a estadia de teste em produção pelo app; ou (c) o Daniel liga
  `AUTOMACOES_ATIVO=1` em produção e o cron das 13:00 UTC age sobre uma estadia is_teste montada na janela.
