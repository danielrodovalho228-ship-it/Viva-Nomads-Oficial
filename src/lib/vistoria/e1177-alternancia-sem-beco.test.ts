import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EVENTOS_VISTORIA_COM_FATOS, corpoVistoria } from "./corpo-email.ts";
import { situacaoDono } from "./telas-exibicao.ts";
import { mensagemDepoisDaTroca, textoDaTroca } from "./troca-de-avaliador.ts";
import { TEMPLATES } from "../notifications/eventos-email.ts";
import { MATRIZ_NOTIFICACOES } from "../../config/matriz-notificacoes.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";
import { designacaoQueVolta, elegiveisComAlternancia, jaDesignadosNoPedido, proximoAvaliador, type AvaliadorFila, type HistoricoDesignacao, type PedidoParaDesignar } from "./regras.ts";
import { sugerirAvaliadores } from "./escolha.ts";
import { SO_O_ANTERIOR, TEXTO_DA_ESPERA, TEXTO_MESMO_AVALIADOR, avisoAoDono, estadoDaEscolha, motivoDaEspera, textoDaEspera } from "./espera-de-avaliador.ts";
import { PRAZO_EQUIPE_CONTESTACAO_DIAS_UTEIS } from "./prazos.ts";
import { ROTULO_FILA } from "./rotulos-da-fila.ts";

/*
  E1177 (ORDENS-DUET 773 e 778; decisão do coordenador: a saída B, com dois limites; linha Parceiros). A regra da
  independência tira da escolha quem fez a ÚLTIMA avaliação do imóvel. Numa cidade com um avaliador só, a segunda
  avaliação nunca acontecia: o dono lia "Aguardando avaliador: a Viva avisa quando houver…", uma promessa que a própria
  regra tornava impossível de cumprir (casos reais: os imóveis dos laudos VIS-2026-000001 e VIS-2026-000002).
  A exceção da alternância: se não sobra NENHUM elegível e há um impedido SÓ por "avaliação anterior", ele volta a ser
  elegível, com a marca mesmoDaAnterior. Nenhum outro impedimento cede: 1ª da contestação, relação declarada, serviço em
  12 meses, suspenso, não ativo, conta de teste, outra cidade.
  Roda: node --test src/lib/vistoria/e1177-alternancia-sem-beco.test.ts
*/
const ler = (p: string) => semComentarios(readFileSync(p, "utf8"));
const AGORA = new Date("2026-11-24T15:00:00Z");
const av = (id: string, extra: Partial<AvaliadorFila> = {}): AvaliadorFila => ({ id, userId: `u-${id}`, cidade: "Uberlândia", status: "ativo", teste: false, credenciadoEm: "2026-01-01T00:00:00Z", ultimaDesignacaoEm: null, relacoesDonos: [], relacoesImoveis: [], ...extra });
const PEDIDO: PedidoParaDesignar = { id: "p2", propertyId: "imovel-1", ownerId: "dono-1", cidade: "Uberlândia", tipo: "nova_avaliacao", teste: false, primeiroAvaliadorId: null, jaDesignados: [] };
/** O imóvel já tem um laudo, feito pelo avaliador "anterior". */
const COM_LAUDO: HistoricoDesignacao = { servicosAoDono: [], avaliacoesDoImovel: [{ avaliadorId: "anterior", em: "2026-11-22T03:16:00Z" }] };
const SEM_LAUDO: HistoricoDesignacao = { servicosAoDono: [], avaliacoesDoImovel: [] };
const ids = (l: readonly { id: string }[]) => l.map((a) => a.id);

test("E1177 (1): cidade com 1 avaliador, que fez a última avaliação — ele volta, com a marca mesmoDaAnterior", () => {
  const fila = [av("anterior")];
  const r = proximoAvaliador(fila, PEDIDO, COM_LAUDO, AGORA);
  assert.equal(r.avaliador?.id, "anterior");
  assert.equal(r.avaliador?.mesmoDaAnterior, true);
  assert.deepEqual(r.impedidos, [], "quem voltou pela exceção já não consta como impedido");
  const s = sugerirAvaliadores(fila, PEDIDO, COM_LAUDO, AGORA);
  assert.deepEqual(ids(s.sugeridos), ["anterior"]);
  assert.equal(s.sugeridos[0].mesmoDaAnterior, true);
  assert.deepEqual(s.impedidos, []);
  // Sem laudo anterior não há exceção nenhuma a aplicar: ele é elegível como qualquer outro, sem a marca.
  assert.equal(sugerirAvaliadores(fila, PEDIDO, SEM_LAUDO, AGORA).sugeridos[0].mesmoDaAnterior, undefined);
});

