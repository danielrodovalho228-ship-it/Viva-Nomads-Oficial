import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T810 — E418 + E383 (02/11): "Meus imóveis" sem a poluição.
   - E418: dois anúncios publicados sem o tipo de entrada → UM aviso discreto no topo (sem link por anúncio, baixo); o
     link "Informar o tipo de entrada" fica no cartão de cada anúncio;
   - E383: dois rascunhos iguais → só o mais recente aparece, com "1 cópia deste rascunho · ver"; a cópia só aparece ao
     pedir; rascunho sem foto mostra só o ícone (nenhum texto no lugar da foto).
  390 e 1280.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t810.${sufixo}@lab.vivanomads.test`, nome: "Iara Imoveis", role: "owner" as const };
const ids: Record<string, string> = {};
const REPETIDO = `Studio repetido t810 ${sufixo}`;

test.describe("T810 — E418 + E383: Meus imóveis limpo", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true, preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    for (const k of ["pub1", "pub2"]) {
      ids[k] = await criarImovelPronto(ids.dono, `Publicado ${k} t810 ${sufixo}`, { ativo: true, preco: 2800 });
      await adm().from("properties").update({ tipo_entrada: null }).eq("id", ids[k]);
    }
    ids.antigo = await criarImovelPronto(ids.dono, REPETIDO, { semInternet: true, semConforto: true });
    ids.novo = await criarImovelPronto(ids.dono, REPETIDO, { semInternet: true, semConforto: true });
    await adm().from("properties").update({ created_at: new Date(Date.now() - 86_400_000).toISOString() }).eq("id", ids.antigo);
    await adm().from("property_photos").delete().in("property_id", [ids.antigo, ids.novo]);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: aviso único, link no cartão, uma cópia por grupo e foto sem texto`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      const cartao = (id: string) => p.locator(`[data-testid="meu-anuncio"][data-imovel="${id}"]`);
      await expect(cartao(ids.pub1)).toBeVisible({ timeout: 30_000 });

      // E418: um aviso, sem links, baixo; o link em cada cartão.
      const aviso = p.getByTestId("aviso-tipo-entrada");
      await expect(aviso).toHaveCount(1);
      await expect(aviso).toContainText("Falta em 2 anúncios publicados");
      await expect(aviso.getByRole("link")).toHaveCount(0);
      expect((await aviso.boundingBox())!.height).toBeLessThan(w === 390 ? 140 : 80);
      for (const k of ["pub1", "pub2"]) await expect(cartao(ids[k]).getByTestId("card-tipo-entrada")).toHaveText("Informar o tipo de entrada");

      // E383: só o mais recente do grupo; a cópia aparece ao pedir.
      await expect(cartao(ids.novo)).toBeVisible();
      await expect(cartao(ids.antigo)).toHaveCount(0);
      const copias = cartao(ids.novo).getByTestId("rascunho-copias");
      await expect(copias).toHaveText("1 cópia deste rascunho · ver");
      // Sem foto: só o ícone, nenhum texto no lugar da foto.
      await expect(cartao(ids.novo).locator("img")).toHaveCount(0);
      await p.screenshot({ path: `${SAIDA}/t810-meus-imoveis-${w}.png`, fullPage: true });
      await copias.click();
      await expect(cartao(ids.antigo)).toBeVisible();
      await expect(cartao(ids.antigo).getByTestId("rascunho-duplicado")).toHaveText("Rascunho duplicado — excluir?");
      expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await p.context().close();
    });
  }
});
