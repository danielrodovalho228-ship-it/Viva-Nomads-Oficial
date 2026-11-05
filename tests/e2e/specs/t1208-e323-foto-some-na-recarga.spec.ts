import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm } from "../fixtures/laboratorio";
import { TAMANHOS, abrirComoConta, lerMassa, temContaVarredura } from "../fixtures/varredura";

/**
 * T1208 — E323 (lista-master, dono Pista C — observar): "a foto de anúncio some numa recarga" — em Meus imóveis, um cartão
 * mostrou a foto real na 1ª carga e um retângulo cinza vazio numa recarga. Aqui, a 390 e 1280, o dono da massa da
 * varredura (DONO17: anúncios com 17, 8 e 1 foto e um rascunho sem foto) recarrega Meus imóveis 6 vezes; em CADA carga,
 * todo cartão de anúncio que tem foto no banco precisa terminar com a imagem carregada de verdade (img com naturalWidth
 * > 0, sem "Foto indisponível"). O cartão sem foto fica fora. A falha diz a carga, a largura, o anúncio e o que apareceu.
 */
const MASSA = lerMassa();
const RECARGAS = 6;

test.describe("T1208 — E323: a foto do cartão de Meus imóveis não some numa recarga", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.skip(!MASSA || !temContaVarredura("DONO17"), "sem a massa da varredura");
  test.describe.configure({ timeout: 300_000 });

  for (const tam of TAMANHOS) {
    test(`${RECARGAS} recargas a ${tam.nome} px: todo cartão com foto carrega a imagem real`, async ({ browser }) => {
      const dono = MASSA!.ids.DONO17;
      const { data: imoveis } = await adm().from("properties").select("id, title").eq("owner_id", dono);
      const comFoto: { id: string; title: string }[] = [];
      for (const im of (imoveis ?? []) as { id: string; title: string }[]) {
        const { count } = await adm().from("property_photos").select("id", { count: "exact", head: true }).eq("property_id", im.id);
        if ((count ?? 0) > 0) comFoto.push(im);
      }
      expect(comFoto.length, "a massa tem anúncios com foto").toBeGreaterThanOrEqual(2);

      const { context, page } = await abrirComoConta(browser, "DONO17", tam.nome);
      const ocorrencias: string[] = [];
      try {
        for (let carga = 1; carga <= RECARGAS; carga++) {
          if (carga === 1) await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
          else await page.reload({ waitUntil: "domcontentloaded" });
          await expect(page.locator('[data-testid="meu-anuncio"]').first()).toBeVisible({ timeout: 30_000 });
          for (const im of comFoto) {
            const cartao = page.locator(`[data-testid="meu-anuncio"][data-imovel="${im.id}"]`);
            if (!(await cartao.count())) continue; // cópia de rascunho recolhida (E383) ou fora da página
            await cartao.scrollIntoViewIfNeeded();
            // Até 15 s para a imagem real terminar de carregar (a rede do laboratório é local).
            const estado = await expect
              .poll(
                async () =>
                  cartao.evaluate((el) => {
                    if (el.querySelector('[data-testid="foto-indisponivel"]')) return "foto indisponível";
                    const img = el.querySelector("img");
                    if (!img) return "sem <img> (espaço vazio)";
                    return img.complete && img.naturalWidth > 0 ? "ok" : `img sem carregar (${img.currentSrc.slice(-60)})`;
                  }),
                { timeout: 15_000, intervals: [250, 500, 1000] },
              )
              .toBe("ok")
              .then(() => "ok")
              .catch(async () =>
                cartao.evaluate((el) => {
                  if (el.querySelector('[data-testid="foto-indisponivel"]')) return "foto indisponível";
                  const img = el.querySelector("img");
                  return img ? `img sem carregar (complete=${img.complete}, naturalWidth=${img.naturalWidth})` : "sem <img> (espaço vazio)";
                }),
              );
            if (estado !== "ok") ocorrencias.push(`carga ${carga}/${RECARGAS}, ${tam.nome} px, "${im.title}": ${estado}`);
          }
        }
        expect(ocorrencias, `E323 — foto que some numa recarga:\n${ocorrencias.join("\n")}`).toEqual([]);
      } finally {
        await context.close();
      }
    });
  }
});