test("E1177 (2): cidade com 2 avaliadores — o outro é escolhido e a regra se mantém", () => {
  const fila = [av("anterior"), av("outro")];
  const r = proximoAvaliador(fila, PEDIDO, COM_LAUDO, AGORA);
  assert.equal(r.avaliador?.id, "outro");
  assert.equal(r.avaliador?.mesmoDaAnterior, undefined);
  assert.deepEqual(r.impedidos, [{ id: "anterior", motivo: "avaliacao_anterior" }]);
  const s = sugerirAvaliadores(fila, PEDIDO, COM_LAUDO, AGORA);
  assert.deepEqual(ids(s.sugeridos), ["outro"], "havendo outro, o da avaliação anterior não aparece");
  assert.deepEqual(s.impedidos, [{ id: "anterior", motivo: "avaliacao_anterior" }]);
});

test("E1177 (3): 2 avaliadores, o outro impedido por relação declarada — volta o anterior, com a marca", () => {
  const fila = [av("anterior"), av("parente", { relacoesDonos: ["dono-1"] })];
  const r = proximoAvaliador(fila, PEDIDO, COM_LAUDO, AGORA);
  assert.equal(r.avaliador?.id, "anterior");
  assert.equal(r.avaliador?.mesmoDaAnterior, true);
  assert.deepEqual(r.impedidos, [{ id: "parente", motivo: "relacao_declarada" }], "a relação declarada não cede");
  const s = sugerirAvaliadores(fila, PEDIDO, COM_LAUDO, AGORA);
  assert.deepEqual(ids(s.sugeridos), ["anterior"]);
  assert.equal(s.sugeridos[0].mesmoDaAnterior, true);
});

test("E1177 (4): contestação com um avaliador só — ninguém elegível (a 1ª da contestação nunca cede)", () => {
  const contestacao: PedidoParaDesignar = { ...PEDIDO, tipo: "contestacao", primeiroAvaliadorId: "anterior" };
  const r = proximoAvaliador([av("anterior")], contestacao, COM_LAUDO, AGORA);
  assert.equal(r.avaliador, null);
  assert.deepEqual(r.impedidos, [{ id: "anterior", motivo: "primeira_da_contestacao" }]);
  const s = sugerirAvaliadores([av("anterior")], contestacao, COM_LAUDO, AGORA);
  assert.deepEqual(s.sugeridos, []);
  assert.deepEqual(s.impedidos, [{ id: "anterior", motivo: "primeira_da_contestacao" }]);
});

test("E1177 (5): o anterior com relação declarada continua impedido — e o motivo dito é o que de fato o impede", () => {
  for (const extra of [{ relacoesDonos: ["dono-1"] }, { relacoesImoveis: ["imovel-1"] }]) {
    const r = proximoAvaliador([av("anterior", extra)], PEDIDO, COM_LAUDO, AGORA);
    assert.equal(r.avaliador, null);
    assert.deepEqual(r.impedidos, [{ id: "anterior", motivo: "relacao_declarada" }]);
    assert.deepEqual(sugerirAvaliadores([av("anterior", extra)], PEDIDO, COM_LAUDO, AGORA).sugeridos, []);
  }
  // O serviço ao dono nos últimos 12 meses também não cede.
  const servico: HistoricoDesignacao = { ...COM_LAUDO, servicosAoDono: [{ userId: "u-anterior", ownerId: "dono-1", em: "2026-10-01T00:00:00Z" }] };
  assert.deepEqual(proximoAvaliador([av("anterior")], PEDIDO, servico, AGORA).impedidos, [{ id: "anterior", motivo: "servico_12_meses" }]);
});

