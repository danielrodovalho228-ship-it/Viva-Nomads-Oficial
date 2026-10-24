/*
  Prompt 62-A, Parte 1 (dono e morador; credenciamento, página pública, agenda e admin sobre o 62-B3) — textos exatos, nenhum número de ganho, nenhum botão de escolher avaliador,
  chave desligada esconde dono e morador, um primário por tela e as correções do QA do #1111 (itens 5, 6, 7).
  Roda: node --test src/lib/vistoria/telas-exibicao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ESTADO_CREDENCIAMENTO,
  LINHA_PUBLICA_DESIGNACAO,
  PASSOS_CREDENCIAMENTO,
  ROTAS_NIVEL,
  TITULO_ADMIN,
  TITULO_BLOCO_DONO,
  contagemDecisoes,
  filaDeRodizio,
  linhaDoTempoPedido,
  passosCumpridos,
  complementoPassoIdentidade,
  prazoResposta,
  quandoVisita,
  quandoVisitaComFuso,
  rotuloDecisao,
  situacaoDono,
  situacaoPagamento,
  visitaNaSemana,
} from "./telas-exibicao.ts";
import { FRASE_PAGA_AVALIACAO, type AvaliadorFila } from "./regras.ts";
import { TEXTO_PROIBIDO } from "../estilo/estilo-padrao.test.ts";

const raiz = new URL("../../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(raiz + p, "utf8");
const semComentarios = (f: string) => f.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const BLOCO_DONO = ler("src/components/vistoria/bloco-avaliacao-dono.tsx");
const NIVEL = ler("src/app/(dashboard)/dashboard/imoveis/[id]/nivel/page.tsx") + ler("src/app/(dashboard)/dashboard/imoveis/[id]/nivel/form-nivel.tsx");
const MORADOR = ler("src/app/(dashboard)/dashboard/avaliacao-imovel/[id]/page.tsx");
const CARTAO_CONVERSA = ler("src/components/vistoria/avaliacao-na-conversa.tsx");
const CONVERSA_ACAO = ler("src/lib/vistoria/conversa-actions.ts");
const AVALIADOR = ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx");
const ADMIN = ler("src/app/(dashboard)/admin/avaliadores/page.tsx");
const PUBLICA = ler("src/app/(public)/avaliadores/[numero]/page.tsx");
const MENU = ler("src/config/menu-por-papel.ts");
const primarios = (f: string) => (semComentarios(f).match(/<Button(?![^>]*variant=)[^>]*>/g) ?? []).length + (semComentarios(f).match(/variant="primary"/g) ?? []).length;

test("textos exatos: frase do pagamento, as duas rotas e o título do bloco", () => {
  assert.equal(FRASE_PAGA_AVALIACAO, "Você paga a avaliação, não o resultado.");
  assert.deepEqual(ROTAS_NIVEL.map((r) => r.titulo), ["Foto: grátis, nível na hora", "Avaliação: “· vistoriado” por 12 meses"]);
  assert.equal(TITULO_BLOCO_DONO, "Avaliação do imóvel");
  for (const t of ROTAS_NIVEL.flatMap((r) => [r.titulo, r.texto])) assert.doesNotMatch(t, TEXTO_PROIBIDO);
  assert.match(BLOCO_DONO, /\{FRASE_PAGA_AVALIACAO\}/);
  assert.match(BLOCO_DONO, /data-testid="rota-foto"[\s\S]*data-testid="rota-avaliacao"/);
});

test("QA #1111 item 6: a visita sai sem segundos e com o fuso (dono, morador e conversa)", () => {
  assert.equal(quandoVisita("2026-10-25T13:00:00Z"), "25/10/2026 às 10:00");
  assert.equal(quandoVisitaComFuso("2026-10-25T13:00:00Z"), "25/10/2026 às 10:00, horário de Brasília");
  for (const f of [BLOCO_DONO, MORADOR, CONVERSA_ACAO]) assert.doesNotMatch(f, /toLocaleString\("pt-BR"/);
  assert.match(BLOCO_DONO, /quandoVisitaComFuso\(atual\.agendado_para\)/);
  assert.match(MORADOR, /quandoVisita\(p\.agendado_para\)/);
});

test("QA #1111 item 5: 'Avaliador designado pela Viva' aparece uma vez só", () => {
  assert.equal(situacaoDono({ status: "designado", aguardandoAvaliador: false, ocupado: false, concordanciaEm: null, agendadoPara: null }), null);
  assert.equal((BLOCO_DONO.match(/Avaliador designado pela Viva/g) ?? []).length, 1);
  assert.equal(situacaoDono({ status: "pedido", aguardandoAvaliador: true, ocupado: false, concordanciaEm: null, agendadoPara: null }), "Aguardando avaliador: a Viva avisa quando designar.");
  assert.equal(situacaoDono({ status: "designado", aguardandoAvaliador: false, ocupado: true, concordanciaEm: null, agendadoPara: "2026-10-25T13:00:00Z" }), "Data proposta: a visita fica confirmada quando o morador concordar.");
});

test("QA #1111 item 7 e um primário por tela: Nível, morador e conversa", () => {
  assert.match(NIVEL, /variant="secondary"\s+size="sm"\s+disabled=\{pendente \|\| !completo\}/, "Salvar ruído ficou secundário");
  assert.equal(primarios(BLOCO_DONO), 1, "só 'Pedir avaliação do imóvel'");
  assert.equal(primarios(CARTAO_CONVERSA), 0, "o primário da conversa é o Enviar");
  assert.ok(primarios(MORADOR) <= 1);
});

test("linha do tempo do pedido: pedido → designado nº X → agendado → visita feita → laudo", () => {
  const e = linhaDoTempoPedido({ status: "agendado", numero: "UDI-007", agendadoPara: "2026-10-25T13:00:00Z" });
  assert.deepEqual(e.map((x) => x.rotulo), ["Pedido", "Designado nº UDI-007", "Agendado para 25/10/2026 às 10:00", "Visita feita", "Laudo"]);
  assert.deepEqual(e.map((x) => x.estado), ["feito", "feito", "atual", "futuro", "futuro"]);
  assert.equal(linhaDoTempoPedido({ status: "pedido", aguardandoAvaliador: true })[0].rotulo, "Pedido · aguardando avaliador");
  assert.match(BLOCO_DONO, /data-testid="avaliacao-linha-tempo"/);
  assert.match(BLOCO_DONO, /href="\/dashboard\/mensagens"/, "a agenda é combinada pelas mensagens");
});

test("pagamento direto: a plataforma só registra; texto do 31b", () => {
  assert.equal(situacaoPagamento({ recebidoMarcadoEm: null, recebidoConfirmadoEm: null }), "Você paga direto ao avaliador, depois da visita. A Viva só registra.");
  assert.match(situacaoPagamento({ recebidoMarcadoEm: "x", recebidoConfirmadoEm: null }), /Confirme se você já pagou/);
  assert.match(BLOCO_DONO, /textoTaxaServicoParceiros\(PAGAMENTO_PARCEIROS_ATIVO\)/);
});

test("nenhum número de ganho por nível e nenhum botão de escolher avaliador", () => {
  for (const f of [BLOCO_DONO, NIVEL, ...ROTAS_NIVEL.map((r) => r.texto)]) {
    assert.doesNotMatch(semComentarios(f), /\d+\s?% (a mais|mais reservas|de aumento)|ganh[ae] (mais|até)|R\$\s?\d[^"]*a mais/i);
  }
  for (const f of [BLOCO_DONO, MORADOR, CARTAO_CONVERSA]) assert.doesNotMatch(semComentarios(f), /name="avaliador|escolh(er|a) o avaliador|Escolher avaliador/);
});

test("chave desligada: dono, morador e o cartão da conversa somem; só o morador do pedido vê o cartão", () => {
  assert.match(BLOCO_DONO, /if \(!\(await vistoriaAtiva\(\)\)\) return null;/);
  assert.match(MORADOR, /if \(!\(await vistoriaAtiva\(\)\)\) notFound\(\);/);
  assert.match(CONVERSA_ACAO, /if \(!\(await vistoriaAtiva\(\)\)\) return null;/);
  assert.match(CONVERSA_ACAO, /\.eq\("morador_id", user\.id\)/);
});

// ── Sobre o 62-B3: credenciamento (pedido único), página pública, agenda do avaliador e admin ──────────────────

test("credenciamento: textos exatos dos 5 passos e do estado", () => {
  assert.deepEqual(PASSOS_CREDENCIAMENTO.map((p) => p.rotulo), ["Identidade verificada", "Experiência comprovada", "Código de conduta aceito", "Relações declaradas", "Avaliação de teste revisada pela Viva"]);
  assert.equal(ESTADO_CREDENCIAMENTO.solicitado, "Em análise");
  assert.equal(ESTADO_CREDENCIAMENTO.em_teste, "Em teste");
  assert.equal(ESTADO_CREDENCIAMENTO.ativo, "Ativo");
  for (const t of [...PASSOS_CREDENCIAMENTO.map((p) => p.rotulo), ...Object.values(ESTADO_CREDENCIAMENTO)]) assert.doesNotMatch(t, TEXTO_PROIBIDO);
});

test("credenciamento: a identidade só conta verificada; o teste só conta revisado", () => {
  const sem = { testeConcluido: false };
  assert.deepEqual(Object.values(passosCumpridos({ status: null, identidadeVerificada: false, ...sem })), [false, false, false, false, false]);
  assert.deepEqual(passosCumpridos({ status: "solicitado", identidadeVerificada: false, ...sem }), { identidade: false, experiencia: true, conduta: true, relacoes: true, teste: false });
  assert.equal(passosCumpridos({ status: "em_teste", identidadeVerificada: true, testeConcluido: true }).teste, false, "laudo feito mas ainda não revisado (ativado)");
  // E35-B: a identidade vem do FATO, nunca do status (aprovar para teste não exige mais a identidade).
  assert.equal(passosCumpridos({ status: "em_teste", identidadeVerificada: false, ...sem }).identidade, false);
  assert.equal(passosCumpridos({ status: "ativo", identidadeVerificada: true, ...sem }).identidade, true);
  assert.equal(complementoPassoIdentidade("em_breve"), "Na ativação · a verificação abre perto do lançamento");
  assert.equal(complementoPassoIdentidade("simulavel"), "Na ativação");
  assert.equal(complementoPassoIdentidade("confirmada"), null);
  assert.equal(passosCumpridos({ status: "ativo", identidadeVerificada: true, testeConcluido: true }).teste, true);
  // E30: "Ativo" sem avaliação de teste registrada (massa de teste) NÃO cumpre o passo 5.
  assert.equal(passosCumpridos({ status: "ativo", identidadeVerificada: true, ...sem }).teste, false);
  assert.equal(passosCumpridos({ status: "suspenso", identidadeVerificada: true, ...sem }).teste, false);
  // Pedido único do 62-B3 preservado: dados de parceiro só para quem ainda não é, pendência com o link, um só envio.
  assert.match(AVALIADOR, /\{!parc && \(\s*<fieldset[^>]*data-testid="credenciamento-dados-parceiro"/);
  assert.match(AVALIADOR, /data-testid="credenciamento-pendencia"[\s\S]*href="\/dashboard\/verificacao"/);
  assert.match(AVALIADOR, /passosCumpridos\(\{ status, identidadeVerificada: identidade === "confirmada", testeConcluido: teste\.concluido \}\)/);
  assert.match(AVALIADOR, /data-testid="passo-identidade-quando"/);
  assert.match(AVALIADOR, /data-testid="credenciamento-passos"/);
  assert.match(AVALIADOR, /data-testid="credenciamento-estado">\{ESTADO_CREDENCIAMENTO\[/);
  assert.ok(primarios(AVALIADOR) <= 1, "no máximo um primário: o envio do pedido");
});

test("página pública: linha fixa, sem contratar, sem link, sem escolher avaliador", () => {
  assert.equal(LINHA_PUBLICA_DESIGNACAO, "A Viva designa o avaliador. O proprietário não escolhe.");
  assert.doesNotMatch(LINHA_PUBLICA_DESIGNACAO, TEXTO_PROIBIDO);
  assert.match(PUBLICA, /\{LINHA_PUBLICA_DESIGNACAO\}/);
  for (const id of ["avaliador-numero", "avaliador-cidade", "avaliador-feitas", "avaliador-nota"]) assert.match(PUBLICA, new RegExp(`data-testid="${id}"`));
  assert.doesNotMatch(semComentarios(PUBLICA), /contratar|href=|<Button|<form/i);
  for (const f of [PUBLICA, AVALIADOR, ADMIN]) assert.doesNotMatch(semComentarios(f), /name="avaliador(Id)?"[^>]*<select|escolh(er|a) o avaliador|Escolher avaliador/);
});

test("agenda do avaliador: contador das 24 h, visitas da semana e hora sem segundos", () => {
  const agora = new Date("2026-10-23T12:00:00Z");
  assert.equal(prazoResposta("2026-10-23T11:00:00Z", agora).texto, "Responda em 23 h 00 min");
  assert.equal(prazoResposta("2026-10-22T11:59:00Z", agora).vencido, true);
  assert.equal(visitaNaSemana("2026-10-27T13:00:00Z", agora), true);
  assert.equal(visitaNaSemana("2026-11-05T13:00:00Z", agora), false);
  assert.equal(visitaNaSemana(null, agora), false);
  assert.doesNotMatch(AVALIADOR, /toLocaleString\("pt-BR"/);
  assert.match(AVALIADOR, /quandoVisitaComFuso\(p\.agendado_para\)/);
  for (const id of ["avaliacoes-designadas", "avaliacoes-visitas", "avaliacoes-historico", "prazo-resposta", "visita-semana"]) assert.match(AVALIADOR, new RegExp(`data-testid="${id}"`));
});

test("admin: decisões primeiro, a aprovação única do 62-B3 e o rodízio com o motivo", () => {
  assert.equal(TITULO_ADMIN, "Avaliações do imóvel");
  assert.match(MENU, /rotulo: "Avaliações do imóvel", icone: "parceiros", href: "\/admin\/avaliadores"/);
  assert.equal(rotuloDecisao("solicitado", "em_teste"), "Aprovar para teste");
  assert.equal(rotuloDecisao("em_teste", "ativo"), "Aprovar o teste (ativar)");
  assert.equal(rotuloDecisao("suspenso", "ativo"), "Reativar");
  assert.equal(rotuloDecisao("ativo", "suspenso"), "Suspender");
  assert.equal(rotuloDecisao("ativo", "descredenciado"), "Descredenciar");
  const n = contagemDecisoes({ credenciamentos: [{ status: "solicitado" }, { status: "em_teste" }, { status: "ativo" }], semAvaliador: 1, recusasAusencias: 2, cidadesProntas: 0, cidades: 1 });
  assert.deepEqual(n.map((x) => [x.valor, x.ancora]), [[2, "#credenciamento"], [1, "#sem-avaliador"], [2, "#recusas"], [0, "#chave"]]);
  const a = (id: string, status: AvaliadorFila["status"], ultima: string | null, teste = false): AvaliadorFila => ({ id, userId: id, cidade: "Uberlândia", status, teste, credenciadoEm: "2026-01-01T00:00:00Z", ultimaDesignacaoEm: ultima, relacoesDonos: [], relacoesImoveis: [] });
  const fila = filaDeRodizio([a("b", "ativo", "2026-10-01T00:00:00Z"), a("a", "ativo", null), a("s", "suspenso", null), a("t", "ativo", null, true), { ...a("x", "ativo", null), cidade: "Araguari" }], "Uberlândia", new Date());
  assert.deepEqual(fila.map((f) => [f.id, f.posicao, f.impedimento !== null]), [["a", 1, false], ["s", null, true], ["t", null, true], ["b", 2, false]]);
  const ordem = ["avaliacoes-decidir", "avaliadores-chave", "avaliadores-credenciamento", "avaliacoes-sem-avaliador", "avaliacoes-recusas", "avaliacoes-rodizio", "avaliadores-precos"].map((t) => ADMIN.indexOf(`data-testid="${t}"`));
  assert.ok(ordem.every((x, i) => x > 0 && (i === 0 || x > ordem[i - 1])), `ordem ${ordem}`);
  assert.match(ADMIN, /<Link href=\{n\.ancora\}/);
  assert.match(ADMIN, /rotuloDecisao\(c\.status, para\)/);
  // O que o 62-B3 trouxe continua: dados de quem ainda não é parceiro (mascarados), pendência, condição de retorno.
  for (const s of ['data-testid="credenciamento-dados-parceiro"', 'data-testid="credenciamento-pendencia"', "mascararDocumento(", 'name="retornoDias"', "textoCondicaoRetorno(condicaoRetorno(l))"]) assert.ok(ADMIN.includes(s), s);
  assert.ok(primarios(ADMIN) <= 3, "admin: Salvar valor e Abrir verificação, cada um no seu formulário");
});

test("chave desligada: credenciamento e admin seguem de pé (montam a rede antes do lançamento)", () => {
  assert.doesNotMatch(AVALIADOR, /vistoriaAtiva/);
  assert.doesNotMatch(ADMIN, /vistoriaAtiva\(\)/);
});
