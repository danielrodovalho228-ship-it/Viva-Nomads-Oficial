/*
  E1098 (ORDEM-DUET-505) — a tela de detalhe do chamado da Central, pelo mockup aprovado. Os três comportamentos da
  ordem, provados nas regras puras (a tela só as desenha):
   1. RÓTULOS DE PRIORIDADE unificados: "Urgente · P1", "Alta · P2", "Normal · P3", "Baixa · P4" — o mesmo texto no
      selo, no seletor e no histórico;
   2. INDICADOR ÚNICO DO PRAZO: "Resolver até hoje, 22/11, às 16:40 · Faltam 8 horas";
   3. RESPOSTA ÚNICA: o texto que foi (ou vai) para a pessoa aparece uma vez na tela;
  e o histórico em linguagem simples (frases, nunca o código do evento).
  Roda: node --test src/lib/atendimento/e1098-detalhe-chamado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  OPCOES_PRIORIDADE,
  historicoEmLinguagemSimples,
  indicadorDoPrazo,
  iniciais,
  itensDaConversa,
  linhaDaFalta,
  rotuloCanal,
  rotuloCategoria,
  rotuloPrioridade,
  rotuloStatus,
  vezesNaConversa,
  type EventoDoChamado,
  type MensagemDoChamado,
} from "./detalhe-chamado.ts";
import { respostaDaSugestao } from "./acolhimento.ts";

const TELA = readFileSync(new URL("../../app/(dashboard)/admin/atendimento/[id]/chamado-client.tsx", import.meta.url), "utf8");
// O caso do mockup: aberto em 20/11 16:40 (Brasília), resolver até 22/11 16:40; a equipe olha em 22/11 às 08:56.
const ABERTO = "2026-11-20T19:40:00Z";
const PRAZO = "2026-11-22T19:40:00Z";
const AGORA = new Date("2026-11-22T11:56:00Z");
const chamado = { status: "aguardando_usuario", criado_em: ABERTO, prazo_resolucao: PRAZO };

test("E1098 (1): rótulos de prioridade unificados, no selo, no seletor e no histórico", () => {
  assert.deepEqual(["p1", "p2", "p3", "p4"].map(rotuloPrioridade), ["Urgente · P1", "Alta · P2", "Normal · P3", "Baixa · P4"]);
  assert.deepEqual(OPCOES_PRIORIDADE.map((o) => `${o.valor}=${o.rotulo}`), ["p1=Urgente · P1", "p2=Alta · P2", "p3=Normal · P3", "p4=Baixa · P4"]);
  const [linha] = historicoEmLinguagemSimples([ev("prioridade_subiu", "2026-11-21T10:00:00Z", { de: "p2", para: "p1", ator_tipo: "sistema" })], CTX);
  assert.equal(linha.oQue, "Prioridade aumentada para Urgente · P1");
  // Na tela, o selo e o seletor leem a mesma função; as formas antigas ("P1 — Urgente", "Prioridade alta") não existem.
  assert.match(TELA, /\{rotuloPrioridade\(c\.prioridade\)\}/);
  assert.match(TELA, /OPCOES_PRIORIDADE\.map\(/);
  assert.doesNotMatch(TELA, /toUpperCase\(\)\} — |Prioridade alta|PRAZOS\[p\]\.rotulo/);
});

test("E1098 (2): um só indicador de prazo, no formato da ordem", () => {
  const i = indicadorDoPrazo(chamado, AGORA);
  assert.equal(i.frase, "Resolver até hoje, 22/11, às 16:40 · Faltam 8 horas");
  assert.equal(i.titulo, "Prazo de resolução · em risco");
  assert.equal(i.quando, "Resolver até hoje, 22/11, às 16:40");
  assert.equal(linhaDaFalta(i), "Faltam 8 horas (horário de Brasília)");
  assert.equal(i.curto, "Resolução · faltam 8 h");
  assert.equal(i.tom, "risco");
  assert.ok(i.fracao > 0.75 && i.fracao < 1);
  // Amanhã, outro dia, singular, minutos, vencido e fechado.
  assert.equal(indicadorDoPrazo(chamado, new Date("2026-11-21T19:40:00Z")).frase, "Resolver até amanhã, 22/11, às 16:40 · Faltam 24 horas");
  assert.equal(indicadorDoPrazo({ ...chamado, prazo_resolucao: "2026-11-27T19:40:00Z" }, new Date("2026-11-21T19:40:00Z")).frase, "Resolver até 27/11, às 16:40 · Faltam 6 dias");
  assert.equal(indicadorDoPrazo(chamado, new Date("2026-11-22T18:40:00Z")).falta, "Falta 1 hora");
  assert.equal(indicadorDoPrazo(chamado, new Date("2026-11-22T19:05:00Z")).falta, "Faltam 35 minutos");
  const vencido = indicadorDoPrazo(chamado, new Date("2026-11-22T22:40:00Z"));
  assert.deepEqual([vencido.tom, vencido.titulo, vencido.frase], ["vencido", "Prazo de resolução · vencido", "Resolver até hoje, 22/11, às 16:40 · Venceu há 3 horas"]);
  const fechado = indicadorDoPrazo({ ...chamado, status: "resolvido" }, AGORA);
  assert.deepEqual([fechado.tom, fechado.falta, fechado.quando], ["fechado", "", "O prazo era hoje, 22/11, às 16:40"]);
  // Na tela: UM indicador (data-testid="chamado-prazo"), e o relógio antigo ("1ª resposta: …") saiu.
  assert.equal(TELA.match(/data-testid="chamado-prazo"/g)?.length, 1);
  assert.doesNotMatch(TELA, /1ª resposta: \{r\.texto\}|relogio\(c, /);
});

const CTX = { nomeDaPessoa: "Daniel", canal: "Chat do site", categoria: "Conta ou acesso" };
function ev(acao: string, criado_em: string, extra: Partial<EventoDoChamado> = {}): EventoDoChamado {
  return { acao, de: null, para: null, detalhe: null, ator_tipo: "sistema", ator_nome: null, criado_em, ...extra };
}

test("E1098: o histórico diz o que aconteceu em frases, do mais recente para o mais antigo", () => {
  const eventos = [
    ev("aberto", "2026-11-20T19:40:00Z", { ator_tipo: "usuario" }),
    ev("pediu_humano", "2026-11-20T19:40:01Z", { ator_tipo: "usuario", para: "p2", detalhe: 'abriu pelo "Falar com uma pessoa"' }),
    ev("acolhido", "2026-11-20T19:40:05Z"),
    ev("resumo_ia", "2026-11-20T19:40:20Z", { ator_tipo: "admin", detalhe: "gerado ao abrir" }),
    ev("sugestao_ia", "2026-11-20T19:40:40Z", { ator_tipo: "admin" }),
    ev("escalado_2h", "2026-11-21T10:00:00Z"),
    ev("escalado_6h", "2026-11-21T10:00:10Z"),
    ev("prioridade_subiu", "2026-11-21T10:00:20Z", { de: "p2", para: "p1" }),
    ev("sugestao_aprovada", "2026-11-22T11:56:00Z", { ator_tipo: "admin", ator_nome: "Marina Souza", de: "41" }),
    ev("respondido", "2026-11-22T11:56:01Z", { ator_tipo: "admin", ator_nome: "Marina Souza", de: "aberto", para: "aguardando_usuario" }),
  ];
  const h = historicoEmLinguagemSimples(eventos, CTX);
  assert.deepEqual(
    h.map((l) => `${l.quando} | ${l.oQue} | ${l.detalhe} | ${l.tom}`),
    [
      "22/11/2026 · 08:56 | Equipe respondeu à pessoa | A sugestão da Viva foi enviada como estava. O chamado passou a aguardar a resposta do usuário. | chave",
      "21/11/2026 · 07:00 | Prioridade aumentada para Urgente · P1 | Aumento automático por falta de resposta da equipe. | alerta",
      "21/11/2026 · 07:00 | Alertas de prazo enviados à equipe | 2 horas e depois 6 horas sem resposta humana — o chamado foi destacado na Central. | alerta",
      "20/11/2026 · 16:40 | Resumo e sugestão gerados pela Viva (IA) | Gerados automaticamente na abertura do chamado. | normal",
      "20/11/2026 · 16:40 | Confirmação automática enviada à pessoa | Acolhimento automático com o prazo de resposta de até 24 horas. | normal",
      "20/11/2026 · 16:40 | Chamado aberto por Daniel | Pelo chat do site, na opção “Falar com uma pessoa” · Categoria: Conta ou acesso. | chave",
    ],
  );
  // Aberto pelo formulário (sem o "Falar com uma pessoa") e o pedido de pessoa feito DEPOIS, dentro do chamado: linhas próprias.
  const semChat = historicoEmLinguagemSimples(
    [ev("aberto", "2026-11-20T19:40:00Z", { ator_tipo: "usuario" }), ev("pediu_humano", "2026-11-21T12:00:00Z", { ator_tipo: "usuario", detalhe: "pediu para falar com uma pessoa no chamado" })],
    { ...CTX, canal: "Central de Ajuda" },
  );
  assert.deepEqual(semChat.map((l) => `${l.oQue} | ${l.detalhe}`), ["A pessoa pediu para falar com uma pessoa da equipe | Pela opção “Falar com uma pessoa”.", "Chamado aberto por Daniel | Canal: Central de Ajuda · Categoria: Conta ou acesso."]);
  // Nenhum código de evento nem "de → para" cru chega à tela, mesmo num evento que a regra não conhece.
  const outros = historicoEmLinguagemSimples(
    [
      ev("status", "2026-11-23T12:00:00Z", { ator_tipo: "admin", ator_nome: "Marina Souza", de: "aberto", para: "resolvido" }),
      ev("prioridade", "2026-11-23T12:01:00Z", { ator_tipo: "admin", ator_nome: "Marina Souza", de: "p1", para: "p3" }),
      ev("atribuido", "2026-11-23T12:02:00Z", { ator_tipo: "admin", ator_nome: "Marina Souza", para: "admin" }),
      ev("consulta_pessoa", "2026-11-23T12:03:00Z", { ator_tipo: "admin", ator_nome: null, detalhe: "painel Quem é a pessoa" }),
      ev("evento_que_ninguem_previu", "2026-11-23T12:04:00Z", { de: "a", para: "b", detalhe: "algo aconteceu" }),
      ev("sugestao_editada", "2026-11-23T12:05:00Z", { ator_tipo: "admin", de: "55" }),
    ],
    CTX,
  );
  const texto = outros.map((l) => `${l.oQue} ${l.detalhe}`).join("\n");
  assert.match(texto, /Chamado marcado como resolvido Por Marina\./);
  assert.match(texto, /Prioridade alterada para Normal · P3 Por Marina\./);
  assert.match(texto, /Chamado atribuído a Marina/);
  assert.match(texto, /Uma pessoa da equipe consultou o perfil da pessoa/);
  assert.match(texto, /Evento que ninguem previu Algo aconteceu\./);
  assert.match(texto, /Equipe respondeu à pessoa A sugestão da Viva foi editada antes do envio\./);
  assert.doesNotMatch(texto, /→|_|\bp[1-4]\b|sugestao|aguardando_/);
  // A tela usa esta função e já não tem a lista de códigos nem o "de → para".
  assert.match(TELA, /historicoEmLinguagemSimples\(eventos, /);
  assert.doesNotMatch(TELA, /const ACAO: Record|\$\{e\.de \?\? "—"\} → /);
});

const RESPOSTA = "Olá, Daniel! O site da Viva Nomads está em pré-lançamento e o lançamento oficial será em 2027.";
const NOTA = `Sugestão da Viva (rascunho; só a equipe vê).\n\nResposta sugerida:\n${RESPOSTA}`;
function msg(id: number, autor: string, corpo: string, interno = false, criado_em = "2026-11-20T19:40:00Z"): MensagemDoChamado {
  return { id, autor, corpo, interno, criado_em };
}

test("E1098 (3): a resposta ao cliente aparece UMA vez na conversa", () => {
  assert.equal(respostaDaSugestao(NOTA), RESPOSTA, "a nota de teste tem a forma que o servidor grava");
  const base = [msg(1, "usuario", "Ola quando a viva irá ser lançada?"), msg(2, "sistema", "Recebemos seu chamado VN-000109."), msg(3, "ia", NOTA, true)];
  const o = { respostaDaSugestao, naCaixa: null as number | null };

  // a) enviada como estava: o texto só na mensagem da equipe; a nota vira um aviso que aponta para ela.
  const enviada = itensDaConversa([...base, msg(4, "admin", RESPOSTA, false, "2026-11-22T11:56:00Z")], [{ acao: "sugestao_aprovada", de: "3", criado_em: "2026-11-22T11:56:00Z" }], o);
  assert.equal(vezesNaConversa(enviada, RESPOSTA), 1);
  const nota = enviada[2];
  assert.equal(nota.tipo, "sugestao");
  assert.deepEqual(nota.tipo === "sugestao" && [nota.estado, nota.texto, nota.aviso], ["enviada", null, "Sugestão aprovada e enviada como resposta da equipe em 22/11, às 08:56 — o texto está na mensagem da equipe, logo abaixo. A pessoa não vê esta nota."]);
  assert.equal(enviada[1].tipo, "mensagem");

  // b) à espera, com o texto na caixa de resposta: na conversa só o aviso (a caixa é o único lugar do texto).
  const naCaixa = itensDaConversa(base, [], { ...o, naCaixa: 3 });
  assert.equal(vezesNaConversa(naCaixa, RESPOSTA), 0);
  assert.equal(naCaixa[2].tipo === "sugestao" && naCaixa[2].estado, "na-caixa");

  // c) à espera, fora da caixa (o atendente já escrevia outra coisa): o texto fica na nota — uma vez.
  const aberta = itensDaConversa(base, [], o);
  assert.equal(vezesNaConversa(aberta, RESPOSTA), 1);
  assert.equal(aberta[2].tipo === "sugestao" && aberta[2].texto, RESPOSTA);

  // d) editada antes do envio, e superada por outra resposta: nunca duas vezes.
  const editada = itensDaConversa([...base, msg(4, "admin", `${RESPOSTA} Abraço!`)], [{ acao: "sugestao_editada", de: "3", criado_em: "2026-11-22T11:56:00Z" }], o);
  assert.equal(vezesNaConversa(editada, RESPOSTA), 1);
  assert.match(editada[2].tipo === "sugestao" ? editada[2].aviso : "", /^Sugestão editada e enviada como resposta da equipe em 22\/11, às 08:56/);
  const superada = itensDaConversa([...base, msg(4, "admin", "Outra resposta, escrita à mão.")], [], o);
  assert.equal(vezesNaConversa(superada, RESPOSTA), 0);
  assert.equal(superada[2].tipo === "sugestao" && superada[2].estado, "superada");

  // Uma nota comum da equipe continua inteira.
  const comNota = itensDaConversa([...base, msg(5, "admin", "Liguei para a pessoa.", true)], [], o);
  assert.equal(comNota[3].tipo, "nota");
  // A tela desenha a conversa por esta função, com a sugestão que está na caixa.
  assert.match(TELA, /itensDaConversa\(mensagens, eventos, \{ respostaDaSugestao, naCaixa: /);
});

test("E1098: estado, categoria, canal e iniciais como no mockup", () => {
  assert.equal(rotuloStatus("aguardando_usuario"), "Aguardando resposta do usuário");
  assert.equal(rotuloStatus("aguardando_aprovacao"), "Aguardando aprovação interna");
  assert.equal(rotuloCategoria("conta"), "Conta ou acesso");
  assert.equal(rotuloCategoria("algo-desconhecido"), "Outro assunto");
  assert.deepEqual([rotuloCanal("site", true), rotuloCanal("site", false), rotuloCanal("email", false), rotuloCanal("app", false)], ["Chat do site", "Central de Ajuda", "E-mail", "Aplicativo"]);
  assert.deepEqual([iniciais("Daniel Tomaz Rodovalho"), iniciais("Lara"), iniciais(""), iniciais(null)], ["DR", "LA", "?", "?"]);
});
