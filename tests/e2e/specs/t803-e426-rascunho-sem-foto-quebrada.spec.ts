import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, fotosReais, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T803 — E426 (01/11): reprova das capas de rascunho depois do #2108. O arquivo da 1ª foto do rascunho sai do bucket (como
  nos 7 rascunhos de produção): Início, Meus imóveis e o assistente reaberto (Passo 2) não mostram nenhuma imagem
  quebrada. 1280 e 390.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t803.${sufixo}@lab.vivanomads.test`, nome: "Rita Rascunho", role: "owner" as const };
const ids: { dono?: string; rascunho?: string } = {};

async function quebradas(p: Page): Promise<number> {
  await p.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await p.waitForTimeout(1500);
  return p.evaluate(() => [...document.querySelectorAll("img")].filter((i) => i.src.includes("/property-photos/") && i.complete && i.naturalWidth === 0).length);
}

test.describe("T803 — E426: rascunho sem foto quebrada", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true, preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    ids.rascunho = await criarImovelPronto(ids.dono, `Studio rascunho t803 ${sufixo}`, { semInternet: true, semConforto: true });
    await fotosReais(ids.rascunho, ids.dono);
    const { data: fotos } = await adm().from("property_photos").select("url").eq("property_id", ids.rascunho).order("sort_order");
    const urls = (fotos ?? []).map((f) => (f as { url: string }).url);
    const { data: atual } = await adm().from("properties").select("draft_data").eq("id", ids.rascunho).single();
    const draft = { ...((atual as { draft_data: Record<string, unknown> | null }).draft_data ?? {}), photos: urls.map((url) => ({ url })) };
    await adm().from("properties").update({ draft_data: draft }).eq("id", ids.rascunho);
    const caminho = decodeURIComponent(urls[0].split("/object/public/property-photos/")[1].split("?")[0]);
    await adm().storage.from("property-photos").remove([caminho]);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    test(`arquivo da 1ª foto apagado (${largura} px): nenhuma imagem quebrada`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("inicio-dono-principal")).toBeVisible({ timeout: 30_000 });
      expect(await quebradas(p)).toBe(0);
      await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      expect(await quebradas(p)).toBe(0);
      await p.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=fotos`, { waitUntil: "domcontentloaded" });
      await expect(p.locator("main")).toBeVisible({ timeout: 30_000 });
      expect(await quebradas(p)).toBe(0);
      await p.screenshot({ path: `${SAIDA}/t803-assistente-fotos-${largura}.png` });
      await p.context().close();
    });
  }
});