test("E1177: a exceção só vale para a avaliação anterior — suspenso, não ativo, conta de teste, outra cidade e já designado não voltam", () => {
  const casos: [string, Partial<AvaliadorFila>, Partial<PedidoParaDesignar>, string | null][] = [
    ["suspenso", { status: "suspenso" }, {}, "suspenso"],
    ["nao_ativo", { status: "em_teste" }, {}, "nao_ativo"],
    ["conta_teste", { teste: true }, {}, "conta_teste"],
    ["ja_designado", {}, { jaDesignados: ["anterior"] }, "ja_designado"],
    // Outra cidade nem entra na lista dos impedidos desta cidade.
    ["outra_cidade", { cidade: "Araguari" }, {}, null],
  ];
  for (const [nome, extra, pedido, motivo] of casos) {
    const r = elegiveisComAlternancia([av("anterior", extra)], { ...PEDIDO, ...pedido }, COM_LAUDO, AGORA);
    assert.deepEqual(r.elegiveis, [], nome);
    assert.deepEqual(r.impedidos, motivo ? [{ id: "anterior", motivo }] : [], nome);
  }
});

test("E1177: a função pura devolve os elegíveis na ordem do rodízio; a marca só existe em quem voltou pela exceção", () => {
  const fila = [av("b", { ultimaDesignacaoEm: "2026-11-10T00:00:00Z" }), av("a"), av("anterior")];
  const r = elegiveisComAlternancia(fila, PEDIDO, COM_LAUDO, AGORA);
  assert.deepEqual(ids(r.elegiveis), ["a", "b"], "nunca designado primeiro");
  assert.ok(r.elegiveis.every((a) => a.mesmoDaAnterior === undefined));
  // A avaliação ANTES da anterior não impede ninguém (regra de sempre).
  const dois: HistoricoDesignacao = { servicosAoDono: [], avaliacoesDoImovel: [{ avaliadorId: "a", em: "2026-10-01T00:00:00Z" }, { avaliadorId: "anterior", em: "2026-11-22T00:00:00Z" }] };
  assert.deepEqual(ids(elegiveisComAlternancia([av("a"), av("anterior")], PEDIDO, dois, AGORA).elegiveis), ["a"]);
});

test("E1177: a designação antiga, sem o campo da 0359, vence pelo prazo padrão — o avaliador fica fora e a escolha é do dono", () => {
  // O caso do pedido cdd4fe9c: designado em 22/11, "expirada" em 23/11, antes de existir a marca da proposta vencida.
  const antiga = { avaliador_id: "rogerio", resposta: "expirada", proposta_expirada_em: null };
  assert.equal(designacaoQueVolta(antiga), false, "sem a marca, é o silêncio do avaliador pelo prazo padrão dele");
  const jaDesignados = jaDesignadosNoPedido([antiga]);
  assert.deepEqual(jaDesignados, ["rogerio"]);
  // A escolha volta ao dono: com o Rogério fora, sobra o da avaliação anterior — que a exceção devolve, com a marca.
  const s = sugerirAvaliadores([av("rogerio"), av("anterior")], { ...PEDIDO, jaDesignados }, COM_LAUDO, AGORA);
  assert.deepEqual(ids(s.sugeridos), ["anterior"]);
  assert.equal(s.sugeridos[0].mesmoDaAnterior, true);
  assert.deepEqual(s.impedidos, [{ id: "rogerio", motivo: "ja_designado" }]);
});

