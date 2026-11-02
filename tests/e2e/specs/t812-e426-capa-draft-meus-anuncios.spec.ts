import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, fotosReais, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T812 — E426 (reprova 02/11): em Meus anúncios, o rascunho com fotos SÓ no draft_data mostra a foto real (antes, o
  espaço vazio); o rascunho cujo arquivo saiu do bucket mostra o espaço desenhado (nunca imagem quebrada). 390 e 1280.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t812.${sufixo}@lab.vivanomads.test`, nome: "Clara Capa", role: "owner" as const };
const ids: { dono?: string; comFoto?: string; semArquivo?: string; capa?: string } = {};

async function soNoDraft(id: string, ownerId: string, apagarArquivo: boolean) {
  await fotosReais(id, ownerId);
  const { data: fotos } = await adm().from("property_photos").select("url").eq("property_id", id).order("sort_order");
  const urls = (fotos ?? []).map((f) => (f as { url: string }).url);
  const { data: atual } = await adm().from("properties").select("draft_data").eq("id", id).single();
  const draft = { ...((atual as { draft_data: Record<string, unknown> | null }).draft_data ?? {}), photos: urls.map((url) => ({ url })) };
  await adm().from("properties").update({ draft_data: draft }).eq("id", id);
  await adm().from("property_photos").delete().eq("property_id", id);
  if (apagarArquivo) {
    const caminhos = urls.map((u) => decodeURIComponent(u.split("/object/public/property-photos/")[1].split("?")[0]));
    await adm().storage.from("property-photos").remove(caminhos);
  }
  return urls[0];
}

test.describe("T812 — E426: capa do rascunho pelo draft_data em Meus anúncios", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true, preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    ids.comFoto = await criarImovelPronto(ids.dono, `Rascunho com foto t812 ${sufixo}`, { semInternet: true, semConforto: true });
    ids.semArquivo = await criarImovelPronto(ids.dono, `Rascunho sem arquivo t812 ${sufixo}`, { semInternet: true, semConforto: true });
    ids.capa = await soNoDraft(ids.comFoto, ids.dono, false);
    await soNoDraft(ids.semArquivo, ids.dono, true);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: foto real do draft_data; arquivo apagado → espaço desenhado`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      const cartao = (id: string) => p.locator(`[data-testid="meu-anuncio"][data-imovel="${id}"]`);
      await expect(cartao(ids.comFoto!)).toBeVisible({ timeout: 30_000 });
      const img = cartao(ids.comFoto!).locator("img").first();
      await expect(img).toBeVisible();
      await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), { timeout: 20_000 }).toBe(true);
      await expect(cartao(ids.semArquivo!).locator("img")).toHaveCount(0);
      const quebradas = await p.evaluate(() => [...document.querySelectorAll("main img")].filter((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth === 0).length);
      expect(quebradas).toBe(0);
      await p.screenshot({ path: `${SAIDA}/t812-meus-anuncios-${w}.png`, fullPage: true });
      await p.context().close();
    });
  }
});
