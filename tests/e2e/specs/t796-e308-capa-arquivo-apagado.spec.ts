import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, fotosReais, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T796 — E308 (causa raiz, 01/11): capa de rascunho com imagem quebrada. Em produção, linhas de foto apontavam para
  arquivos já apagados do bucket (um arquivo usado por vários imóveis saía quando UM deles tirava a foto). Aqui o
  arquivo da 1ª foto sai do bucket: o "Continue seu anúncio" e o cartão de Meus imóveis usam a 2ª foto, que carrega —
  nunca uma imagem quebrada. 1280 e 390.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t796.${sufixo}@lab.vivanomads.test`, nome: "Dalva Capa", role: "owner" as const };
const ids: { dono?: string; rascunho?: string; segunda?: string } = {};

test.describe("T796 — E308: capa ignora arquivo apagado", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true, preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    ids.rascunho = await criarImovelPronto(ids.dono, `Studio capa t796 ${sufixo}`, { semInternet: true, semConforto: true });
    await fotosReais(ids.rascunho, ids.dono);
    const { data: fotos } = await adm().from("property_photos").select("url").eq("property_id", ids.rascunho).order("sort_order");
    const urls = (fotos ?? []).map((f) => (f as { url: string }).url);
    ids.segunda = urls[1];
    const caminho = decodeURIComponent(urls[0].split("/object/public/property-photos/")[1].split("?")[0]);
    await adm().storage.from("property-photos").remove([caminho]);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    test(`1ª foto sem arquivo (${largura} px): a capa é a 2ª e carrega`, async ({ browser }) => {
      expect(ids.segunda, "o laboratório gravou fotos reais").toBeTruthy();
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const bloco = p.getByTestId("inicio-dono-principal");
      await expect(bloco).toHaveAttribute("data-tipo", "rascunho", { timeout: 30_000 });
      const foto = bloco.getByTestId("inicio-dono-foto");
      await expect(foto).toHaveAttribute("src", ids.segunda!);
      await expect.poll(() => foto.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), { timeout: 20_000 }).toBe(true);
      await bloco.screenshot({ path: `${SAIDA}/t796-inicio-${largura}.png` });

      // Meus imóveis: nenhuma imagem quebrada nos cartões.
      await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      await p.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      const quebradas = await p.evaluate(() =>
        [...document.querySelectorAll("main img")].filter((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth === 0 && (i as HTMLImageElement).src.includes("/property-photos/")).length,
      );
      expect(quebradas).toBe(0);
      await p.screenshot({ path: `${SAIDA}/t796-imoveis-${largura}.png` });
      await p.context().close();
    });
  }
});