// ── O estado vazio honesto: cada motivo de lista vazia tem o seu texto; nenhum promete o que a regra impede ─────
test("E1177: o motivo da lista vazia — sem ninguém na cidade, contestação sem segundo, ou o que impede quem lá está", () => {
  assert.equal(motivoDaEspera("nova_avaliacao", []), "sem_avaliador_na_cidade");
  assert.equal(motivoDaEspera("contestacao", []), "sem_avaliador_na_cidade", "contestação numa cidade sem ninguém: é a cidade que não tem avaliador");
  // Contestação: há quem fez a 1ª e não há um segundo que possa — o que os outros tenham não muda o caso.
  assert.equal(motivoDaEspera("contestacao", ["primeira_da_contestacao"]), "contestacao_sem_segundo");
  assert.equal(motivoDaEspera("contestacao", ["primeira_da_contestacao", "relacao_declarada", "suspenso"]), "contestacao_sem_segundo");
  // Fora da contestação, "1ª da contestação" nem acontece; se viesse, não inventava o caso.
  assert.notEqual(motivoDaEspera("nova_avaliacao", ["primeira_da_contestacao"]), "contestacao_sem_segundo");
  assert.equal(motivoDaEspera("nova_avaliacao", ["ja_designado"]), "ja_escolhidos");
  assert.equal(motivoDaEspera("nova_avaliacao", ["ja_designado", "ja_designado"]), "ja_escolhidos");
  for (const m of ["relacao_declarada", "servico_12_meses", "avaliacao_anterior"] as const) assert.equal(motivoDaEspera("nova_avaliacao", [m]), "independencia", m);
  for (const m of ["suspenso", "nao_ativo", "conta_teste", "fora_do_piloto"] as const) assert.equal(motivoDaEspera("inicial", [m]), "indisponiveis", m);
  // Motivos de famílias diferentes: o texto não escolhe um e cala o outro.
  assert.equal(motivoDaEspera("nova_avaliacao", ["ja_designado", "relacao_declarada"]), "varios");
  assert.equal(motivoDaEspera("nova_avaliacao", ["suspenso", "servico_12_meses"]), "varios");
});

test("E1177: os textos do estado vazio — os dois aprovados, e 'a Viva avisa' só quando não há ninguém que atenda a cidade", () => {
  assert.equal(TEXTO_DA_ESPERA.sem_avaliador_na_cidade, "Ainda não há avaliador disponível na sua cidade. A Viva avisa você assim que houver um.");
  assert.equal(PRAZO_EQUIPE_CONTESTACAO_DIAS_UTEIS, 2);
  assert.equal(TEXTO_DA_ESPERA.contestacao_sem_segundo, "Sua contestação precisa de um avaliador diferente do primeiro. Ainda não há outro na sua cidade, então a equipe da Viva assumiu o seu pedido e responde em até 2 dias úteis.");
  const promessa = /[aA] Viva avisa|avisaremos|quando houver/;
  for (const [motivo, texto] of Object.entries(TEXTO_DA_ESPERA)) {
    if (motivo === "sem_avaliador_na_cidade") assert.match(texto, promessa);
    else assert.doesNotMatch(texto, promessa, `${motivo} não promete aviso`);
    assert.ok(texto.length > 20 && texto.endsWith("."), motivo);
  }
  // Cada motivo tem o seu texto, e nenhum repete outro.
  assert.equal(new Set(Object.values(TEXTO_DA_ESPERA)).size, Object.keys(TEXTO_DA_ESPERA).length);
  assert.deepEqual(Object.keys(TEXTO_DA_ESPERA).sort(), ["contestacao_sem_segundo", "independencia", "indisponiveis", "ja_escolhidos", "sem_avaliador_na_cidade", "varios"]);
  // O pedido antigo, ainda sem o motivo gravado, lê um texto que não promete nada.
  for (const sem of [null, undefined, "", "outro"]) assert.doesNotMatch(textoDaEspera(sem), promessa);
  assert.equal(textoDaEspera("sem_avaliador_na_cidade"), TEXTO_DA_ESPERA.sem_avaliador_na_cidade);
  assert.equal(textoDaEspera("contestacao_sem_segundo"), TEXTO_DA_ESPERA.contestacao_sem_segundo);
});

test("E1177: o cartão do mesmo avaliador e o item da fila da contestação dizem o texto aprovado", () => {
  assert.equal(TEXTO_MESMO_AVALIADOR, "Mesmo avaliador da avaliação anterior. É o único disponível na sua cidade agora. Você pode escolher ele ou esperar outro avaliador.");
  assert.equal(ROTULO_FILA.contestacao_sem_avaliador, "Contestação sem segundo avaliador na cidade — a equipe decide");
  assert.equal(SO_O_ANTERIOR, "so_o_anterior");
});

