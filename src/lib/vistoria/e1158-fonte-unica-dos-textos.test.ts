import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";
import { TEXTO_PAGAMENTO_PARCEIROS_EM_BREVE, textoDivisaoNaOrigem, textoTaxaServicoAoParceiro, textoTaxaServicoParceiros } from "../../config/taxa-servico-parceiros.ts";
import { TEXTO_PAGAMENTO_INATIVO } from "../parceiros/pedido.ts";
import { TEXTO_NOTA_DO_SERVICO } from "../parceiros/fiscal.ts";
import { CONVITE_SEJA_PARCEIRO } from "../parceiros/convite-avaliacao.ts";
import { DECLARACAO_DE_ASSINATURA_DO_LAUDO } from "./laudo-avaliador.ts";
import { AVISO_EXPIRACAO_DIAS, PRAZO_DEVOLUCAO_DIAS, PRAZO_RESSALVA_DIAS, VALIDADE_LAUDO_MESES } from "./laudo.ts";
import { dias, prazoCombinadoNaLinhaDoDono, textoDaPropostaEnviada } from "./pedido-avaliador.ts";
import { SUBTITULO_DA_PORTA } from "./porta-da-avaliacao.ts";
import { textoDaTroca, mensagemDepoisDaTroca } from "./troca-de-avaliador.ts";
import { SEM_OUTRO_AVALIADOR, TEXTO_DA_ESPERA } from "./espera-de-avaliador.ts";
import {
  DESCRICAO_DA_AVALIACAO,
  DIAS_DA_JANELA_DE_RECUSAS,
  ESCOLHA_E_TERMOS_AO_AVALIADOR,
  ESCOLHA_E_TERMOS_AO_AVALIADOR_FRASE,
  LINHA_PUBLICA_DESIGNACAO,
  ROTAS_NIVEL,
  ROTULO_CONFIRMAR_PAGAMENTO_AO_AVALIADOR,
  TEXTO_PAGAMENTO_DIRETO_AO_AVALIADOR,
  TITULO_RECUSAS_E_AUSENCIAS,
  contagemDecisoes,
  linhaDoTempoPedido,
  situacaoDono,
  situacaoPagamento,
} from "./telas-exibicao.ts";
import { ASSUNTO_SEM_AVALIADOR, RESPOSTA_DO_AVALIADOR, ROTULO_AGUARDANDO_AVALIADOR, ROTULO_TIPO_PEDIDO, SEM_AVALIADOR_ELEGIVEL, STATUS_PEDIDO, TITULO_PEDIDOS_SEM_AVALIADOR, rotuloDoStatus, rotuloDoTipo } from "./rotulos-do-pedido.ts";
import { ROTULO_FILA, corpoDoAvisoDaFila, rotuloDaFila } from "./rotulos-da-fila.ts";
import { EVENTOS_VISTORIA_COM_FATOS, corpoVistoria, type EventoVistoria } from "./corpo-email.ts";
import { TEMPLATES } from "../notifications/eventos-email.ts";

/*
  E1158 (ORDENS-DUET 654, 656, 658, 659 e 673; linha Parceiros). As varreduras das telas do parceiro, do dono, da equipe
  e dos e-mails da avaliação acharam 23 textos gémeos: a mesma coisa escrita à mão em dois ou mais sítios, às vezes já
  com redações diferentes. Cada um passa a ter UMA fonte. Esta trava confere, sub-ponto a sub-ponto, (a) o que a fonte
  diz e (b) que as cópias à mão saíram do código — voltar a escrever o texto numa tela faz cair o caso dela.
  Roda: node --test src/lib/vistoria/e1158-fonte-unica-dos-textos.test.ts
*/
const ler = (p: string) => semComentarios(readFileSync(p, "utf8"));
const AVALIADOR = ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx");
const PEDIDO_DO_AVALIADOR = ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/[pedido]/page.tsx");
const PAINEL_DO_PARCEIRO = ler("src/app/(dashboard)/dashboard/parceiro/painel-parceiro.tsx");
const PAGINA_DO_PARCEIRO = ler("src/app/(dashboard)/dashboard/parceiro/page.tsx");
const BLOCO_DO_DONO = ler("src/components/vistoria/bloco-avaliacao-dono.tsx");
const EQUIPE = ler("src/app/(dashboard)/admin/avaliadores/page.tsx");
const MATRIZ = ler("src/lib/notifications/eventos-email.ts");
const CORPO = ler("src/lib/vistoria/corpo-email.ts");
const vezes = (texto: string, re: RegExp) => (texto.match(re) ?? []).length;

