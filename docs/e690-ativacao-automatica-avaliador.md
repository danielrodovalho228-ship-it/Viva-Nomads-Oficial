# E690 — ativação automática do avaliador (regra validada pelo coordenador, 08/11/2026)

**Atrás da chave `AVALIADOR_ATIVACAO_AUTOMATICA_ATIVA` (`NEXT_PUBLIC_…="on"`), desligada por padrão.** Migração 0335 (só colunas novas).

## Regra
1. **solicitado → em_teste**, sozinho, quando TODOS batem: identidade verificada · CPF da pessoa verificada é titular/sócio do CNPJ · experiência comprovada · código de conduta aceito · cidade informada.
2. **em_teste → ativo**, sozinho, quando a avaliação de teste foi concluída (laudo emitido num pedido de teste) E passou na conferência (resultado "aprovado" e nada aberto na fila do admin para o avaliador) E a identidade segue verificada.
3. Cada passo grava `decidido_por = null`, `decidido_pelo_sistema = true`, o motivo "Decidido pelo sistema em AAAA-MM-DD (…). Critérios: …" (aparece na tela do admin como "Motivo") e os critérios do momento em `criterios_decisao` (json, com a fonte real/simulada).
4. **Sem atalho para a identidade**: nenhum critério é dispensado; UDI-001 segue a mesma regra. Critério que não dá para conferir (`null`) não avança: fica para o admin.

## Identidade e CPF simulados
- A identidade vem da mesma fonte de todas as telas (`estadoIdentidade`). Em conta `is_teste` ela é a verificação simulada.
- O CPF titular/sócio do CNPJ não tem fornecedor de quadro societário no código: em conta `is_teste` é **simulado** (verdadeiro quando há CNPJ válido); em conta **real** fica "não conferível" e nada avança sozinho até existir o fornecedor.

## Onde dispara (nunca lança)
`tentarAtivacaoAutomatica` (`ativacao-automatica-servidor.ts`): ao registrar o pedido de credenciamento, ao concluir a verificação de identidade (`/api/caf/verify`) e ao emitir o laudo de uma avaliação de teste. Cada passo é guardado pelo status de origem (`.eq("status", …)`), então não corre em dobro nem contra uma decisão do admin. A ação do admin (`adminDecidirCredenciamento`) continua igual; a função que cria o parceiro do avaliador foi só movida para `parceiro-do-avaliador-servidor.ts`.

## Decisões minhas (para o coordenador confirmar)
- "Passou na conferência" = resultado do laudo de teste `aprovado` (não `com_ressalvas`) e nenhuma pendência aberta na fila do admin. Se `com_ressalvas` também deve ativar, é uma linha.
- A avaliação de teste em si (apontar o imóvel de teste) continua sendo criada pelo admin (`adminCriarAvaliacaoTeste`); a regra só decide a ativação.
Testes: `src/lib/vistoria/e690-ativacao-automatica.test.ts` (7). Sem prova ao vivo.
