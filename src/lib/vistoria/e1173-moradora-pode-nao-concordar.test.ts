import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LIMPEZA_DA_CONCORDANCIA,
  ROTULO_NAO_CONCORDO,
  TEXTO_RECUSA_PARA_O_AVALIADOR,
  TEXTO_RECUSA_PARA_O_DONO,
  TEXTO_RECUSA_PARA_O_MORADOR,
  concordanciaRecusada,
  gravacaoDaRecusa,
} from "./concordancia.ts";
import { situacaoDono } from "./telas-exibicao.ts";
import { EVENTOS_VISTORIA_COM_FATOS, corpoVistoria } from "./corpo-email.ts";
import { podeReagendar } from "./regras.ts";
import { MATRIZ_NOTIFICACOES } from "../../config/matriz-notificacoes.ts";
import { TEMPLATES } from "../notifications/eventos-email.ts";
import { TEMA_POR_EVENTO } from "../notifications/imagens-email.ts";
import { EVENTOS_VISITA_DE_AVALIACAO } from "../notifications/sino.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

/*
  E1173 (ORDENS-DUET 751 e 753; linha Parceiros). No imóvel ocupado a visita só acontece com a concordância do morador.
  Ele tinha "Concordo" e um link "Prefiro outro horário" que levava às mensagens: o "não" não ficava registado em lado
  nenhum, e o dono e o avaliador continuavam a ler "aguardando a concordância do morador".
  A regra (opção A, sem migração): o "Não posso nesta data" LIMPA a data proposta e MANTÉM o pedido de concordância
  (concordancia_pedida_em). Essa combinação é lida por uma função pura única, `concordanciaRecusada`. A recusa não é um
  reagendamento: não gasta a vez de ninguém nem pede as 24 horas. Ninguém responde pelo morador.
  Roda: node --test src/lib/vistoria/e1173-moradora-pode-nao-concordar.test.ts
*/
const ler = (p: string) => semComentarios(readFileSync(p, "utf8"));
const AGORA = "2026-11-24T18:00:00.000Z";
const DATA = "2026-11-25T13:00:00.000Z";
const base = { status: "designado", ocupado: true, agendadoPara: null as string | null, concordanciaPedidaEm: AGORA as string | null, concordanciaEm: null as string | null };

test("E1173 (1) — a função pura: só o pedido ocupado, designado, sem data e com a concordância pedida lê 'recusou'", () => {
  assert.equal(concordanciaRecusada(base), true, "o estado que a recusa deixa");
  assert.equal(concordanciaRecusada({ ...base, agendadoPara: DATA }), false, "com data proposta: ainda espera a resposta");
  assert.equal(concordanciaRecusada({ ...base, concordanciaPedidaEm: null }), false, "aceito sem data, nunca houve proposta de data");
  assert.equal(concordanciaRecusada({ ...base, ocupado: false }), false, "imóvel vago não pede concordância");
  assert.equal(concordanciaRecusada({ ...base, status: "agendado", agendadoPara: DATA, concordanciaEm: AGORA }), false, "ela concordou");
  assert.equal(concordanciaRecusada({ ...base, concordanciaEm: AGORA }), false);
  for (const status of ["pedido", "agendado", "realizada", "laudo_emitido", "cancelada", "ausencia"]) {
    assert.equal(concordanciaRecusada({ ...base, status }), false, status);
  }
  assert.equal(concordanciaRecusada({ ...base, agendadoPara: undefined, concordanciaEm: undefined }), true, "coluna ausente lê como vazia");
});

test("E1173 (2) — o que a recusa grava: limpa a data, mantém o pedido de concordância e não toca no reagendamento", () => {
  const g = gravacaoDaRecusa(AGORA);
  assert.deepEqual(g, { agendado_para: null, concordancia_em: null, lembrete_d1_em: null, atualizado_em: AGORA });
  for (const fora of ["concordancia_pedida_em", "reagendou_dono", "reagendou_avaliador", "status", "avaliador_id"]) {
    assert.ok(!(fora in g), `a recusa não escreve ${fora}`);
  }
});

