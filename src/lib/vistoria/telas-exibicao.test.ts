/*
  Prompt 62-A, Parte 1 — telas da avaliação do imóvel: textos exatos, nenhum número de ganho, nenhum botão de escolher
  avaliador, chave desligada esconde dono e morador, um primário por tela e as correções do QA do #1111 (itens 5, 6, 7).
  Roda: node --test src/lib/vistoria/telas-exibicao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CONVITE_SEJA_PARCEIRO,
  ESTADO_CREDENCIAMENTO,
  LINHA_PUBLICA_DESIGNACAO,
  PASSOS_CREDENCIAMENTO,
  ROTAS_NIVEL,
  TITULO_ADMIN,
  contagemDecisoes,
  filaDeRodizio,
  linhaDoTempoPedido,
  passosCumpridos,
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
const SEJA = ler("src/components/parceiros/seja-parceiro-form.tsx");
const primarios = (f: string) => (semComentarios(f).match(/<Button(?![^>]*variant=)[^>]*>/g) ?? []).length + (semComentarios(f).match(/variant="primary"/g) ?? []).length;

test("textos exatos: frase do pagamento, linha pública, rotas, convite e passos", () => {
  assert.equal(FRASE_PAGA_AVALIACAO, "Você paga a avaliação, não o resultado.");
  assert.equal(LINHA_PUBLICA_DESIGNACAO, "A Viva designa o avaliador. O proprietário não escolhe.");
  assert.deepEqual(ROTAS_NIVEL.map((r) => r.titulo), ["Foto: grátis, nível na hora", "Avaliação: “· vistoriado” por 12 meses"]);
  assert.deepEqual(PASSOS_CREDENCIAMENTO.map((p) => p.rotulo), ["Identidade verificada", "Experiência comprovada", "Código de conduta aceito", "Relações declaradas", "Avaliação de teste revisada pela Viva"]);
  assert.equal(ESTADO_CREDENCIAMENTO.solicitado, "Em análise");
  assert.equal(ESTADO_CREDENCIAMENTO.em_teste, "Avaliação de teste marcada");
  assert.equal(ESTADO_CREDENCIAMENTO.ativo, "Ativo");
  assert.equal(TITULO_ADMIN, "Avaliações do imóvel");
  for (const t of [LINHA_PUBLICA_DESIGNACAO, ...ROTAS_NIVEL.flatMap((r) => [r.titulo, r.texto]), CONVITE_SEJA_PARCEIRO.texto]) assert.doesNotMatch(t, TEXTO_PROIBIDO);
  assert.match(PUBLICA, /\{LINHA_PUBLICA_DESIGNACAO\}/);
  assert.match(BLOCO_DONO, /\{FRASE_PAGA_AVALIACAO\}/);
  assert.match(SEJA, /CONVITE_SEJA_PARCEIRO\.titulo/);
});

test("QA #1111 item 6: a visita sai sem segundos e com o fuso (dono, morador, avaliador e conversa)", () => {
  assert.equal(quandoVisita("2026-10-25T13:00:00Z"), "25/10/2026 às 10:00");
  assert.equal(quandoVisitaComFuso("2026-10-25T13:00:00Z"), "25/10/2026 às 10:00, horário de Brasília");
  for (const f of [BLOCO_DONO, MORADOR, AVALIADOR, CONVERSA_ACAO]) assert.doesNotMatch(f, /toLocaleString\("pt-BR"/);
  assert.match(BLOCO_DONO, /quandoVisitaComFuso\(atual\.agendado_para\)/);
  assert.match(AVALIADOR, /quandoVisitaComFuso\(p\.agendado_para\)/);
  assert.match(MORADOR, /quandoVisita\(p\.agendado_para\)/);
});

test("QA #1111 item 5: 'Avaliador designado pela Viva' aparece uma vez só", () => {
  assert.equal(situacaoDono({ status: "designado", aguardandoAvaliador: false, ocupado: false, concordanciaEm: null, agendadoPara: null }), null);
  assert.equal((BLOCO_DONO.match(/Avaliador designado pela Viva/g) ?? []).length, 1);
  assert.equal(situacaoDono({ status: "pedido", aguardandoAvaliador: true, ocupado: false, concordanciaEm: null, agendadoPara: null }), "Aguardando avaliador: a Viva avisa quando designar.");
  assert.equal(situacaoDono({ status: "designado", aguardandoAvaliador: false, ocupado: true, concordanciaEm: null, agendadoPara: "2026-10-25T13:00:00Z" }), "Data proposta: a visita fica confirmada quando o morador concordar.");
});

test("QA #1111 item 7 e um primário por tela: Nível, avaliador, morador, conversa, admin", () => {
  assert.match(NIVEL, /variant="secondary"\s+size="sm"\s+disabled=\{pendente \|\| !completo\}/, "Salvar ruído ficou secundário");
  assert.equal(primarios(BLOCO_DONO), 1, "só 'Pedir avaliação do imóvel'");
  assert.ok(primarios(AVALIADOR) <= 1, "agenda do avaliador: no máximo um primário (o do formulário de credenciamento)");
  assert.equal(primarios(CARTAO_CONVERSA), 0, "o primário da conversa é o Enviar");
  assert.ok(primarios(MORADOR) <= 1);
  assert.ok(primarios(ADMIN) <= 3, "admin: Salvar valor e Abrir verificação, cada um no seu formulário");
});

test("linha do tempo do pedido: pedido → designado nº X → agendado → visita feita → laudo", () => {
  const e = linhaDoTempoPedido({ status: "agendado", numero: "UDI-007", agendadoPara: "2026-10-25T13:00:00Z" });
  assert.deepEqual(e.map((x) => x.rotulo), ["Pedido", "Designado nº UDI-007", "Agendado para 25/10/2026 às 10:00", "Visita feita", "Laudo"]);
  assert.deepEqual(e.map((x) => x.estado), ["feito", "feito", "atual", "futuro", "futuro"]);
  assert.equal(linhaDoTempoPedido({ status: "pedido", aguardandoAvaliador: true })[0].rotulo, "Pedido · aguardando avaliador");
  assert.match(BLOCO_DONO, /data-testid="avaliacao-linha-tempo"/);
  assert.match(BLOCO_DONO, /href="\/dashboard\/mensagens"/, "a agenda é combinada pelas mensagens");
});

test("pagamento direto: a plataforma só registra; texto do 31b; nenhuma promessa de pagamento pela plataforma", () => {
  assert.equal(situacaoPagamento({ recebidoMarcadoEm: null, recebidoConfirmadoEm: null }), "Você paga direto ao avaliador, depois da visita. A Viva só registra.");
  assert.match(situacaoPagamento({ recebidoMarcadoEm: "x", recebidoConfirmadoEm: null }), /Confirme se você já pagou/);
  assert.match(BLOCO_DONO, /textoTaxaServicoParceiros\(PAGAMENTO_PARCEIROS_ATIVO\)/);
});

test("nenhum número de ganho por nível e nenhum botão de escolher avaliador", () => {
  for (const f of [BLOCO_DONO, NIVEL, ...ROTAS_NIVEL.map((r) => r.texto)]) {
    assert.doesNotMatch(semComentarios(f), /\d+\s?% (a mais|mais reservas|de aumento)|ganh[ae] (mais|até)|R\$\s?\d[^"]*a mais/i);
  }
  for (const f of [BLOCO_DONO, MORADOR, CARTAO_CONVERSA, PUBLICA]) {
    assert.doesNotMatch(semComentarios(f), /name="avaliador|escolh(er|a) o avaliador|Escolher avaliador/);
  }
  assert.doesNotMatch(semComentarios(PUBLICA), /contratar|href=/i);
});

test("chave desligada: dono, morador e o cartão da conversa somem; credenciamento e admin seguem", () => {
  assert.match(BLOCO_DONO, /if \(!\(await vistoriaAtiva\(\)\)\) return null;/);
  assert.match(MORADOR, /if \(!\(await vistoriaAtiva\(\)\)\) notFound\(\);/);
  assert.match(CONVERSA_ACAO, /if \(!\(await vistoriaAtiva\(\)\)\) return null;/);
  assert.match(CONVERSA_ACAO, /\.eq\("morador_id", user\.id\)/, "só o morador do pedido vê o cartão");
  assert.doesNotMatch(AVALIADOR, /vistoriaAtiva/);
  assert.doesNotMatch(ADMIN, /vistoriaAtiva\(\)/);
});

test("credenciamento: passos e estado; 'Seja parceiro' convida sem virar categoria do catálogo", () => {
  assert.deepEqual(Object.values(passosCumpridos(null)), [false, false, false, false, false]);
  assert.deepEqual(passosCumpridos("em_teste"), { identidade: true, experiencia: true, conduta: true, relacoes: true, teste: false });
  assert.equal(passosCumpridos("ativo").teste, true);
  assert.match(AVALIADOR, /data-testid="credenciamento-passos"/);
  assert.match(SEJA, /href="\/dashboard\/parceiro\/avaliacao"/);
  assert.doesNotMatch(SEJA, /CATEGORIAS_PARCEIRO\b/);
});

test("agenda do avaliador: contador das 24 h e visitas da semana", () => {
  const agora = new Date("2026-10-23T12:00:00Z");
  assert.equal(prazoResposta("2026-10-23T11:00:00Z", agora).texto, "Responda em 23 h 00 min");
  assert.equal(prazoResposta("2026-10-22T11:59:00Z", agora).vencido, true);
  assert.equal(visitaNaSemana("2026-10-27T13:00:00Z", agora), true);
  assert.equal(visitaNaSemana("2026-11-05T13:00:00Z", agora), false);
  assert.equal(visitaNaSemana(null, agora), false);
});

test("admin: decisões primeiro (números clicáveis), botões com a ação e a fila de rodízio com o motivo", () => {
  assert.equal(rotuloDecisao("solicitado", "em_teste"), "Colocar em teste");
  assert.equal(rotuloDecisao("em_teste", "ativo"), "Aprovar o teste (ativar)");
  assert.equal(rotuloDecisao("suspenso", "ativo"), "Reativar");
  assert.equal(rotuloDecisao("ativo", "suspenso"), "Suspender");
  assert.equal(rotuloDecisao("ativo", "descredenciado"), "Descredenciar");
  const n = contagemDecisoes({ credenciamentos: [{ status: "solicitado" }, { status: "em_teste" }, { status: "ativo" }], semAvaliador: 1, recusasAusencias: 2, cidadesProntas: 0, cidades: 1 });
  assert.deepEqual(n.map((x) => [x.valor, x.ancora]), [[2, "#credenciamento"], [1, "#sem-avaliador"], [2, "#recusas"], [0, "#chave"]]);
  const a = (id: string, status: AvaliadorFila["status"], ultima: string | null, teste = false): AvaliadorFila => ({ id, userId: id, cidade: "Uberlândia", status, teste, credenciadoEm: "2026-01-01T00:00:00Z", ultimaDesignacaoEm: ultima, relacoesDonos: [], relacoesImoveis: [] });
  const fila = filaDeRodizio([a("b", "ativo", "2026-10-01T00:00:00Z"), a("a", "ativo", null), a("s", "suspenso", null), a("t", "ativo", null, true), a("x", "ativo", null)].map((x) => (x.id === "x" ? { ...x, cidade: "Araguari" } : x)), "Uberlândia", new Date());
  assert.deepEqual(fila.map((f) => [f.id, f.posicao, f.impedimento]), [["a", 1, null], ["s", null, "está suspenso"], ["t", null, "conta de teste fora do rodízio real"], ["b", 2, null]]);
  // A ordem do topo e as seções: decisões antes da fila da equipe e do rodízio.
  const ordem = ["avaliacoes-decidir", "avaliadores-chave", "avaliadores-credenciamento", "avaliacoes-sem-avaliador", "avaliacoes-recusas", "avaliacoes-rodizio", "avaliadores-precos"].map((t) => ADMIN.indexOf(`data-testid="${t}"`));
  assert.ok(ordem.every((x, i) => x > 0 && (i === 0 || x > ordem[i - 1])), `ordem ${ordem}`);
  assert.match(ADMIN, /<Link href=\{n\.ancora\}/);
  assert.match(ADMIN, /Nenhum pedido de avaliação ainda\./, "estado vazio dos pedidos recentes (QA #1111 item 4)");
  assert.match(ADMIN, /<select name="propertyId" required/, "imóvel de teste por seletor (QA #1111 item 3)");
});
