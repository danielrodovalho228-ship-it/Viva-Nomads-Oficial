import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, fotosReais, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T767 — E308 (devolução de 01/11): o bloco "Continue seu anúncio" do Início do dono mostra a FOTO REAL do rascunho
  (a primeira, em encaixe de capa) quando o rascunho tem foto; sem foto, o placeholder desenhado. A 390 e a 1280.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t767.${sufixo}@lab.vivanomads.test`, nome: "Rui Rascunho", role: "owner" as const };
const ids: { dono?: string; comFoto?: string } = {};

test.describe("T767 — E308: foto real do rascunho no Início do dono", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true, preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    // Rascunho COM 8 fotos reais (Storage local) e que ainda não publica → "Continue seu anúncio".
    ids.comFoto = await criarImovelPronto(ids.dono, `Studio foto t767 ${sufixo}`, { semInternet: true, semConforto: true });
    await fotosReais(ids.comFoto, ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    test(`rascunho COM foto (${largura} px): a primeira foto em capa`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const bloco = p.getByTestId("inicio-dono-principal");
      await expect(bloco).toBeVisible({ timeout: 30_000 });
      await expect(bloco).toHaveAttribute("data-tipo", "rascunho");
      await expect(bloco).toContainText("Continue seu anúncio");
      const foto = bloco.getByTestId("inicio-dono-foto");
      await expect(foto).toBeVisible();
      const { data: primeira } = await adm().from("property_photos").select("url").eq("property_id", ids.comFoto!).order("sort_order").limit(1).single();
      await expect(foto).toHaveAttribute("src", (primeira as { url: string }).url);
      await expect.poll(() => foto.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), { timeout: 20_000 }).toBe(true);
      expect(await foto.evaluate((i) => getComputedStyle(i).objectFit)).toBe("cover");
      await expect(bloco.getByTestId("inicio-dono-foto-vazia")).toHaveCount(0);
      await bloco.screenshot({ path: `${SAIDA}/t767-com-foto-${largura}.png` });
      await p.context().close();
    });
  }

  test("rascunho SEM foto: placeholder desenhado (nada de foto inventada)", async ({ browser }) => {
    // Um rascunho mais novo, sem nenhuma foto, passa a ser o do bloco.
    const semFoto = await criarImovelPronto(ids.dono!, `Studio sem foto t767 ${sufixo}`, { semInternet: true, semConforto: true });
    await adm().from("property_photos").delete().eq("property_id", semFoto);
    const p = await entrar(browser, dono.email, senha);
    for (const largura of [1280, 390] as const) {
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const bloco = p.getByTestId("inicio-dono-principal");
      await expect(bloco).toHaveAttribute("data-tipo", "rascunho", { timeout: 30_000 });
      await expect(bloco.getByTestId("inicio-dono-foto-vazia")).toBeVisible();
      await expect(bloco.getByTestId("inicio-dono-foto")).toHaveCount(0);
      await bloco.screenshot({ path: `${SAIDA}/t767-sem-foto-${largura}.png` });
    }
    await p.context().close();
  });
});