// ── As telas do parceiro (1 a 7) ────────────────────────────────────────────────────────────────────────────
test("E1158 (1): o pagamento ainda não ativo tem uma redação só — a da config; a de pedido.ts é o mesmo texto", () => {
  assert.equal(TEXTO_PAGAMENTO_INATIVO, TEXTO_PAGAMENTO_PARCEIROS_EM_BREVE);
  assert.equal(TEXTO_PAGAMENTO_PARCEIROS_EM_BREVE, "Pagamento pela plataforma em breve.");
  assert.match(ler("src/lib/parceiros/pedido.ts"), /export const TEXTO_PAGAMENTO_INATIVO = TEXTO_PAGAMENTO_PARCEIROS_EM_BREVE;/);
  // Os ganhos do parceiro leem a constante; a redação antiga não está escrita em tela nenhuma.
  assert.match(ler("src/components/parceiros/pedidos-do-parceiro.tsx"), /Valores como \{ROTULO_REGISTRO_SEM_DINHEIRO\}\. \{TEXTO_PAGAMENTO_INATIVO\}/);
  for (const [nome, f] of Object.entries({ ganhos: ler("src/components/parceiros/pedidos-do-parceiro.tsx"), painel: PAINEL_DO_PARCEIRO, avaliador: AVALIADOR, pedido: ler("src/app/(dashboard)/dashboard/servicos/pedidos/[id]/pedido-tela.tsx") })) {
    assert.doesNotMatch(f, /ainda não está ativo|Pagamento pela plataforma em breve/, `${nome}: o texto vem da constante`);
  }
});