test("E1173 (3) — a ação da recusa tem as guardas do 'Concordo': só o morador do pedido, com data proposta, pela chave do pedido", () => {
  const acoes = ler("src/lib/vistoria/actions.ts");
  const ini = acoes.indexOf("export async function recusarDataDaVisita(");
  assert.ok(ini > 0, "a ação existe");
  const fn = acoes.slice(ini, acoes.indexOf("\nexport async function ", ini + 10));
  assert.match(fn, /if \(!p \|\| p\.morador_id !== s\.userId \|\| !p\.ocupado \|\| !p\.agendado_para \|\| p\.status !== "designado"\) return SEM_ACESSO;/);
  assert.match(fn, /if \(!\(await vistoriaAtivaParaOMorador\(s\.admin, p\.owner_id\)\)\) return DESLIGADA;/);
  // A gravação é a da função pura, e só entra se o pedido ainda está à espera dela (dois toques não gravam duas vezes).
  assert.match(fn, /\.update\(gravacaoDaRecusa\(agora\)\)\s*\.eq\("id", p\.id\)\s*\.eq\("status", "designado"\)\s*\.not\("agendado_para", "is", null\)\s*\.select\("id"\)/);
  assert.match(fn, /if \(!gravou\?\.length\) return SEM_ACESSO;/);
  // O aviso "Concorda com a visita?" sai do sino, e o dono e o avaliador sabem — com a data que ela recusou.
  const resolve = fn.indexOf("await resolverAvisosDaVisita(s.admin, p.id);");
  const aoDono = fn.indexOf('await avisar(s.admin, p.owner_id, "vistoria_concordancia_recusada", rotaDono(p.property_id), { pedidoId: p.id, propertyId: p.property_id, papel: "dono", visitaAnterior: p.agendado_para });');
  const aoAvaliador = fn.indexOf('"vistoria_concordancia_recusada", ROTA_AVALIADOR, { pedidoId: p.id, propertyId: p.property_id, papel: "avaliador", visitaAnterior: p.agendado_para });');
  assert.ok(resolve > 0 && aoDono > resolve && aoAvaliador > aoDono, "resolve o aviso dela e só depois avisa as duas partes");
  assert.match(fn, /return \{ ok: true, mensagem: TEXTO_RECUSA_PARA_O_MORADOR \};/, "a resposta da ação é a frase aprovada, a mesma da tela");
});

test("E1173 (3b) — a troca de avaliador limpa a concordância: o pedido devolvido ao dono nunca lê 'recusou'", () => {
  assert.deepEqual(LIMPEZA_DA_CONCORDANCIA, { concordancia_pedida_em: null, concordancia_em: null });
  const servidor = ler("src/lib/vistoria/servidor.ts");
  const fn = servidor.slice(servidor.indexOf("export async function devolverAoDono("));
  const gravacao = fn.slice(fn.indexOf('.from("vistoria_pedidos")'), fn.indexOf('.eq("id", pedidoId)'));
  assert.match(gravacao, /status: "pedido"/);
  assert.match(gravacao, /agendado_para: null, \.\.\.LIMPEZA_DA_CONCORDANCIA,/);
  // E mesmo um pedido antigo, devolvido antes desta limpeza (data limpa, concordância pedida ainda escrita), não é recusa.
  assert.equal(concordanciaRecusada({ ...base, status: "pedido" }), false);
});

