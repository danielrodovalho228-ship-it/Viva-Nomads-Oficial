import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1791 — E1202 @E1202 (ORDEM-DUET-972/973; trava de tela dada na ORDEM-DUET-973). Linha Proposta e contrato.
  Antes: na passagem de 25/11, o assistente da ORC-2026-0015 (R$ 2.500, 31 dias) aberto pela lista, a partir da
  ORC-2026-0018 (R$ 2.800, os MESMOS 31 dias) aberta por omissão, mostrava a base, a taxa e a caução da 0018: "Base
  R$ 2.893 · Taxa R$ 347" na última etapa e "Bloco 1 · R$ 2.893 · Caução R$ 1.447" na Garantia. O `resumo` era um
  `useMemo` sem o aluguel nem a taxa nas dependências, numa instância reaproveitada (E1201). Só exibição.
  Massa só no laboratório, contas de teste, a mesma forma: uma candidatura com duas propostas acordadas, sem contrato,
  com ALUGUÉIS DIFERENTES e os MESMOS 31 dias — a anterior (R$ 2.500) e a mais recente (R$ 2.800, aberta por omissão).
  Pela tela (1280 px): abre por omissão a mais recente; "Abrir fechamento" na anterior; na Garantia, o bloco 1 diz o
  aluguel e a caução DELA (R$ 2.583 e R$ 1.292), e na última etapa a base e a taxa DELA (R$ 2.583 e R$ 310) — nunca
  os da mais recente (R$ 2.893, R$ 1.447, R$ 347). Por cima do E1201 (a key), esta trava só cai com as duas curas
  revertidas; a que morde o `useMemo` sozinho é a de unidade do E1202.
  Laboratório; não é prova ao vivo no site.
  Vizinha do E1072 (#4084, ORDEM-DUET-1094): corre também no portão do #4084, porque o #4084 mexe no assistente do
  Fechamento e no 1º pagamento; a t1789 tem o caso combinado E1141×#4084.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1791.${sufixo}@lab.vivanomads.test`, nome: "Dora Base Sobrenome", role: "owner" as const };
const inq = { email: `inq.t1791.${sufixo}@lab.vivanomads.test`, nome: "Iris Base Sobrenome", role: "tenant" as const };
const ids: Record<string, string> = {};
const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const haDias = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const ANTERIOR = { entrada: emDias(20), dias: 31, aluguel: 2500 };
const RECENTE = { entrada: emDias(120), dias: 31, aluguel: 2800 };

async function proposta(status: string, aceitaEm: string, estadia: { entrada: string; dias: number; aluguel: number }): Promise<{ id: string; numero: string }> {
  const { data: numero } = await adm().rpc("next_document_number", { p_type: "orcamento", p_year: new Date().getFullYear() });
  const { data, error } = await adm()
    .from("propostas")
    .insert({ numero, lead_id: ids.lead, property_id: ids.imovel, owner_id: ids.dono, tenant_id: ids.inq, status, versao_atual: 1, validade_dias: 7, valida_ate: `${emDias(7)}T23:00:00Z`, aceita_em: aceitaEm, taxa_congelada: 0.12 })
    .select("id, numero")
    .single();
  if (error) throw error;
  const { error: ev } = await adm().from("proposta_versoes").insert({
    proposta_id: data.id, versao: 1, autor: "owner", valor_base: estadia.aluguel, valor_mensal: estadia.aluguel, meses: 1, dias: estadia.dias, data_entrada: estadia.entrada, total_mensal: estadia.aluguel, total_contrato: Math.round(((estadia.aluguel * estadia.dias) / 30) * 100) / 100, mensagem: "Proposta da t1791.",
  });
  if (ev) throw ev;
  return { id: data.id as string, numero: data.numero as string };
}

/** O dono atravessa o Fechamento até à última etapa (os passos da t1726), parando na Garantia para a ler. */
async function ateAoFim(page: Page, naGarantia: (page: Page) => Promise<void>) {
  const continuar = page.getByRole("button", { name: /continuar/i });
  const verificar = page.getByRole("button", { name: /verificar identidade/i });
  if (await verificar.isVisible().catch(() => false)) await verificar.click();
  await expect(continuar).toBeEnabled({ timeout: 20_000 });
  await continuar.click();
  await expect(page.getByTestId("garantia-bloco-1")).toBeVisible({ timeout: 15_000 });
  await naGarantia(page);
  await page.getByRole("radio").and(page.locator(":not([disabled])")).first().click();
  await page.getByTestId("ciente-protecao").check({ timeout: 15_000 });
  await continuar.click();
  await expect(page.getByRole("heading", { name: /serviços adicionais/i })).toBeVisible({ timeout: 15_000 });
  await continuar.click();
  await page.getByRole("button", { name: /Seguir sem seguro patrimonial/ }).click();
  await continuar.click();
  await expect(page.getByTestId("marca-minuta")).toBeVisible({ timeout: 15_000 });
}

async function noFechamento(browser: Browser): Promise<Page> {
  const page = await entrar(browser, dono.email, senha);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/dashboard/fechamento", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("seus-fechamentos")).toBeVisible({ timeout: 30_000 });
  return page;
}

test.beforeAll(async () => {
  if (!NO_LABORATORIO) return;
  ids.dono = await criarConta(dono, senha);
  ids.inq = await criarConta(inq, senha);
  // Contas de teste: o contrato e a cobrança saem no modo TESTE.
  await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
  ids.imovel = await criarImovelPronto(ids.dono, `[TESTE QA] Duas estadias t1791 ${sufixo}`, { ativo: true, preco: 2800 });
  const { error: e1 } = await adm().from("properties").update({ min_period_days: 30, max_period_days: 180 }).eq("id", ids.imovel);
  if (e1) throw e1;
  ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel, true);
  await adm().from("leads").update({ accepted_at: haDias(6), accepted_commission_rate: 0.12, accepted_plan: "essential" }).eq("id", ids.lead);
  for (const tipo of ["identidade", "vinculo"]) {
    const u = () => crypto.randomUUID();
    const { error } = await adm().from("documentos_inquilino").insert({ lead_id: ids.lead, tenant_id: ids.inq, tipo, caminho: `${u()}/${u()}/${u()}.pdf`, hash_sha256: "a".repeat(64) });
    if (error) throw error;
  }
  const anterior = await proposta("aceita", haDias(5), ANTERIOR);
  ids.anterior = anterior.id;
  const recente = await proposta("aceita", haDias(1), RECENTE);
  ids.recente = recente.id;
});

