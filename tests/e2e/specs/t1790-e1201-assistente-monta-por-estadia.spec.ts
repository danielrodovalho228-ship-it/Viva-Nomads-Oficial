import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1790 — E1201 @E1201 (ORDEM-DUET-968/970; trava de tela dada na ORDEM-DUET-970). Linha Proposta e contrato.
  Antes: na ronda das 18h (25/11), o assistente aberto para a ORC-2026-0015 pela lista "Seus fechamentos" mostrava
  como "Data de início da estadia" a data da ORC-2026-0018 — o fecho aberto por omissão na mesma página. O assistente
  era montado sem `key`, e a navegação no cliente reaproveitava o estado de um fecho para o outro; a data de início
  ALIMENTA o contrato gerado.
  Massa só no banco do laboratório, contas de teste, uma candidatura com DUAS propostas acordadas, sem contrato:
   - a ANTERIOR (aceite antes): entrada daqui a 20 dias, 30 dias;
   - a MAIS RECENTE (a que a página abre por omissão): entrada daqui a 120 dias, 30 dias.
  Pela tela (1280 px): o Fechamento abre a mais recente (o campo mostra a data dela); "Abrir fechamento" na linha da
  anterior leva ao assistente DELA — o campo mostra a data da anterior, não a da mais recente — e o contrato gerado
  nasce com o período dela (o `periodo` gravado começa na entrada da anterior), da proposta anterior.
  Laboratório; não é prova ao vivo no site.
  Vizinha do E1072 (#4084, ORDEM-DUET-1094): corre também no portão do #4084, porque o #4084 mexe no assistente do
  Fechamento e no 1º pagamento; a t1789 tem o caso combinado E1141×#4084.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1790.${sufixo}@lab.vivanomads.test`, nome: "Dinah Estadia Sobrenome", role: "owner" as const };
const inq = { email: `inq.t1790.${sufixo}@lab.vivanomads.test`, nome: "Ilda Estadia Sobrenome", role: "tenant" as const };
const ids: Record<string, string> = {};
const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const haDias = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const ANTERIOR = { entrada: emDias(20), dias: 30 };
/** O campo mostra a data em dd/mm/aaaa (como na t89 e na t182). */
const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const RECENTE = { entrada: emDias(120), dias: 30 };

async function proposta(status: string, aceitaEm: string, estadia: { entrada: string; dias: number }): Promise<{ id: string; numero: string }> {
  const { data: numero } = await adm().rpc("next_document_number", { p_type: "orcamento", p_year: new Date().getFullYear() });
  const { data, error } = await adm()
    .from("propostas")
    .insert({ numero, lead_id: ids.lead, property_id: ids.imovel, owner_id: ids.dono, tenant_id: ids.inq, status, versao_atual: 1, validade_dias: 7, valida_ate: `${emDias(7)}T23:00:00Z`, aceita_em: aceitaEm, taxa_congelada: 0.12 })
    .select("id, numero")
    .single();
  if (error) throw error;
  const { error: ev } = await adm().from("proposta_versoes").insert({
    proposta_id: data.id, versao: 1, autor: "owner", valor_base: 2800, valor_mensal: 2800, meses: 1, dias: estadia.dias, data_entrada: estadia.entrada, total_mensal: 2800, total_contrato: 2800, mensagem: "Proposta da t1790.",
  });
  if (ev) throw ev;
  return { id: data.id as string, numero: data.numero as string };
}

/** O dono atravessa o Fechamento e clica "Gerar contrato" (os mesmos passos da t1726). */
async function gerarContratoPelaTela(page: Page) {
  const continuar = page.getByRole("button", { name: /continuar/i });
  const verificar = page.getByRole("button", { name: /verificar identidade/i });
  if (await verificar.isVisible().catch(() => false)) await verificar.click();
  await expect(continuar).toBeEnabled({ timeout: 20_000 });
  await continuar.click();
  await page.getByRole("radio").and(page.locator(":not([disabled])")).first().click();
  await page.getByTestId("ciente-protecao").check({ timeout: 15_000 });
  await continuar.click();
  await expect(page.getByRole("heading", { name: /serviços adicionais/i })).toBeVisible({ timeout: 15_000 });
  await continuar.click();
  await page.getByRole("button", { name: /Seguir sem seguro patrimonial/ }).click();
  await continuar.click();
  await expect(page.getByTestId("marca-minuta")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("fechamento-gerar-contrato").click();
  // Sucesso ou a frase do assistente: se o contrato não sai, a falha diz porquê. Com `?p=` não há ida ao contrato a meio
  // (ajuste da guarda do E1141, ORDEM-DUET-978): a tela de sucesso aparece como no fecho sem p.
  const gerado = page.getByTestId("fechamento-abrir-contrato");
  const erro = page.getByTestId("erro-contrato");
  await expect(gerado.or(erro)).toBeVisible({ timeout: 45_000 });
  if (await erro.isVisible()) throw new Error(`o contrato não foi gerado — o assistente diz: ${(await erro.innerText()).trim()}`);
  expect(page.url(), "o fecho com p termina no assistente, sem navegação no meio").toContain("/dashboard/fechamento");
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
  ids.imovel = await criarImovelPronto(ids.dono, `[TESTE QA] Duas estadias t1790 ${sufixo}`, { ativo: true, preco: 2800 });
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

test.describe("T1790 — E1201: o assistente monta o estado de cada estadia @E1201", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test("abrir por omissão a mais recente, clicar na anterior: o campo e o contrato gerado são os DELA", async ({ browser }) => {
    const page = await noFechamento(browser);
    // Por omissão abre a mais recente: o campo mostra a data dela.
    await expect(page.getByTestId("inicio-estadia")).toHaveValue(dataBR(RECENTE.entrada), { timeout: 30_000 });

    // Navegação no cliente para a estadia anterior, pela lista.
    const acao = page.locator(`[data-testid="fecho-linha"][data-chave="A:${ids.anterior}"]`).getByTestId("fecho-acao");
    await expect(acao).toHaveAttribute("href", `/dashboard/fechamento?c=${ids.lead}&p=${ids.anterior}`);
    await acao.click();
    await page.waitForURL((u) => u.searchParams.get("p") === ids.anterior, { timeout: 30_000 });
    await expect(page.locator(`[data-testid="fecho-linha"][data-chave="A:${ids.anterior}"]`)).toHaveAttribute("data-atual", "sim", { timeout: 30_000 });
    await expect(page.getByTestId("inicio-estadia"), "a data de início é a da estadia anterior, não a do fecho aberto antes").toHaveValue(dataBR(ANTERIOR.entrada), { timeout: 30_000 });
    await page.screenshot({ path: `${SAIDA}/t1790-assistente-da-anterior-1280.png`, fullPage: true });

    // O contrato gerado nasce com o período da estadia anterior, da proposta anterior.
    await gerarContratoPelaTela(page);
    await expect
      .poll(async () => ((await adm().from("contratos").select("proposta_id, periodo").eq("lead_id", ids.lead)).data ?? []).length, { timeout: 30_000 })
      .toBe(1);
    const { data: ct } = await adm().from("contratos").select("proposta_id, periodo").eq("lead_id", ids.lead).single();
    expect(ct?.proposta_id, "o contrato é da proposta anterior").toBe(ids.anterior);
    expect(String(ct?.periodo ?? ""), "o período começa na entrada da estadia anterior").toMatch(new RegExp(`^\\[${ANTERIOR.entrada},`));
    expect(String(ct?.periodo ?? "")).not.toContain(RECENTE.entrada);
    // A taxa da estadia anterior também sai (a reserva da cobrança é DESSA proposta, com o id externo gravado).
    await expect
      .poll(async () => ((await adm().from("cobrancas_fechamento").select("externo_id").eq("lead_id", ids.lead).eq("tipo", "comissao").eq("proposta_id", ids.anterior)).data ?? []).filter((r) => r.externo_id).length, { timeout: 30_000, message: "a taxa da estadia anterior foi gerada" })
      .toBe(1);
    const { data: reservas } = await adm().from("cobrancas_fechamento").select("id").eq("lead_id", ids.lead).eq("tipo", "comissao");
    expect(reservas ?? [], "uma só reserva da taxa").toHaveLength(1);
    const { data: ctTaxa } = await adm().from("contratos").select("comissao_percent").eq("lead_id", ids.lead).single();
    expect(Number(ctTaxa?.comissao_percent), "a taxa congelada da proposta escolhida").toBe(0.12);
    await page.context().close();
  });

  test("abrir o ?p= de uma estadia que já tem contrato: só leitura (o resumo e 'Ver contrato'), sem gerar, nada novo no banco", async ({ browser }) => {
    const antes = ((await adm().from("contratos").select("id").eq("lead_id", ids.lead)).data ?? []).length;
    expect(antes, "o caso anterior deixou o contrato da estadia anterior").toBe(1);
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/dashboard/fechamento?c=${ids.lead}&p=${ids.anterior}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("fechamento-somente-leitura")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("resumo-contrato").first()).toBeVisible();
    await expect(page.getByTestId("fechamento-gerar-contrato")).toHaveCount(0);
    expect(page.url(), "sem redirect").toContain("/dashboard/fechamento");
    await page.screenshot({ path: `${SAIDA}/t1790-somente-leitura-1280.png`, fullPage: true });
    expect(((await adm().from("contratos").select("id").eq("lead_id", ids.lead)).data ?? []).length, "nada novo no banco").toBe(1);
    expect(((await adm().from("cobrancas_fechamento").select("id").eq("lead_id", ids.lead).eq("tipo", "comissao")).data ?? []).length).toBe(1);
    await page.context().close();
  });
});