test("E1173 (4) — a recusa não é um reagendamento: a data seguinte é um 'Agendar' novo, sem a vez e sem as 24 horas", () => {
  // A regra do reagendamento recusaria uma troca a menos de 24 horas da data — é o beco que a recusa não pode abrir.
  assert.equal(podeReagendar(new Date(Date.parse(AGORA) + 10 * 3_600_000).toISOString(), new Date(AGORA), false).ok, false);
  const acoes = ler("src/lib/vistoria/actions.ts");
  const fn = acoes.slice(acoes.indexOf("export async function agendarVisita("), acoes.indexOf("export async function concordarVisita("));
  // Só há reagendamento quando o pedido TEM data; a recusa limpou-a, por isso a regra nem é consultada.
  assert.match(fn, /const reagendando = !!p\.agendado_para;\s*if \(reagendando\) \{\s*const r = podeReagendar\(/);
  assert.match(fn, /\.\.\.\(reagendando \? \(parte === "dono" \? \{ reagendou_dono: true \} : \{ reagendou_avaliador: true \}\) : \{\}\),/);
  // A data nova pede a concordância de novo, e o "não concordou" que as partes leram deixa de valer.
  assert.match(fn, /concordancia_pedida_em: p\.ocupado \? agora : null,/);
  assert.match(fn, /await resolverAvisosDaRecusa\(s\.admin, p\.id\);/);
  // E o morador é perguntado pela "nova data" (a folha): o e-mail não repete o da primeira proposta.
  assert.match(fn, /const depoisDaRecusa = concordanciaRecusada\(\{ status: p\.status, ocupado: p\.ocupado, agendadoPara: p\.agendado_para, concordanciaPedidaEm: p\.concordancia_pedida_em, concordanciaEm: p\.concordancia_em \}\);/);
  assert.match(fn, /const troca = \{ reagendada: reagendando \|\| depoisDaRecusa, visitaAnterior: reagendando \? p\.agendado_para : null \};/);
  const nova = corpoVistoria("vistoria_concordancia", { imovel: null, visita: DATA, reagendada: true });
  assert.equal(nova.subject, "Concorda com a nova data da visita: 25/11 às 10:00?");
  assert.ok(!nova.linhas.some((l) => l.rotulo === "Data anterior"), "sem data anterior: a recusada já saiu do pedido");
});

test("E1173 (5) — o 'Concordo' também tira do sino o aviso 'Concorda com a visita?', antes de avisar a visita confirmada", () => {
  const acoes = ler("src/lib/vistoria/actions.ts");
  const fn = acoes.slice(acoes.indexOf("export async function concordarVisita("), acoes.indexOf("export async function recusarDataDaVisita("));
  const resolve = fn.indexOf("await resolverAvisosDaVisita(s.admin, p.id);");
  const avisa = fn.indexOf('"vistoria_agendada"');
  assert.ok(resolve > 0 && avisa > resolve, "resolve os avisos da visita e só depois grava os da visita confirmada");
  assert.ok((EVENTOS_VISITA_DE_AVALIACAO as readonly string[]).includes("vistoria_concordancia"));
  // O aviso da recusa não é um aviso de visita por acontecer: tem a sua própria saída (a data nova, ou a troca de avaliador).
  assert.ok(!(EVENTOS_VISITA_DE_AVALIACAO as readonly string[]).includes("vistoria_concordancia_recusada"));
  const servidor = ler("src/lib/vistoria/servidor.ts");
  assert.match(servidor, /export async function resolverAvisosDaRecusa\(admin: Admin, pedidoId: string\): Promise<void> \{/);
  const devolver = servidor.slice(servidor.indexOf("export async function devolverAoDono("));
  assert.match(devolver.slice(0, devolver.indexOf("\nexport async function ", 10)), /await resolverAvisosDaRecusa\(admin, pedidoId\);/);
});

test("E1173 (6) — o aviso da recusa: o assunto e o corpo aprovados, com a data recusada, iguais para o dono e o avaliador", () => {
  const EV = "vistoria_concordancia_recusada" as const;
  assert.deepEqual(MATRIZ_NOTIFICACOES[EV].papeis, ["proprietario", "parceiro"]);
  assert.equal(MATRIZ_NOTIFICACOES[EV].categoria, "decisao");
  assert.deepEqual(MATRIZ_NOTIFICACOES[EV].canais, MATRIZ_NOTIFICACOES.vistoria_agendada.canais, "os canais do aviso da visita");
  assert.equal(TEMA_POR_EVENTO[EV], "visita");
  assert.ok(EVENTOS_VISTORIA_COM_FATOS.has(EV));
  assert.equal(TEMPLATES[EV].subject, "O morador não pode na data da visita de avaliação");
  assert.equal(TEMPLATES[EV].cta, "Ver a avaliação");
  const CASA = { imovel: { id: "i1", titulo: "Casa do Lago", bairro: "Centro", cidade: "Sacramento" }, visitaAnterior: DATA };
  // O dono e o avaliador podem os dois propor a data nova: leem o mesmo corpo (ORDENS-DUET 757 e 759, texto 6).
  const aoAvaliador = corpoVistoria(EV, { ...CASA, destinatario: "avaliador" });
  assert.equal(aoAvaliador.body("Ari"), "Olá Ari, o morador do imóvel Casa do Lago não pode na data proposta para a visita de avaliação (25/11 às 10:00, horário de Brasília). Proponha outra data na Viva.");
  assert.equal(aoAvaliador.cta, "Ver as avaliações", "o botão do avaliador leva às avaliações dele");
  const aoDono = corpoVistoria(EV, { ...CASA, destinatario: "dono" });
  assert.equal(aoDono.body("Dalva"), "Olá Dalva, o morador do imóvel Casa do Lago não pode na data proposta para a visita de avaliação (25/11 às 10:00, horário de Brasília). Proponha outra data na Viva.");
  assert.equal(aoDono.cta, undefined, "o dono fica com o botão do modelo");
  // O assunto aprovado (texto 5). Um nome comprido encolhe-se dentro da régua dos 70 caracteres, como nos outros.
  assert.equal(corpoVistoria(EV, { imovel: { titulo: "Lar" }, visitaAnterior: DATA }).subject, "O morador não pode na data da visita de avaliação: Lar");
  assert.match(aoDono.subject ?? "", /^O morador não pode na data da visita(?: de avaliação)?: Casa do Lago$/);
  // Sem a data (aviso sem o fato) o texto continua inteiro, e não inventa data nenhuma.
  assert.equal(corpoVistoria(EV, { imovel: null }).body(), "Olá, o morador do imóvel não pode na data proposta para a visita de avaliação. Proponha outra data na Viva.");
  // A data recusada viaja com o aviso como "a data anterior" (a folha): quando ele sai, já foi limpa do pedido. Não
  // nasce campo novo na referência, e o aviso não ganha a linha "Data anterior" dos reagendamentos.
  const servidor = ler("src/lib/vistoria/servidor.ts");
  assert.match(servidor, /visitaAnterior: ref\.visitaAnterior \?\? null/);
  assert.doesNotMatch(servidor, /visitaRecusada/);
  assert.ok(!aoDono.linhas.some((l) => l.rotulo === "Data anterior"));
});

test("E1173 (7) — os três lados leem a recusa pela mesma função pura, e o 'Agendado' continua a ser só dela", () => {
  // Os textos aprovados (1 a 4): ORDEM-DUET-757, com o 3 na versão da ORDEM-DUET-759.
  assert.equal(ROTULO_NAO_CONCORDO, "Não posso nesta data");
  assert.equal(TEXTO_RECUSA_PARA_O_MORADOR, "Avisamos o proprietário e o avaliador. A nova data chega por aqui.");
  assert.equal(TEXTO_RECUSA_PARA_O_DONO, "O morador não pode na data proposta. Proponha outra data ao avaliador.");
  assert.equal(TEXTO_RECUSA_PARA_O_AVALIADOR, "O morador não pode na data proposta. Proponha outra data.");
  // Dono: a frase de situação.
  const dono = { status: "designado", aguardandoAvaliador: false, ocupado: true, concordanciaEm: null, agendadoPara: null };
  assert.equal(situacaoDono({ ...dono, concordanciaPedidaEm: AGORA }), TEXTO_RECUSA_PARA_O_DONO);
  assert.equal(situacaoDono({ ...dono, concordanciaPedidaEm: null }), null, "aceito sem data, sem recusa: a frase de antes (nenhuma)");
  assert.equal(situacaoDono(dono), null, "quem não passa a coluna lê como antes");
  assert.equal(situacaoDono({ ...dono, agendadoPara: DATA, concordanciaPedidaEm: AGORA }), "Data proposta: a visita fica confirmada quando o morador concordar.");
  const bloco = ler("src/components/vistoria/bloco-avaliacao-dono.tsx");
  assert.match(bloco, /concordanciaPedidaEm: atual\.concordancia_pedida_em/);
  // A folha: com a recusa sai o "Combinem a data da visita." genérico do bloco do dono (a frase da recusa já diz o passo).
  assert.match(bloco, /aceitoSemDataDeVisita\(\{ status: atual\.status, propostaAceitaEm: atual\.proposta_aceita_em, agendadoPara: atual\.agendado_para \}\) && !recusouAData && \(/);
  assert.match(bloco, /const recusouAData = !!atual && concordanciaRecusada\(/);
  // Avaliador: a frase dele, no item do pedido.
  const avaliador = ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx");
  assert.match(avaliador, /concordanciaRecusada\(\{ status: p\.status, ocupado: p\.ocupado, agendadoPara: p\.agendado_para, concordanciaPedidaEm: p\.concordancia_pedida_em, concordanciaEm: p\.concordancia_em \}\)/);
  assert.match(avaliador, /data-testid="avaliador-concordancia-recusada"/);
  assert.match(avaliador, /\{TEXTO_RECUSA_PARA_O_AVALIADOR\}/);
  // A folha: "a lista e a tela do pedido" — a tela do pedido do avaliador lê a mesma frase.
  const telaDoPedido = ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/[pedido]/page.tsx");
  assert.match(telaDoPedido, /recusaDaData=\{concordanciaRecusada\(\{ status: p\.status as string, ocupado: Boolean\(p\.ocupado\), agendadoPara: p\.agendado_para as string \| null, concordanciaPedidaEm: p\.concordancia_pedida_em as string \| null, concordanciaEm: p\.concordancia_em as string \| null \}\) \? TEXTO_RECUSA_PARA_O_AVALIADOR : null\}/);
  const componente = ler("src/components/avaliadores/pedido.tsx");
  assert.match(componente, /\{etapa === "aceito" && recusaDaData && \(\s*<p className="text-base font-semibold text-ink" data-testid="pedido-concordancia-recusada">\s*\{recusaDaData\}/);
  // Morador: a página dele tem o "Não concordo", lê a recusa e leva o "Prefiro outro horário" à conversa com o dono.
  const pagina = ler("src/app/(dashboard)/dashboard/avaliacao-imovel/[id]/page.tsx");
  assert.match(pagina, /<FormAcao acao=\{recusarDataDaVisita\}/);
  assert.match(pagina, /data-testid="nao-concordar-visita"/);
  assert.match(pagina, /\{ROTULO_NAO_CONCORDO\}/);
  assert.match(pagina, /data-testid="concordancia-recusada"/);
  assert.match(pagina, /\{TEXTO_RECUSA_PARA_O_MORADOR\}/);
  assert.match(pagina, /urlDaConversa\(conversationId\(user\.id, p\.owner_id, p\.property_id\)\)/);
  assert.doesNotMatch(pagina, /href="\/dashboard\/mensagens"/, "o link deixa de cair na lista geral das mensagens");
  // O cartão da conversa da estadia é a mesma superfície: o mesmo botão e a mesma leitura.
  const cartao = ler("src/components/vistoria/avaliacao-na-conversa.tsx");
  assert.match(cartao, /recusarDataDaVisita\(f\)/);
  assert.match(cartao, /data-testid="conversa-nao-concordar"/);
  assert.match(cartao, /\{TEXTO_RECUSA_PARA_O_MORADOR\}/);
  const conversa = ler("src/lib/vistoria/conversa-actions.ts");
  assert.match(conversa, /const recusada = concordanciaRecusada\(/);
  assert.match(conversa, /confirmada: !!data\.concordancia_em, recusada \};/);
  // Ninguém responde por ela: nenhuma outra ação grava a concordância.
  const acoes = ler("src/lib/vistoria/actions.ts");
  assert.equal(acoes.split("concordancia_em: new Date().toISOString()").length - 1, 1, "só o 'Concordo' dela grava a concordância");
});