// ── O estado da escolha que o pedido guarda, e o aviso ao dono quando a lista abre ────────────────────────────
test("E1177: o estado da escolha — lista comum, só o da avaliação anterior, ou lista vazia com o motivo", () => {
  const comum: { id: string; mesmoDaAnterior?: true } = { id: "a" };
  const anterior: { id: string; mesmoDaAnterior?: true } = { id: "b", mesmoDaAnterior: true };
  assert.deepEqual(estadoDaEscolha("nova_avaliacao", [comum], []), { aguardando: false, motivo: null });
  assert.deepEqual(estadoDaEscolha("nova_avaliacao", [comum], ["avaliacao_anterior"]), { aguardando: false, motivo: null });
  // Só o da avaliação anterior: a lista não está vazia (o dono pode escolhê-lo), mas o pedido continua a procurar outro.
  assert.deepEqual(estadoDaEscolha("nova_avaliacao", [anterior], ["ja_designado"]), { aguardando: false, motivo: "so_o_anterior" });
  assert.deepEqual(estadoDaEscolha("nova_avaliacao", [], []), { aguardando: true, motivo: "sem_avaliador_na_cidade" });
  assert.deepEqual(estadoDaEscolha("contestacao", [], ["primeira_da_contestacao"]), { aguardando: true, motivo: "contestacao_sem_segundo" });
  assert.deepEqual(estadoDaEscolha("nova_avaliacao", [], ["relacao_declarada"]), { aguardando: true, motivo: "independencia" });
});

test("E1177: o dono é avisado quando a lista abre e quando chega outro avaliador — e só nessas duas passagens", () => {
  const vazia = { aguardando: true, motivo: "sem_avaliador_na_cidade" };
  const vaziaAntiga = { aguardando: true, motivo: null }; // o pedido que já esperava antes desta regra
  const soAnterior = { aguardando: false, motivo: "so_o_anterior" };
  const comum = { aguardando: false, motivo: null };
  // A promessa "a Viva avisa você assim que houver um": a lista estava vazia e deixou de estar.
  assert.equal(avisoAoDono(vazia, comum), "lista_abriu");
  assert.equal(avisoAoDono(vaziaAntiga, comum), "lista_abriu");
  assert.equal(avisoAoDono(vazia, soAnterior), "lista_abriu", "abriu com o da avaliação anterior: o dono já pode escolher");
  // "…ou esperar outro avaliador": quem esperava com o cartão do anterior é avisado quando há outro.
  assert.equal(avisoAoDono(soAnterior, comum), "chegou_outro");
  // Nada mudou, ou o pedido acabou de nascer, ou a lista esvaziou: sem aviso.
  assert.equal(avisoAoDono(comum, comum), null);
  assert.equal(avisoAoDono(soAnterior, soAnterior), null);
  assert.equal(avisoAoDono(vazia, vazia), null);
  assert.equal(avisoAoDono(comum, soAnterior), null);
  assert.equal(avisoAoDono(comum, vazia), null);
  assert.equal(avisoAoDono(soAnterior, vazia), null);
});

// ── As superfícies: o que o dono lê em cada lugar sai da mesma fonte ──────────────────────────────────────────
const PEDIDO_DO_DONO = { status: "pedido", ocupado: false, concordanciaEm: null, agendadoPara: null };

test("E1177: a frase de situação do dono diz o motivo da lista vazia — nunca a promessa de sempre", () => {
  for (const motivo of Object.keys(TEXTO_DA_ESPERA) as (keyof typeof TEXTO_DA_ESPERA)[]) {
    assert.equal(situacaoDono({ ...PEDIDO_DO_DONO, aguardandoAvaliador: true, motivoDaEspera: motivo }), TEXTO_DA_ESPERA[motivo], motivo);
  }
  // O pedido antigo, ainda sem motivo gravado: o texto que não promete.
  assert.equal(situacaoDono({ ...PEDIDO_DO_DONO, aguardandoAvaliador: true }), TEXTO_DA_ESPERA.varios);
  // Só o da avaliação anterior: a lista existe, o dono escolhe na lista (o cartão diz o resto).
  assert.equal(situacaoDono({ ...PEDIDO_DO_DONO, aguardandoAvaliador: false, motivoDaEspera: "so_o_anterior" }), "Pedido registrado: escolha o avaliador na lista.");
});

