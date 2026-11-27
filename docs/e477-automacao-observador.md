# E477 — resíduo: "Rodar a automação de hoje" aberto ao observador da QA

**Relato (lote 4, 06/11):** a conta observadora (qa_admin, só leitura) ainda via controles de escrita habilitados.

**Conferência por tela (main atual):** Pendências (Aceitar/Recusar e "Rodar os prazos agora"), Fotos de perfil,
Documentos, Anúncios (Pausar), Atendimento (as respostas prontas e o teste da Viva), Cidades, Destinos e Marketing já
mostram "Só leitura" ao observador e o servidor recusa (#2678, #2845, #2885, #2888, #2914, #2922).
"Salvar resposta pronta" e "Rodar cenários" no formato descrito no relato não existem mais.

**Lacuna real encontrada (nova):** `rodarAutomacaoAgora` (src/lib/automacao/acoes.ts), botão "Rodar a automação de hoje"
em /admin/parceiros/pedidos. Só checava `ehAdmin`; o observador é admin com 2FA próprio e passava. Com a automação ligada em
produção, o passo diário da estadia grava de verdade (pedidos automáticos, sugestões e avisos de 24 h a moradores reais).
A auditoria de 06/11 não pegou porque o import é `@/lib/automacao/acoes` (o filtro procurava `-acoes`).

**Correção:** o servidor recusa o observador antes da primeira escrita (`recusaObservador(user.id)`, sem alvo: proibido
sempre) e a tela mostra "Só leitura" no lugar do botão. **A chave AUTOMACOES_ATIVO não é tocada.**

**Varredura do servidor (todas as ações "use server" com guarda de admin):** as demais sem `recusaObservador` só leem ou
agem sobre o próprio admin — `enviarPushDeTeste` (aparelhos do próprio admin), `setAlertasEquipe` (preferência do próprio
admin), `registrarVistaDoAdmin` (log de leitura), `getContratoParaEquipe` (leitura), `gerarResumoSemanalDeTeste` (só contas de teste)
e `documentos-inquilino-actions` (a parte, não o admin).

Teste permanente: `src/lib/qa/e477-automacao-observador.test.ts` (3). Escopo: qa + e477 + automacao 140/140; `tsc` limpo.