test.afterAll(async () => {
  if (ids.lead) {
    await adm().from("cobrancas_fechamento").delete().eq("lead_id", ids.lead);
    const { data: cts } = await adm().from("contratos").select("id").eq("lead_id", ids.lead);
    const cIds = (cts ?? []).map((c) => c.id as string);
    if (cIds.length) await adm().from("contrato_blocos").delete().in("contrato_id", cIds);
    await adm().from("contratos").delete().eq("lead_id", ids.lead);
    await adm().from("documentos_inquilino").delete().eq("lead_id", ids.lead);
    await adm().from("propostas").delete().eq("lead_id", ids.lead);
    await adm().from("leads").delete().eq("id", ids.lead);
  }
  if (ids.imovel) await adm().from("properties").delete().eq("id", ids.imovel);
  await apagarContas([ids.dono, ids.inq].filter(Boolean));
});

test.describe("T1791 — E1202: a base, a taxa e a caução são as da estadia aberta @E1202", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test("abrir por omissão a de R$ 2.800, clicar na de R$ 2.500 (mesmos 31 dias): Garantia, base e taxa são as DELA", async ({ browser }) => {
    const page = await noFechamento(browser);
    const acao = page.locator(`[data-testid="fecho-linha"][data-chave="A:${ids.anterior}"]`).getByTestId("fecho-acao");
    await expect(acao).toHaveAttribute("href", `/dashboard/fechamento?c=${ids.lead}&p=${ids.anterior}`);
    await acao.click();
    await page.waitForURL((u) => u.searchParams.get("p") === ids.anterior, { timeout: 30_000 });
    await expect(page.getByTestId("fechamento-proposta-mes")).toBeVisible({ timeout: 30_000 });
    await ateAoFim(page, async (p) => {
      const bloco = p.getByTestId("garantia-bloco-1");
      await expect(bloco, "o aluguel do bloco é o da estadia anterior").toContainText(/R\$\s?2\.583/);
      await expect(bloco, "a caução do bloco é a da estadia anterior").toContainText(/R\$\s?1\.292/);
      await expect(bloco).not.toContainText(/2\.893|1\.447/);
    });
    await expect(page.getByTestId("fechamento-base-taxa"), "a base da taxa é a da estadia anterior").toContainText(/R\$\s?2\.583/);
    await expect(page.getByTestId("fechamento-base-taxa")).not.toContainText(/2\.893/);
    await expect(page.getByTestId("fechamento-taxa-valor"), "a taxa é a da estadia anterior (12% de R$ 2.583,33)").toHaveText(/R\$\s?310(,00)?$/);
    await page.screenshot({ path: `${SAIDA}/t1791-base-da-anterior-1280.png`, fullPage: true });
    await page.context().close();
  });
});