test("E1158 (2): na tela do avaliador a divisão fala com ele — 'vai direto para você', com o 'em breve' da fonte", () => {
  assert.equal(textoTaxaServicoAoParceiro(true), `Taxa de serviço: 10% sobre o valor do serviço, para todas as categorias. ${textoDivisaoNaOrigem("você")}`);
  assert.equal(textoTaxaServicoAoParceiro(false), `${textoTaxaServicoAoParceiro(true)} ${TEXTO_PAGAMENTO_PARCEIROS_EM_BREVE}`);
  assert.match(textoTaxaServicoAoParceiro(false), /90% vai direto para você e 10% para a Viva/);
  assert.doesNotMatch(textoTaxaServicoAoParceiro(false), /o parceiro/);
  // Só muda a voz: o resto é o texto de sempre.
  assert.equal(textoTaxaServicoAoParceiro(false).replace("para você e", "para o parceiro e"), textoTaxaServicoParceiros(false));
  assert.match(AVALIADOR, /\{textoTaxaServicoAoParceiro\(PAGAMENTO_PARCEIROS_ATIVO\)\}/);
  assert.doesNotMatch(AVALIADOR, /textoTaxaServicoParceiros\(/);
});

test("E1158 (3): 'o proprietário escolhe… você define o seu valor e o seu prazo' — a redação do painel, em quatro sítios", () => {
  assert.equal(ESCOLHA_E_TERMOS_AO_AVALIADOR, "o proprietário escolhe o avaliador de imóveis; você define o seu valor e o seu prazo.");
  assert.equal(ESCOLHA_E_TERMOS_AO_AVALIADOR_FRASE, "O proprietário escolhe o avaliador de imóveis; você define o seu valor e o seu prazo.");
  assert.match(PAGINA_DO_PARCEIRO, /Avaliador credenciado: \{ESCOLHA_E_TERMOS_AO_AVALIADOR\}/);
  assert.match(AVALIADOR, /subtitle=\{`Credenciamento de avaliador: \$\{ESCOLHA_E_TERMOS_AO_AVALIADOR\}`\}/);
  assert.match(AVALIADOR, /ativo: `Você aparece na lista de avaliadores da sua cidade: \$\{ESCOLHA_E_TERMOS_AO_AVALIADOR\}`,/);
  assert.equal(CONVITE_SEJA_PARCEIRO.texto, `Credenciamento à parte: identidade, experiência, código de conduta, declaração de relações e uma avaliação de teste. ${ESCOLHA_E_TERMOS_AO_AVALIADOR_FRASE}`);
  for (const f of [PAGINA_DO_PARCEIRO, AVALIADOR, ler("src/lib/parceiros/convite-avaliacao.ts")]) assert.doesNotMatch(f, /define o seu valor e o seu prazo/, "a frase não está escrita à mão");
});

test("E1158 (4): a declaração de assinatura do laudo é uma constante — igual na emissão e na reverificação", () => {
  assert.equal(DECLARACAO_DE_ASSINATURA_DO_LAUDO, "Assino este laudo como avaliador e respondo pelo que consta nele. A Viva forneceu o modelo e guarda o registro (número e hash); o conteúdo é meu.");
  assert.equal(vezes(PEDIDO_DO_AVALIADOR, /<span>\{DECLARACAO_DE_ASSINATURA_DO_LAUDO\}<\/span>/g), 2);
  assert.doesNotMatch(PEDIDO_DO_AVALIADOR, /Assino este laudo/);
});

test("E1158 (5): o prazo em dias sai do mesmo ajudante nos dois lados — nunca 'dia(s)' nem a conta à mão", () => {
  assert.equal(dias(1), "1 dia");
  assert.equal(dias(5), "5 dias");
  // E1156 (ORDENS-DUET 712 e 713): o prazo combinado sai de um ajudante só de cada lado — a proposta, o combinado e a
  // troca no bloco do dono; a proposta enviada no lado do avaliador. O pedido anterior à regra continua a ler dias().
  assert.equal(vezes(BLOCO_DO_DONO, /prazoCombinadoNaLinhaDoDono\(atual, (?:null|visitaComData)\)/g), 3);
  assert.match(AVALIADOR, /\{textoDaPropostaEnviada\(p\)\}\./);
  assert.equal(prazoCombinadoNaLinhaDoDono({ prazo_proposto_dias: 5, prazo_laudo_dias_uteis: null }, null), `laudo em ${dias(5)}`);
  assert.equal(textoDaPropostaEnviada({ valor_proposto: 380, prazo_proposto_dias: 1, prazo_laudo_dias_uteis: null }), `Proposta enviada: R$ 380,00 em ${dias(1)}`);
  assert.ok(textoDaTroca({ numero: "UDI-001", valor: "R$ 380,00", prazoDias: 1, outros: 2, cidade: "Uberlândia" }).perde.includes("A proposta dele é descartada: R$ 380,00 · laudo em 1 dia."));
  assert.ok(textoDaTroca({ numero: "UDI-001", valor: "R$ 380,00", prazoDias: 4, outros: 2, cidade: "Uberlândia" }).perde.includes("A proposta dele é descartada: R$ 380,00 · laudo em 4 dias."));
  for (const f of [BLOCO_DO_DONO, AVALIADOR, ler("src/lib/vistoria/troca-de-avaliador.ts")]) assert.doesNotMatch(f, /dia\(s\)|=== 1 \? "dia" : "dias"/);
});

test("E1158 (6): de quem é a nota do serviço — a redação aprovada, no 'Seja parceiro' e no painel", () => {
  assert.equal(TEXTO_NOTA_DO_SERVICO, "A nota (ou o recibo) do serviço é sua, para o cliente. A Viva emite o documento só da taxa dela.");
  for (const f of [ler("src/components/parceiros/seja-parceiro-form.tsx"), PAINEL_DO_PARCEIRO]) {
    assert.match(f, /\{TEXTO_NOTA_DO_SERVICO\}/);
    assert.doesNotMatch(f, /do serviço é sua/);
  }
});

test("E1158 (7): 'Concluir a visita' aparece uma vez — no botão; o título do painel é 'Fim da visita'", () => {
  assert.match(PEDIDO_DO_AVALIADOR, /<Panel title=\{p\.status === "agendado" \? "Fim da visita" : undefined\}[^>]*data-testid="avaliacao-concluir"/);
  assert.equal(vezes(PEDIDO_DO_AVALIADOR, /Concluir a visita/g), 1);
  assert.match(PEDIDO_DO_AVALIADOR, />Concluir a visita<\/Button>/);
});

// ── O lado do dono (8 a 13) ─────────────────────────────────────────────────────────────────────────────────
test("E1158 (8 e 9): na linha do tempo, a etapa diz só 'Escolhido' e a visita tem o formato único, com o fuso", () => {
  const e = linhaDoTempoPedido({ status: "agendado", numero: "UDI-007", agendadoPara: "2026-10-25T13:00:00Z" });
  assert.equal(e[1].rotulo, "Escolhido");
  assert.equal(e[2].rotulo, "Agendado para 25/10/2026 às 10:00, horário de Brasília");
  assert.equal(linhaDoTempoPedido({ status: "designado", numero: "UDI-007" })[1].rotulo, "Escolhido", "o número fica na linha 'Avaliador escolhido por você', com o link");
});

test("E1158 (10 e 11): como o dono paga, e o botão de confirmar — uma fonte para os dois estados do bloco", () => {
  assert.equal(TEXTO_PAGAMENTO_DIRETO_AO_AVALIADOR, "Você paga direto ao avaliador, depois da visita. A Viva só registra.");
  assert.equal(situacaoPagamento({ recebidoMarcadoEm: null, recebidoConfirmadoEm: null }), TEXTO_PAGAMENTO_DIRETO_AO_AVALIADOR);
  assert.match(BLOCO_DO_DONO, /\{TEXTO_PAGAMENTO_DIRETO_AO_AVALIADOR\} \{textoTaxaServicoParceiros\(PAGAMENTO_PARCEIROS_ATIVO\)\}/);
  assert.doesNotMatch(BLOCO_DO_DONO, /Você paga direto ao avaliador/);
  assert.equal(ROTULO_CONFIRMAR_PAGAMENTO_AO_AVALIADOR, "Confirmar que paguei o avaliador");
  assert.equal(vezes(BLOCO_DO_DONO, />\{ROTULO_CONFIRMAR_PAGAMENTO_AO_AVALIADOR\}<\/Button>/g), 2);
  assert.doesNotMatch(BLOCO_DO_DONO, /Confirmar que paguei/);
});

// E1177 (asserções alteradas, ORDEM-DUET-778, decisão do coordenador): a promessa única "a Viva avisa quando houver um
// para você escolher" saiu — só vale quando a cidade não tem avaliador nenhum. O que continua a valer deste sub-ponto é
// a FONTE ÚNICA: o bloco do dono e a troca de avaliador leem os textos da espera de um lugar só.
test("E1158 (12): 'não há avaliador agora' sai de uma fonte só no bloco do dono e na troca de avaliador", () => {
  assert.equal(situacaoDono({ status: "pedido", aguardandoAvaliador: true, ocupado: false, concordanciaEm: null, agendadoPara: null, motivoDaEspera: "sem_avaliador_na_cidade" }), TEXTO_DA_ESPERA.sem_avaliador_na_cidade);
  assert.match(BLOCO_DO_DONO, /data-testid="avaliacao-escolha-vazia">\{textoDaEspera\(atual\.motivo_da_espera\)\}<\/p>/);
  assert.match(textoDaTroca({ numero: "UDI-001", valor: "R$ 380,00", prazoDias: 3, outros: 0, cidade: "Uberlândia" }).depois, /a equipe da Viva é avisada\.$/);
  assert.ok(mensagemDepoisDaTroca(true).endsWith(SEM_OUTRO_AVALIADOR));
  for (const f of [BLOCO_DO_DONO, ler("src/lib/vistoria/troca-de-avaliador.ts")]) assert.doesNotMatch(f, /[aA] Viva avisa|equipe da Viva foi avisada/);
});

test("E1158 (13): o que é a avaliação — a mesma frase no cartão do Nível e no subtítulo da porta", () => {
  assert.equal(DESCRICAO_DA_AVALIACAO, "Um avaliador credenciado visita o imóvel e assina o laudo com o nível dele.");
  assert.equal(ROTAS_NIVEL[1].texto, DESCRICAO_DA_AVALIACAO);
  assert.equal(SUBTITULO_DA_PORTA, DESCRICAO_DA_AVALIACAO);
  assert.equal(vezes(ler("src/lib/vistoria/telas-exibicao.ts") + ler("src/lib/vistoria/porta-da-avaliacao.ts"), /Um avaliador credenciado visita o imóvel/g), 1);
});

// ── A equipe (14 a 19) ──────────────────────────────────────────────────────────────────────────────────────
test("E1158 (14): a janela das recusas é um número só — na leitura, no título, no vazio e no número do topo", () => {
  assert.equal(TITULO_RECUSAS_E_AUSENCIAS, `Recusas e ausências (${DIAS_DA_JANELA_DE_RECUSAS} dias)`);
  const numeros = contagemDecisoes({ credenciamentos: [], semAvaliador: 0, recusasAusencias: 0, cidadesProntas: 0, cidades: 1 });
  assert.equal(numeros.find((n) => n.chave === "recusas")?.rotulo, `recusas e ausências (${DIAS_DA_JANELA_DE_RECUSAS} dias)`);
  assert.match(EQUIPE, /title=\{TITULO_RECUSAS_E_AUSENCIAS\}/);
  assert.match(EQUIPE, /nos últimos \{DIAS_DA_JANELA_DE_RECUSAS\} dias\./);
  assert.match(EQUIPE, /agora\.getTime\(\) - DIAS_DA_JANELA_DE_RECUSAS \* 86_400_000\)/);
  assert.doesNotMatch(EQUIPE, /30 dias/);
});