test("E1177: a troca de avaliador e os e-mails deixam de prometer o aviso quando não sobra ninguém", () => {
  const sem = textoDaTroca({ numero: "UDI-001", valor: "R$ 380,00", prazoDias: 3, outros: 0, cidade: "Uberlândia" });
  assert.equal(sem.depois, "Atenção: não há outro avaliador disponível em Uberlândia agora. Se você descartar, o pedido fica aguardando e a equipe da Viva é avisada.");
  assert.equal(mensagemDepoisDaTroca(true), "Avaliador e proposta descartados. Não há outro avaliador disponível agora. A equipe da Viva foi avisada.");
  const imovel = { id: "i1", titulo: "Apto Santa Mônica", bairro: "Santa Mônica", cidade: "Uberlândia" };
  for (const ev of ["vistoria_recusada_dono", "vistoria_sem_resposta_dono", "vistoria_proposta_expirada_dono"] as const) {
    const corpo = corpoVistoria(ev, { imovel, aguardandoAvaliador: true }).body("Lara");
    assert.match(corpo, /Não há outro avaliador disponível agora\. A equipe da Viva foi avisada\.$/, ev);
    assert.doesNotMatch(corpo, /avisa quando houver/, ev);
  }
  // A verificação aberta pela Viva diz o motivo gravado no pedido.
  const ver = (motivoDaEspera: string | null) => corpoVistoria("vistoria_verificacao", { imovel, aguardandoAvaliador: true, motivoDaEspera }).body("Lara");
  assert.ok(ver("sem_avaliador_na_cidade").endsWith(TEXTO_DA_ESPERA.sem_avaliador_na_cidade));
  assert.ok(ver("independencia").endsWith(TEXTO_DA_ESPERA.independencia));
  assert.ok(ver(null).endsWith(TEXTO_DA_ESPERA.varios));
});

test("E1177: o e-mail que cumpre a promessa — a lista abriu, ou chegou outro avaliador", () => {
  const imovel = { id: "i1", titulo: "Apto Santa Mônica", bairro: "Santa Mônica", cidade: "Uberlândia" };
  const abriu = corpoVistoria("vistoria_avaliador_disponivel", { imovel });
  assert.equal(abriu.subject, "Já há avaliador para a avaliação de Apto Santa Mônica");
  assert.equal(abriu.body("Lara"), "Olá Lara, já há avaliador para você escolher na avaliação de Apto Santa Mônica. Escolha na página da avaliação.");
  const outro = corpoVistoria("vistoria_avaliador_disponivel", { imovel, outroAvaliador: true });
  assert.equal(outro.subject, "Há outro avaliador para a avaliação de Apto Santa Mônica");
  assert.equal(outro.body("Lara"), "Olá Lara, há outro avaliador disponível na sua cidade para a avaliação de Apto Santa Mônica. Escolha na página da avaliação.");
  assert.ok(EVENTOS_VISTORIA_COM_FATOS.has("vistoria_avaliador_disponivel"));
  assert.equal(TEMPLATES.vistoria_avaliador_disponivel.subject, "Já há avaliador para a avaliação do seu imóvel");
  assert.equal(TEMPLATES.vistoria_avaliador_disponivel.cta, "Escolher avaliador");
  assert.deepEqual(MATRIZ_NOTIFICACOES.vistoria_avaliador_disponivel.papeis, ["proprietario"]);
});

