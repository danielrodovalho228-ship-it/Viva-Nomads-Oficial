/*
  Complemento do Prompt 29 (reteste do #891): todo número da home tem link (item 4), o Financeiro tem UMA base
  (item 3), pedidos com recorte e a conta do compatível (item 5b/c) e o avise-me sem login (item 5a).
  Roda: node --test src/lib/admin/complemento-p29.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BLOCOS, FUNIL, PRECISA, funil } from "./visao-geral.ts";
import { ROTULO_RECORTE, agregarContratos, recorteDaUrl, resumoCandidaturas, textoComCompativel } from "./indicadores.ts";
import { calcularFinanceiro, comissoesDosContratos } from "./financeiro.ts";
import { TEXTO_AVISO_DESLOGADO, linkEntrarParaAvisar } from "../fotografos/aviso.ts";

const f = { inicio: "2026-10-01", fim: "2026-10-19", cidade: "Uberlândia" };
const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("item 4: nenhum número da home sem href (cartões, funil e 'precisa de você')", () => {
  for (const b of BLOCOS)
    for (const i of b.indicadores) {
      assert.equal(typeof i.href, "function", `${i.chave} sem link`);
      assert.match(i.href!(f), /^\/admin(\/|\?|$)/, `${i.chave} aponta para fora do admin`);
    }
  for (const e of FUNIL) {
    const h = e.href(f);
    assert.match(h, /periodo=custom&de=2026-10-01&ate=2026-10-19/, `${e.rotulo}: mesmo período`);
    assert.match(h, /cidade=Uberl/, `${e.rotulo}: mesma cidade`);
  }
  for (const p of PRECISA) assert.match(p.href, /^\/admin\//, `${p.chave} sem lista`);
  const por = (k: string) => PRECISA.find((p) => p.chave === k)!;
  assert.equal(por("candidaturas_sem_resposta_48h").href, "/admin/candidaturas?status=sem_resposta");
  assert.equal(por("comissoes_vencidas").href, "/admin/financeiro?situacao=vencida");
  assert.equal(por("comissoes_vencidas").rotulo, "Taxas vencidas");
  for (const p of PRECISA) assert.doesNotMatch(`${p.rotulo} ${p.detalhe}`, /comiss/i, "'comissão' nunca aparece na tela");
  const conclusao = BLOCOS.flatMap((b) => b.indicadores).find((i) => i.chave === "conclusao_cadastro");
  assert.ok(conclusao?.href?.(f).startsWith("/admin/usuarios?cadastro=incompleto"));
  // A tela da home não tem mais o "sem lista".
  assert.doesNotMatch(ler("../../app/(dashboard)/admin/visao-geral-client.tsx"), /sem lista/);
});

test("item 4: funil conta pelas mesmas chaves das listas (x_*)", () => {
  const m = { x_ev_busca: 10, x_ev_ver_anuncio: 5, x_ev_iniciar_candidatura: 4, x_candidaturas: 2, x_cand_aceitas: 1, x_contratos: 1 };
  assert.deepEqual(funil(m).map((e) => e.valor), [10, 5, 4, 2, 1, 1]);
  assert.equal(funil(m)[1].daAnterior, 0.5);
});

test("item 4: resumo das candidaturas (total, decididas, aceitas, mediana)", () => {
  const r = resumoCandidaturas([
    { criadoEm: "2026-10-01T10:00:00Z", aceitaEm: "2026-10-01T12:00:00Z", recusadaEm: null },
    { criadoEm: "2026-10-01T10:00:00Z", aceitaEm: null, recusadaEm: "2026-10-01T14:00:00Z" },
    { criadoEm: "2026-10-01T10:00:00Z", aceitaEm: null, recusadaEm: null },
  ]);
  assert.deepEqual(r, { total: 3, decididas: 2, aceitas: 1, medianaHoras: 3 });
});

test("item 3: Financeiro com UMA base — a soma da tabela = os cartões (Real e Todos)", () => {
  const c = (id: string, mensal: number, prazo: number, taxa: number, lead: string | null, teste: boolean) => ({
    id,
    criadoEm: "2026-10-05T12:00:00Z",
    imovel: `Imóvel ${id}`,
    cidade: "Uberlândia",
    plano: "gratuito",
    taxaPercent: 0.12,
    aluguelMensal: mensal,
    prazoDias: prazo,
    taxaValor: taxa,
    leadId: lead,
    teste,
  });
  const todos = [c("a", 3200, 120, 1536, "l1", false), c("b", 2000, 30, 240, "l2", false), c("t", 1000, 60, 240, "l3", true)];
  const cobrancas = new Map([
    ["l1", { status: "pago", pagoEm: "2026-10-10T12:00:00Z" }],
    ["l3", { status: "vencido", pagoEm: null }],
  ]);
  for (const recorte of ["real", "todos"] as const) {
    const lista = recorte === "real" ? todos.filter((x) => !x.teste) : todos;
    const fin = calcularFinanceiro({ comissoes: comissoesDosContratos(lista, cobrancas) }, agregarContratos(lista));
    const somaTabela = fin.comissoes.reduce((s, x) => s + (x.comissao ?? 0), 0);
    assert.equal(somaTabela, fin.comissaoGerada, `${recorte}: tabela = Taxa de serviço gerada`);
    const naoPagas = fin.comissoes.filter((x) => x.status !== "pago").reduce((s, x) => s + (x.comissao ?? 0), 0);
    assert.equal(naoPagas, fin.comissaoAReceber, `${recorte}: não pagas = Taxa a receber`);
  }
  const real = calcularFinanceiro({ comissoes: comissoesDosContratos(todos.slice(0, 2), cobrancas) }, agregarContratos(todos.slice(0, 2)));
  assert.equal(real.comissaoGerada, 1776);
  assert.equal(real.comissaoAReceber, 240);
  assert.equal(real.comissoes.find((x) => x.contrato === "b")?.status, "sem_cobranca");
  assert.equal(recorteDaUrl(undefined), "real");
  assert.equal(recorteDaUrl("todos"), "todos");
  assert.equal(recorteDaUrl("x"), "real");
  assert.deepEqual(ROTULO_RECORTE, { real: "só contratos reais", teste: "só de teste", todos: "todos" });
});

test("item 3: a página lê o financeiro com recorte, a tabela vem da lista dos cartões e cada cartão mostra a base", () => {
  const pagina = ler("../../app/(dashboard)/admin/financeiro/page.tsx");
  assert.match(pagina, /recorteDaUrl\(um\("tipo"\)\)/);
  assert.match(pagina, /cidade, recorte\)\.catch/);
  assert.match(pagina, /comissoesDosContratos\(contratos, cobrancas\)/);
  assert.match(ler("../data/admin-financeiro.ts"), /admin_financeiro_recorte/);
  const tela = ler("../../app/(dashboard)/admin/financeiro/financeiro-client.tsx");
  assert.match(tela, /data-testid="base-cartao"/);
  assert.match(tela, /data-testid="filtro-tipo"/);
  assert.doesNotMatch(tela.replace(/comissoes|comissao|STATUS_COMISSAO|TabelaComissoes|calcularFinanceiro/g, ""), />[^<{]*comiss/i, "'comissão' fora da tela");
  const sql = ler("../../../supabase/migrations/0183_admin_financeiro_recorte.sql");
  for (const parte of ["subscriptions s", "recebimentos r", "assinatura_eventos e", "profiles pr"]) assert.ok(sql.includes(parte), parte);
  assert.match(ler("../../../supabase/producao/aplicar-0183.sql"), /20261019000183/);
});

test("item 5c: 'com compatível' mostra a conta; com 1 pedido o percentual só pode ser 0% ou 100%", () => {
  assert.equal(textoComCompativel(2, 3), "2 de 3 pedidos do período, 67%");
  assert.equal(textoComCompativel(0, 1), "0 de 1 pedido do período, 0%");
  assert.equal(textoComCompativel(1, 1), "1 de 1 pedido do período, 100%");
  assert.equal(textoComCompativel(0, 0), "0 pedidos no período");
  assert.match(ler("../../app/(dashboard)/admin/pedidos/page.tsx"), /compativel: textoComCompativel\(/);
  assert.match(ler("../../app/(dashboard)/admin/pedidos/admin-pedidos-client.tsx"), /data-testid="pedidos-recorte"/);
});

test("item 5a: avise-me sem login — texto novo, volta para a mesma busca e grava na volta", () => {
  assert.equal(TEXTO_AVISO_DESLOGADO, "Entre ou crie sua conta para ser avisado quando houver fotógrafo na sua cidade");
  const href = linkEntrarParaAvisar("/parceiros/fotografos?cidade=Uberl%C3%A2ndia&uf=MG");
  assert.ok(href.startsWith("/auth?redirect="));
  assert.equal(decodeURIComponent(href.slice("/auth?redirect=".length)), "/parceiros/fotografos?cidade=Uberl%C3%A2ndia&uf=MG&avisar=1");
  assert.equal(decodeURIComponent(linkEntrarParaAvisar("/parceiros/fotografos").split("=")[1]), "/parceiros/fotografos?avisar=1");
  const tela = ler("../../app/(public)/parceiros/fotografos/aviso-fotografo.tsx");
  assert.match(tela, /autoAvisar/);
  assert.doesNotMatch(tela, /Entrar para ser avisado/);
  assert.match(ler("../../app/(public)/parceiros/fotografos/page.tsx"), /autoAvisar=\{!!user && sp\.avisar === "1"\}/);
});

test("aviso sem a 0183: diz o que falta e o que já segue o recorte (sem mudar a lógica)", () => {
  const pagina = ler("../../app/(dashboard)/admin/financeiro/page.tsx");
  assert.ok(
    pagina.includes(
      "Assinaturas, MRR, recebido, marketing e os gráficos mensais aparecem quando a migração 0183 for aplicada (automática no merge). Contratos, taxa de serviço e take rate já seguem o recorte Real · Teste · Todos.",
    ),
  );
  assert.match(pagina, /sem_migracao: TEXTO_FINANCEIRO_SEM_0183,/);
});

test("0182 aplicável em produção: a Caução fica sem bloco ANTES do check e da anulação das duplicidades", () => {
  for (const arq of ["../../../supabase/migrations/0182_pagamento_sem_repeticao.sql", "../../../supabase/producao/aplicar-0182.sql"]) {
    const sql = ler(arq);
    const nulo = sql.indexOf("update public.pagamentos_bloco set bloco_id = null where tipo = 'caucao' and bloco_id is not null;");
    const check = sql.indexOf("add constraint pagamentos_bloco_bloco_por_tipo");
    const anula = sql.indexOf("set anulado_em = now(), anulado_motivo = 'registro em duplicidade'");
    assert.ok(nulo > 0 && nulo < check && check < anula, arq);
  }
});