test("E1158 (15): o prazo da devolução na fila lê a constante do LAUDO — nunca a da caução", () => {
  assert.equal(ROTULO_FILA.devolucao_vencida, `Devolução da contestação não confirmada em ${PRAZO_DEVOLUCAO_DIAS} dias`);
  const fila = ler("src/lib/vistoria/rotulos-da-fila.ts");
  // E1156: as "48 horas úteis" saíram da fila (o laudo conta pelo prazo combinado); a devolução continua a ler o LAUDO.
  assert.match(fila, /import \{ PRAZO_DEVOLUCAO_DIAS \} from "\.\/laudo\.ts";/);
  assert.doesNotMatch(fila + EQUIPE, /caucao\/prazos/);
  assert.doesNotMatch(fila, /\b15 dias\b/);
  // O motivo gravado na fila pela rotina diz o mesmo prazo, da mesma constante.
  assert.match(ler("src/lib/vistoria/laudo-servidor.ts"), /motivo: `Devolução da contestação não confirmada em \$\{PRAZO_DEVOLUCAO_DIAS\} dias: proposta de descredenciamento\.`/);
});

test("E1158 (16): o estado e o tipo do pedido têm os rótulos da casa — a equipe não lê o código da base", () => {
  assert.deepEqual(STATUS_PEDIDO, { pedido: "Aguardando a escolha do proprietário", designado: "Escolhido pelo proprietário", agendado: "Visita agendada", realizada: "Visita feita", laudo_emitido: "Laudo emitido", cancelada: "Cancelada", ausencia: "Ausência registrada" });
  assert.equal(rotuloDoStatus("agendado"), "Visita agendada");
  assert.equal(ROTULO_TIPO_PEDIDO.verificacao, "Verificação aberta pela Viva");
  assert.equal(ROTULO_TIPO_PEDIDO.contestacao, "2ª avaliação (contestação)");
  assert.equal(rotuloDoTipo("inicial"), "Avaliação inicial");
  // Todo tipo e todo estado que a base aceita tem rótulo; um valor desconhecido aparece como veio (nunca vazio).
  for (const t of ["inicial", "reverificacao", "contestacao", "verificacao", "nova_avaliacao", "nova_90d"]) assert.notEqual(rotuloDoTipo(t), t, t);
  for (const s of ["pedido", "designado", "agendado", "realizada", "laudo_emitido", "cancelada", "ausencia"]) assert.notEqual(rotuloDoStatus(s), s, s);
  assert.equal(rotuloDoTipo("tipo_novo"), "tipo_novo");
  // A equipe: "Pedidos recentes" e os itens "sem avaliador" passam pelos rótulos.
  assert.match(EQUIPE, /\{p\.cidade\} · \{rotuloDoTipo\(p\.tipo\)\} · \{p\.aguardando_avaliador \? ROTULO_AGUARDANDO_AVALIADOR : rotuloDoStatus\(p\.status\)\}/);
  assert.equal(ROTULO_AGUARDANDO_AVALIADOR, "Aguardando avaliador");
  assert.equal(vezes(EQUIPE, /\{x\.cidade\} · \{rotuloDoTipo\(x\.tipo\)\} · desde/g), 2);
  assert.doesNotMatch(EQUIPE, /· \{[px]\.tipo\} ·|: p\.status\}/);
  // O avaliador lê o mesmo mapa (já não tem um só dele) e o tipo do pedido sai da mesma fonte.
  assert.doesNotMatch(AVALIADOR, /const STATUS_PEDIDO\b/);
  assert.match(AVALIADOR, /import \{ RESPOSTA_DO_AVALIADOR, STATUS_PEDIDO \} from "@\/lib\/vistoria\/rotulos-do-pedido";/);
  assert.match(PEDIDO_DO_AVALIADOR, /ROTULO_TIPO_PEDIDO\[p\.tipo as "verificacao" \| "contestacao"\]/);
  assert.doesNotMatch(PEDIDO_DO_AVALIADOR, /Verificação aberta pela Viva|2ª avaliação \(contestação\)/);
});

