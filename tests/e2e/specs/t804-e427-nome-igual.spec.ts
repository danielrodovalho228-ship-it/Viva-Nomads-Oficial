import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { nomeDepoisDoAceite } from "../../../src/lib/visitas/nome-visita";
import { nomeCurto } from "../../../src/lib/perfil/perfil-publico";

/*
  T804 — E427 (01/11, vigia): DEPOIS do aceite, o nome é COMPLETO e IGUAL na visita e na página pública; ANTES do aceite
  (visitante anônimo / morador sem visita confirmada), a privacidade de sempre: o nome curto na página pública e nenhum
  nome na visita. A visita confirmada é o aceite prático (E328). 390 e 1280.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const NOME = "Dora Prado Lima 2";
const COMPLETO = nomeDepoisDoAceite(NOME)!; // "Dora Prado Lima 2"
const CURTO = nomeCurto(NOME)!; // "Dora L."
const dono = { email: `dono.t804.${sufixo}@lab.vivanomads.test`, nome: NOME, role: "owner" as const };
const inq = { email: `inq.t804.${sufixo}@lab.vivanomads.test`, nome: "Iara Visita Sobrenome", role: "tenant" as const };
const ids: Record<string, string> = {};

test.describe("T804 — E427: nome completo e igual depois do aceite; privacidade antes", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ full_name: NOME }).eq("id", ids.dono);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio nome t804 ${sufixo}`, { ativo: true, preco: 2600 });
    const amanha = new Date(Date.now() + 26 * 3600_000).toISOString();
    const { data, error } = await adm()
      .from("visitas_video")
      .insert({ property_id: ids.imovel, owner_id: ids.dono, tenant_id: ids.inq, horarios: [amanha], modalidade: "video" })
      .select("id")
      .single();
    if (error) throw error;
    ids.visita = (data as { id: string }).id;
  });
  test.afterAll(async () => {
    await adm().from("visitas_video").delete().eq("id", ids.visita ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  test("as regras: completo depois do aceite, curto antes", () => {
    expect(COMPLETO).toBe("Dora Prado Lima 2");
    expect(CURTO).toBe("Dora L.");
  });

  test("ANTES do aceite (anônimo e morador com visita só pedida): nome curto na página pública, nenhum nome na visita", async ({ browser }) => {
    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const pa = await anon.newPage();
    const p = await entrar(browser, inq.email, senha);
    for (const w of [390, 1280] as const) {
      for (const page of [pa, p]) {
        await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
        await page.goto(`/proprietario/${ids.dono}`, { waitUntil: "domcontentloaded" });
        const h1 = page.getByTestId("pagina-proprietario").getByRole("heading", { level: 1 });
        await expect(h1).toHaveText(CURTO, { timeout: 30_000 });
        await expect(h1).toHaveAttribute("data-nome", "curto");
        await expect(page.getByTestId("pagina-proprietario")).not.toContainText("Prado Lima");
      }
      await p.goto(`/dashboard/visitas/${ids.visita}`, { waitUntil: "domcontentloaded" });
      await expect(p.locator("main")).toBeVisible({ timeout: 30_000 });
      await expect(p.getByTestId("visita-pessoa-dono")).toHaveCount(0);
      await p.screenshot({ path: `tests/laboratorio/saida/t804-antes-${w}.png` });
    }
    await anon.close();
    await p.context().close();
  });

  test("DEPOIS do aceite (visita confirmada): o MESMO nome completo na visita e na página pública; anônimo segue curto", async ({ browser }) => {
    const { error } = await adm().from("visitas_video").update({ status: "confirmado", horario_confirmado: new Date(Date.now() + 26 * 3600_000).toISOString() }).eq("id", ids.visita);
    expect(error).toBeNull();
    const p = await entrar(browser, inq.email, senha);
    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const pa = await anon.newPage();
    for (const w of [390, 1280] as const) {
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto(`/dashboard/visitas/${ids.visita}`, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("visita-pessoa-dono")).toContainText(`Quem recebe: ${COMPLETO}`, { timeout: 30_000 });
      await p.screenshot({ path: `tests/laboratorio/saida/t804-visita-depois-${w}.png` });

      await p.goto(`/proprietario/${ids.dono}`, { waitUntil: "domcontentloaded" });
      const h1 = p.getByTestId("pagina-proprietario").getByRole("heading", { level: 1 });
      await expect(h1).toHaveText(COMPLETO, { timeout: 30_000 });
      await expect(h1).toHaveAttribute("data-nome", "completo");
      expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      // O título da aba (metadados indexáveis) segue com o nome curto.
      expect(await p.title()).toContain(CURTO);
      await p.screenshot({ path: `tests/laboratorio/saida/t804-proprietario-depois-${w}.png` });

      await pa.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await pa.goto(`/proprietario/${ids.dono}`, { waitUntil: "domcontentloaded" });
      await expect(pa.getByTestId("pagina-proprietario").getByRole("heading", { level: 1 })).toHaveText(CURTO, { timeout: 30_000 });
    }
    await anon.close();
    await p.context().close();
  });
});
