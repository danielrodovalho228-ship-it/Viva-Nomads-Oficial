import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";

/*
  T1697 — E1035 (ORDEM-DUET-179, 19/11/2026; era a Dúvida 1 do #4015). O rascunho cuja linha tem as colunas e as fotos
  mas não tem `draft_data` abria com o formulário vazio. O E1034 impediu que ABRIR gravasse por cima. Faltava EDITAR: ao
  mexer num campo, o formulário (com todos os outros campos vazios) gravava por cima do resto: preço 0, bairro, quartos,
  banheiros, área e descrição a zero, e as fotos apagadas.
  Regra: o rascunho sem `draft_data` abre com o que a linha tem (as colunas e as fotos); editar um campo grava esse campo
  e o resto fica como estava. Só no laboratório.
    1. 1280 px: troca o título no passo Descrição; a gravação muda o título e mais nada.
    2. 390 px: troca os quartos de 1 para 2 no passo Detalhes; a gravação muda os quartos e mais nada.
    3. 1280 px: o formulário abre com o conteúdo da linha (o título, 1 quarto, as 8 fotos) e abrir não grava nada.
  Os dois primeiros DIGITAM no campo: o assistente só conta como edição o que é digitado ou marcado (E516).
  Abrir sem editar continua sem gravar nada: é a t1696 (E1034).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1697.${sufixo}@lab.vivanomads.test`, nome: "Elisa Edita", role: "owner" as const };
const TITULO = `[teste-lab] t1697 rascunho ${sufixo}`;
let donoId = "";

type Linha = Record<string, unknown> & { fotos: string[] };

async function linha(id: string): Promise<Linha> {
  const { data, error } = await adm()
    .from("properties")
    .select("title, city, address, monthly_price, bedrooms, bathrooms, area_m2, description, status, property_type, max_guests, min_period_days, max_period_days, internet_mbps, tipo_entrada")
    .eq("id", id)
    .single();
  if (error) throw error;
  const fotos = await adm().from("property_photos").select("url").eq("property_id", id).order("sort_order");
  if (fotos.error) throw fotos.error;
  return { ...(data as Record<string, unknown>), fotos: (fotos.data ?? []).map((f) => f.url as string) };
}

async function rascunhoSemDados(rotulo: string): Promise<{ id: string; antes: Linha }> {
  const id = await criarImovelPronto(donoId, `${TITULO} ${rotulo}`);
  const { data } = await adm().from("properties").select("draft_data").eq("id", id).single();
  expect((data as { draft_data: unknown }).draft_data, "o rascunho do teste não tem draft_data").toBeNull();
  const antes = await linha(id);
  expect(antes.fotos, "o rascunho do teste tem 8 fotos").toHaveLength(8);
  return { id, antes };
}

/** A gravação da edição chegou ao servidor: o topo mostra "Salvo às …". */
async function gravou(page: Page) {
  await expect(page.getByTestId("estado-salvamento")).toHaveAttribute("data-estado", "saved", { timeout: 30_000 });
}

test.describe("T1697 — E1035: editar o rascunho sem draft_data preserva o resto da linha @E1035", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    donoId = await criarConta(dono, senha);
  });
  test.afterAll(async () => {
    if (donoId) await apagarContas([donoId]);
  });

  test("1280 px: trocar o título grava o título e mais nada", async ({ browser }) => {
    const { id, antes } = await rascunhoSemDados("titulo");
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/dashboard/imoveis/novo?draft=${id}&etapa=descricao`, { waitUntil: "domcontentloaded" });
    await noPasso(page, "descricao", 30_000);
    const novo = `Apartamento editado do laboratório ${sufixo}`;
    await page.getByTestId("cadastro-titulo").fill(novo);
    await gravou(page);
    await expect.poll(async () => (await linha(id)).title, { timeout: 20_000 }).toBe(novo);
    expect(await linha(id), "depois de trocar só o título").toEqual({ ...antes, title: novo });
    await page.context().close();
  });

  test("390 px: trocar os quartos de 1 para 2 grava os quartos e mais nada", async ({ browser }) => {
    const { id, antes } = await rascunhoSemDados("quartos");
    expect(antes.bedrooms).toBe(1);
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/dashboard/imoveis/novo?draft=${id}&etapa=detalhes`, { waitUntil: "domcontentloaded" });
    await noPasso(page, "detalhes", 30_000);
    await page.getByRole("spinbutton", { name: "Quartos", exact: true }).fill("2");
    await gravou(page);
    await expect.poll(async () => (await linha(id)).bedrooms, { timeout: 20_000 }).toBe(2);
    expect(await linha(id), "depois de trocar só os quartos").toEqual({ ...antes, bedrooms: 2 });
    await page.context().close();
  });

  test("1280 px: o formulário abre com o conteúdo da linha", async ({ browser }) => {
    const { id, antes } = await rascunhoSemDados("abre");
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/dashboard/imoveis/novo?draft=${id}&etapa=descricao`, { waitUntil: "domcontentloaded" });
    await noPasso(page, "descricao", 30_000);
    await expect(page.getByTestId("cadastro-titulo")).toHaveValue(antes.title as string, { timeout: 20_000 });
    await page.goto(`/dashboard/imoveis/novo?draft=${id}&etapa=detalhes`, { waitUntil: "domcontentloaded" });
    await noPasso(page, "detalhes", 30_000);
    await expect(page.getByRole("spinbutton", { name: "Quartos", exact: true })).toHaveValue("1", { timeout: 20_000 });
    await page.goto(`/dashboard/imoveis/novo?draft=${id}&etapa=fotos`, { waitUntil: "domcontentloaded" });
    await noPasso(page, "fotos", 30_000);
    await expect(page.getByText(/^8\/40 fotos/)).toBeVisible({ timeout: 20_000 });
    // Abrir e passear entre os passos não gravou nada (o autosave espera 2 s; a janela cobre a gravação e a volta).
    await page.waitForTimeout(6_000);
    expect(await linha(id), "depois de abrir três passos, sem editar").toEqual(antes);
    const { data } = await adm().from("properties").select("draft_data").eq("id", id).single();
    expect((data as { draft_data: unknown }).draft_data, "abrir não gravou o draft_data").toBeNull();
    await page.context().close();
  });
});