test("E1158 (17): a resposta do avaliador tem as duas vozes na mesma fonte", () => {
  assert.deepEqual(RESPOSTA_DO_AVALIADOR, { equipe: { recusada: "Recusou", ausencia: "Não foi à visita" }, avaliador: { recusada: "Você recusou", ausencia: "Ausência registrada" } });
  assert.deepEqual(Object.keys(RESPOSTA_DO_AVALIADOR.equipe), Object.keys(RESPOSTA_DO_AVALIADOR.avaliador), "as mesmas respostas nas duas vozes");
  assert.match(EQUIPE, /const ROTULO_RESPOSTA = RESPOSTA_DO_AVALIADOR\.equipe;/);
  assert.match(AVALIADOR, /\{ \.\.\.RESPOSTA_DO_AVALIADOR\.avaliador, expirada: rotuloSemResposta\(cred\.prazo_resposta_horas\) \}/);
  for (const f of [EQUIPE, AVALIADOR]) assert.doesNotMatch(f, /"Recusou"|"Não foi à visita"|"Você recusou"/);
});

test("E1158 (18): 'sem avaliador elegível' está escrito uma vez — o título, a fila, o número e o assunto do e-mail leem-no", () => {
  assert.equal(SEM_AVALIADOR_ELEGIVEL, "sem avaliador elegível");
  assert.equal(TITULO_PEDIDOS_SEM_AVALIADOR, "Pedidos sem avaliador elegível");
  assert.equal(ROTULO_FILA.sem_avaliador, "Pedido sem avaliador elegível");
  assert.equal(ASSUNTO_SEM_AVALIADOR, "Avaliação sem avaliador elegível");
  assert.equal(contagemDecisoes({ credenciamentos: [], semAvaliador: 0, recusasAusencias: 0, cidadesProntas: 0, cidades: 1 }).find((n) => n.chave === "sem-avaliador")?.rotulo, "pedidos sem avaliador elegível");
  assert.equal(TEMPLATES.vistoria_sem_avaliador.subject, ASSUNTO_SEM_AVALIADOR);
  assert.match(EQUIPE, /<Panel id="sem-avaliador" title=\{TITULO_PEDIDOS_SEM_AVALIADOR\}/);
  for (const [nome, f] of Object.entries({ equipe: EQUIPE, telas: ler("src/lib/vistoria/telas-exibicao.ts"), fila: ler("src/lib/vistoria/rotulos-da-fila.ts"), matriz: MATRIZ })) {
    assert.doesNotMatch(f, /sem avaliador elegível/i, `${nome}: lê a constante`);
  }
  assert.equal(vezes(ler("src/lib/vistoria/rotulos-do-pedido.ts"), /sem avaliador elegível/g), 1);
});

