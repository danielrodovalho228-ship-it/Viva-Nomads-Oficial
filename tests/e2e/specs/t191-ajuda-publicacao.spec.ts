import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T191 — ordem 65e999b2 (Próximo do FF 4/6, "Publicamos para você"): rota da fila fechada para quem não é admin
 * e sem rolagem lateral no celular. O fluxo logado (pedir → fila do /admin → andamento no painel) roda com as
 * contas de QA do laboratório (t169). A decisão do DONO (aprovar / pedir ajustes) é provada logada no fim deste arquivo.
 */
test("visitante não entra na fila de ajuda do /admin", async ({ page }) => {
  await page.goto("/admin/ajuda-publicacao", { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/admin\/ajuda-publicacao$/);
});

test("390 px: /auth sem rolagem lateral (a rota privada redireciona)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/ajuda-publicacao", { waitUntil: "domcontentloaded" });
  const sem = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  expect(sem).toBe(true);
});

test.describe("T191 — o dono decide o rascunho (ordem 65e999b2, logado)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas de teste).");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);
  const senha = novaSenha();
  const sufixo = novoSufixo();
  const ids: (string | undefined)[] = [];
  const dono = { email: `ajuda.dono.${sufixo}@lab.vivanomads.test`, id: "" };
  const outro = { email: `ajuda.outro.${sufixo}@lab.vivanomads.test`, id: "" };

  async function pedido(owner: string, status: string): Promise<string> {
    const { data, error } = await adm()
      .from("pedidos_ajuda_publicacao")
      .insert({ owner_id: owner, texto_anuncio: "Studio mobiliado perto do metrô, 30 m², com varanda.", status })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }
  async function statusDe(id: string): Promise<string> {
    const { data } = await adm().from("pedidos_ajuda_publicacao").select("status").eq("id", id).single();
    return data!.status as string;
  }

  test.beforeAll(async () => {
    dono.id = await criarConta({ email: dono.email, nome: "Dona Ajuda Sobrenome", role: "owner" }, senha);
    outro.id = await criarConta({ email: outro.email, nome: "Outro Dono Sobrenome", role: "owner" }, senha);
    ids.push(dono.id, outro.id);
  });
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const largura of [390, 1280]) {
    test(`${largura} px — pedido enviado para aprovação: Aprovar grava aprovado_dono e os botões somem`, async ({ browser }) => {
      const id = await pedido(dono.id, "enviado_dono");
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("decisao-aprovar")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("decisao-ajustes")).toBeVisible();
      await page.getByTestId("decisao-aprovar").click();
      await expect(page.getByTestId("decisao-rascunho")).toHaveCount(0, { timeout: 20_000 });
      expect(await statusDe(id)).toBe("aprovado_dono");
      await page.context().close();
      await adm().from("pedidos_ajuda_publicacao").delete().eq("id", id);
    });
  }

  test("Pedir ajustes grava ajustes_pedidos", async ({ browser }) => {
    const id = await pedido(dono.id, "enviado_dono");
    const page = await entrar(browser, dono.email, senha);
    await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
    await page.getByTestId("decisao-ajustes").click({ timeout: 20_000 });
    await expect(page.getByTestId("decisao-rascunho")).toHaveCount(0, { timeout: 20_000 });
    expect(await statusDe(id)).toBe("ajustes_pedidos");
    await page.context().close();
    await adm().from("pedidos_ajuda_publicacao").delete().eq("id", id);
  });

  test("negativo — pedido ainda 'recebido' não mostra os botões", async ({ browser }) => {
    const id = await pedido(dono.id, "recebido");
    const page = await entrar(browser, dono.email, senha);
    await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ajuda-andamento")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("decisao-rascunho")).toHaveCount(0);
    await page.context().close();
    await adm().from("pedidos_ajuda_publicacao").delete().eq("id", id);
  });

  test("negativo (RLS) — outro dono não decide pedido alheio, e o dono não decide pedido 'recebido'", async () => {
    const entrarComo = async (email: string) => {
      const cli = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
      const { error } = await cli.auth.signInWithPassword({ email, password: senha });
      expect(error).toBeNull();
      return cli;
    };
    const alheio = await pedido(dono.id, "enviado_dono");
    const intruso = await entrarComo(outro.email);
    const r1 = await intruso.from("pedidos_ajuda_publicacao").update({ status: "aprovado_dono" }).eq("id", alheio).select("id");
    expect(r1.data ?? []).toHaveLength(0);
    expect(await statusDe(alheio)).toBe("enviado_dono");

    const recebido = await pedido(dono.id, "recebido");
    const titular = await entrarComo(dono.email);
    const r2 = await titular.from("pedidos_ajuda_publicacao").update({ status: "aprovado_dono" }).eq("id", recebido).select("id");
    expect(r2.data ?? []).toHaveLength(0);
    expect(await statusDe(recebido)).toBe("recebido");
    await adm().from("pedidos_ajuda_publicacao").delete().in("id", [alheio, recebido]);
  });
});