test("E1177 (estático): 'a Viva avisa' só sai no caso 'sem nenhum avaliador na cidade' — a frase mora num lugar só", () => {
  const promessa = /[aA] Viva avisa|avisaremos quando|[aA]visamos quando houver/g;
  const fontes = [
    "src/lib/vistoria/telas-exibicao.ts",
    "src/lib/vistoria/troca-de-avaliador.ts",
    "src/lib/vistoria/corpo-email.ts",
    "src/lib/vistoria/actions.ts",
    "src/lib/vistoria/laudo-actions.ts",
    "src/lib/vistoria/servidor.ts",
    "src/lib/vistoria/pedido-avaliador.ts",
    "src/components/vistoria/bloco-avaliacao-dono.tsx",
    "src/components/vistoria/troca-de-avaliador.tsx",
    "src/lib/notifications/eventos-email.ts",
  ];
  for (const f of fontes) assert.equal(ler(f).match(promessa), null, f);
  const fonte = ler("src/lib/vistoria/espera-de-avaliador.ts");
  assert.equal(fonte.match(promessa)?.length, 1, "a promessa está escrita uma vez, no texto de 'sem avaliador na cidade'");
  assert.match(fonte, /sem_avaliador_na_cidade: "Ainda não há avaliador disponível na sua cidade\. A Viva avisa você assim que houver um\."/);
  // A constante antiga da promessa geral saiu.
  assert.doesNotMatch(ler("src/lib/vistoria/telas-exibicao.ts"), /A_VIVA_AVISA_QUANDO_HOUVER/);
});