test("E1158 (19): na tela da equipe, 'quem escolhe e quem define' é a linha da fonte, nos dois painéis", () => {
  assert.equal(LINHA_PUBLICA_DESIGNACAO, "O proprietário escolhe o avaliador. O avaliador define o próprio valor e prazo.");
  assert.match(EQUIPE, /A Viva não designa\. \{LINHA_PUBLICA_DESIGNACAO\} A ordem é só de exibição/);
  assert.match(EQUIPE, /ou ressalva vencida\. \{LINHA_PUBLICA_DESIGNACAO\} O proprietário paga o valor que o avaliador propôs\./);
  assert.doesNotMatch(EQUIPE, /o proprietário escolhe entre os sugeridos|O proprietário escolhe o avaliador e paga/);
});

// ── Os e-mails (20 a 23) ────────────────────────────────────────────────────────────────────────────────────
test("E1158 (20): os prazos em dias e em meses dos e-mails saem das constantes do laudo, e dizem o mesmo de antes", () => {
  const sem = { imovel: null };
  assert.equal(corpoVistoria("vistoria_ressalva_vencida", sem).body("Lara"), "Olá Lara, o prazo de 15 dias para corrigir as ressalvas do laudo do seu imóvel terminou sem a correção. Veja o que acontece agora e peça uma nova avaliação.");
  assert.equal(corpoVistoria("vistoria_vistoriado_expira", sem).body("Lara"), "Olá Lara, o laudo do seu imóvel completa 12 meses em 30 dias e o nível deixa de aparecer como confirmado por avaliador no dia. Peça uma nova avaliação para manter.");
  assert.equal(corpoVistoria("vistoria_devolucao", sem).body("Rita"), "Olá Rita, a 2ª avaliação do imóvel deu razão ao proprietário. Pela regra da contestação, devolva a ele o valor pago pela 2ª avaliação em até 15 dias; ele confirma o recebimento na plataforma.");
  assert.equal(TEMPLATES.vistoria_vistoriado_expira.subject, "A confirmação do nível do seu anúncio vence em 30 dias");
  assert.deepEqual([PRAZO_RESSALVA_DIAS, PRAZO_DEVOLUCAO_DIAS, VALIDADE_LAUDO_MESES, AVISO_EXPIRACAO_DIAS], [15, 15, 12, 30]);
  assert.match(CORPO, /o prazo de \$\{PRAZO_RESSALVA_DIAS\} dias/);
  assert.match(CORPO, /completa \$\{VALIDADE_LAUDO_MESES\} meses em \$\{AVISO_EXPIRACAO_DIAS\} dias/);
  assert.match(CORPO, /em até \$\{PRAZO_DEVOLUCAO_DIAS\} dias/);
  assert.match(MATRIZ, /subject: `A confirmação do nível do seu anúncio vence em \$\{AVISO_EXPIRACAO_DIAS\} dias`/);
});