test("E1177 (estático): o servidor guarda o estado, avisa o dono na passagem e marca o mesmo avaliador", () => {
  const srv = ler("src/lib/vistoria/servidor.ts");
  const abrir = srv.slice(srv.indexOf("export async function abrirEscolha("), srv.indexOf("export async function sugeridosDoPedido("));
  assert.match(abrir, /const depois = estadoDaEscolha\(l\.p\.tipo, l\.sugestoes\.sugeridos, fora\);/);
  assert.match(abrir, /motivo_da_espera: depois\.motivo/);
  assert.match(abrir, /const aviso = avisoAoDono\(antes, depois\);/);
  assert.match(abrir, /avisar\(admin, l\.p\.owner_id, "vistoria_avaliador_disponivel"/);
  // A contestação sem segundo avaliador vai para a fila da equipe, com o tipo próprio.
  assert.match(abrir, /depois\.motivo === "contestacao_sem_segundo"/);
  assert.match(abrir, /naFilaDoAdmin\(admin, "contestacao_sem_avaliador"/);
  // A rotina volta a olhar para quem espera: a lista vazia e a lista só com o avaliador anterior.
  const rotina = srv.slice(srv.indexOf("export async function rotinaVistoria("));
  assert.match(rotina, /\.or\(`aguardando_avaliador\.eq\.true,motivo_da_espera\.eq\.\$\{SO_O_ANTERIOR\}`\)/);
  // A escolha do mesmo avaliador fica registrada na designação, e sai do pedido o estado da espera.
  const escolher = srv.slice(srv.indexOf("export async function escolherNoServidor("), srv.indexOf("export async function registrarRespostaDoAvaliador("));
  assert.match(escolher, /mesmo_da_anterior: a\.mesmoDaAnterior === true/);
  assert.match(escolher, /motivo_da_espera: null/);
  // O laudo guarda a mesma marca, lida da designação.
  const laudo = ler("src/lib/vistoria/laudo-servidor.ts");
  assert.match(laudo, /from\("vistoria_designacoes"\)\.select\("mesmo_da_anterior"\)/);
  assert.match(laudo, /mesmo_da_anterior: mesmoDaAnterior,/);
});

test("E1177 (estático): o cartão do dono mostra o texto do coordenador, e a lista vazia o motivo", () => {
  const bloco = ler("src/components/vistoria/bloco-avaliacao-dono.tsx");
  assert.match(bloco, /\{a\.mesmoDaAnterior && \(\s*<span[^>]*data-testid="avaliacao-sugerido-mesmo"[^>]*>\{TEXTO_MESMO_AVALIADOR\}<\/span>/);
  assert.match(bloco, /motivoDaEspera: atual\.motivo_da_espera/);
  assert.match(bloco, /data-testid="avaliacao-escolha-vazia">\{textoDaEspera\(atual\.motivo_da_espera\)\}<\/p>/);
  // A mensagem do pedido novo também diz o motivo.
  const acoes = ler("src/lib/vistoria/actions.ts");
  assert.match(acoes, /`Pedido registrado\. \$\{textoDaEspera\(/);
});

test("E1177: a migração 0362 só acrescenta — três colunas e um tipo da fila — e tem o aplicar e o rollback", () => {
  const mig = readFileSync("supabase/migrations/0362_vistoria_alternancia_sem_beco_e1177.sql", "utf8").replace(/--[^\n]*/g, "");
  assert.match(mig, /alter table public\.vistoria_pedidos\s+add column if not exists motivo_da_espera text/);
  for (const v of ["so_o_anterior", ...Object.keys(TEXTO_DA_ESPERA)]) assert.match(mig, new RegExp(`'${v}'`), v);
  assert.match(mig, /alter table public\.vistoria_designacoes\s+add column if not exists mesmo_da_anterior boolean not null default false/);
  assert.match(mig, /alter table public\.vistoria_laudos\s+add column if not exists mesmo_da_anterior boolean not null default false/);
  // A fila ganha SÓ o tipo deste item (ORDEM-780): os cinco de antes e este; os quatro do laudo são o E1179.
  assert.match(mig, /check \(tipo in \('sem_avaliador', 'avaliacao_teste', 'suspensao_automatica', 'proposta_descredenciamento', 'revisao_criterio', 'contestacao_sem_avaliador'\)\)/);
  assert.doesNotMatch(mig, /laudo_atrasado|ressalva_vencida|devolucao_vencida|seguranca_grave/);
  assert.doesNotMatch(mig, /\bdrop column\b|\bdelete\b|\btruncate\b|\bupdate\b/i);
  const aplicar = readFileSync("supabase/producao/aplicar-0362.sql", "utf8");
  assert.match(aplicar, /^begin;/m);
  assert.match(aplicar, /commit;\s*$/);
  assert.match(aplicar, /'20261124000362', '0362_vistoria_alternancia_sem_beco_e1177'/);
  assert.match(readFileSync("supabase/producao/rollback/0362_rollback.sql", "utf8"), /drop column if exists motivo_da_espera/);
});

test("E1177 (ORDEM-DUET-784): na TELA a nova avaliação diz 'quando houver outro na sua cidade'; o LAUDO não muda", async () => {
  const regras = await import("./regras.ts");
  const { proximoPasso } = await import("./laudo-documento.ts");
  // A tela promete ao vivo: com a exceção, pode não haver outro avaliador na cidade.
  assert.equal(
    (regras as Record<string, unknown>).TEXTO_NOVA_AVALIACAO_NA_TELA,
    "Para voltar a ter o selo “vistoriado”, peça uma nova avaliação: avaliação completa, novo pedido, avaliador à sua escolha (outro que não o da avaliação anterior, quando houver outro na sua cidade), pelo valor que o avaliador propuser.",
  );
  // O laudo é documento assinado: o texto dele fica como estava, palavra por palavra.
  assert.equal(
    regras.TEXTO_NOVA_AVALIACAO,
    "Para voltar a ter o selo “vistoriado”, peça uma nova avaliação: avaliação completa, novo pedido, avaliador à sua escolha (outro que não o da avaliação anterior), pelo valor que o avaliador propuser.",
  );
  assert.ok(proximoPasso("reprovado", null).endsWith(regras.TEXTO_NOVA_AVALIACAO));
  assert.doesNotMatch(proximoPasso("reprovado", null), /quando houver outro/);
  // Cada um lê o seu: a tela do dono nunca o texto do documento, o documento nunca o da tela.
  const bloco = ler("src/components/vistoria/bloco-avaliacao-dono.tsx");
  assert.match(bloco, /data-testid="avaliacao-nova">\{TEXTO_NOVA_AVALIACAO_NA_TELA\}</);
  assert.doesNotMatch(bloco, /TEXTO_NOVA_AVALIACAO\b(?!_NA_TELA)/);
  assert.doesNotMatch(ler("src/lib/vistoria/laudo-documento.ts"), /TEXTO_NOVA_AVALIACAO_NA_TELA/);
  // A frase continua escrita uma vez só: as duas saem do mesmo molde.
  assert.equal(ler("src/lib/vistoria/regras.ts").split("peça uma nova avaliação").length - 1, 1);
});