test("E1158 (21): o modelo da matriz é o próprio corpo, sem os fatos — cada e-mail da avaliação está escrito uma vez", () => {
  for (const ev of EVENTOS_VISTORIA_COM_FATOS as ReadonlySet<EventoVistoria>) {
    assert.equal(TEMPLATES[ev].body("Lara"), corpoVistoria(ev, { imovel: null }).body("Lara"), ev);
    assert.equal(TEMPLATES[ev].body(), corpoVistoria(ev, { imovel: null }).body(), `${ev}, sem nome`);
    assert.match(MATRIZ, new RegExp(`^  ${ev}: \\{ subject: .*, body: semFatos\\("${ev}"\\), cta: `, "m"), `${ev} lê o corpo`);
  }
  // E1160 (1) (asserção alterada, ORDEM-DUET-674): 17 → 19. Os dois eventos novos (o avaliador recusou; não respondeu
  // no prazo) também têm o corpo escrito uma vez.
  // E1173 (asserção alterada, ORDEM-DUET-753): 19 → 20. O aviso da recusa da data também tem o corpo escrito uma vez.
  // E1177 (asserção alterada, ORDEM-DUET-778): 20 → 21. O aviso ao dono quando a lista de avaliadores abre também tem
  // o corpo escrito uma vez.
  assert.equal(EVENTOS_VISTORIA_COM_FATOS.size, 21);
  // Na matriz, nenhuma linha da avaliação com fatos tem corpo escrito à mão; os dois avisos aos admins ficam só nela.
  const comCorpoProprio = MATRIZ.split("\n").filter((l) => /^  vistoria_\w+: \{/.test(l) && !/body: semFatos\(/.test(l)).map((l) => l.trim().split(":")[0]);
  assert.deepEqual(comCorpoProprio, ["vistoria_sem_avaliador", "vistoria_fila_admin"]);
  // A divergência que a varredura achou acabou: o modelo do aviso ao dono diz o mesmo que o corpo com os fatos.
  assert.doesNotMatch(TEMPLATES.vistoria_designado_dono.body("Lara"), /respondeu com o valor e o prazo dele/);
});

test("E1158 (22): o e-mail 'sem avaliador' deixou de falar na 'fila da cidade' — o dono é quem escolhe", () => {
  assert.equal(TEMPLATES.vistoria_sem_avaliador.body(), "Um pedido de avaliação de imóvel está aguardando avaliador: nenhum avaliador da cidade está disponível para o dono escolher.");
  assert.doesNotMatch(MATRIZ, /fila da cidade/);
});

test("E1158 (23): o e-mail 'novo item na fila' diz o tipo do item pelo rótulo da tela — e nenhum tipo passa a avisar", () => {
  assert.equal(corpoDoAvisoDaFila("laudo_atrasado"), `Há um item novo na fila da avaliação de imóveis: ${ROTULO_FILA.laudo_atrasado}.`);
  assert.equal(corpoDoAvisoDaFila("devolucao_vencida"), "Há um item novo na fila da avaliação de imóveis: Devolução da contestação não confirmada em 15 dias.");
  assert.equal(corpoDoAvisoDaFila(), "Há um item novo na fila da avaliação de imóveis.");
  assert.equal(TEMPLATES.vistoria_fila_admin.body(), corpoDoAvisoDaFila());
  assert.equal(rotuloDaFila("tipo_novo"), "tipo_novo");
  // A tela lê o mesmo mapa (já não tem um só dela).
  assert.match(EQUIPE, /import \{ ROTULO_FILA \} from "@\/lib\/vistoria\/rotulos-da-fila";/);
  assert.doesNotMatch(EQUIPE, /const ROTULO_FILA\b/);
  // Os avisos que JÁ existiam passam o tipo; continuam a ser só estes dois (ORDEM-DUET-673: nenhum aviso novo).
  const rotina = ler("src/lib/vistoria/laudo-servidor.ts");
  assert.deepEqual(rotina.match(/avisarAdmins\(admin, "vistoria_fila_admin"[^)]*\)/g), ['avisarAdmins(admin, "vistoria_fila_admin", "laudo_atrasado")', 'avisarAdmins(admin, "vistoria_fila_admin", "devolucao_vencida")']);
  const servidor = ler("src/lib/vistoria/servidor.ts");
  assert.equal(vezes(servidor + rotina + ler("src/lib/vistoria/actions.ts") + ler("src/lib/vistoria/laudo-actions.ts"), /avisarAdmins\(admin, "vistoria_fila_admin"/g), 2);
  // Pôr um item na fila continua a não avisar ninguém por si.
  const naFila = servidor.slice(servidor.indexOf("export async function naFilaDoAdmin("), servidor.indexOf("export async function naFilaDoAdmin(") + 600);
  assert.doesNotMatch(naFila.slice(0, naFila.indexOf("\n}\n")), /avisarAdmins|notify\(/);
});
