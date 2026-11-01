import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T770 — E306 (01/11): na busca de parceiros, o cartão de quem não enviou capa mostra uma foto DO PRÓPRIO parceiro — a
  1ª foto da galeria —, não a foto genérica da categoria. Sem foto nenhuma, a categoria segue como último recurso.
  A 390 e a 1280.
*/
test.use({ storageState: { cookies: [], origins: [] } });
const sufixo = novoSufixo();
const senha = novaSenha();
const ids: { conta?: string; conta2?: string; comGaleria?: string; semFoto?: string } = {};
const slugGaleria = `limpeza-t770g-${sufixo}`;
const slugSemFoto = `limpeza-t770s-${sufixo}`;

async function parceiro(conta: string, nome: string, slug: string): Promise<string> {
  const { data, error } = await adm()
    .from("parceiros")
    .insert({ user_id: conta, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: nome, slug, categorias: ["limpeza"], cidades: ["Uberlândia"], status: "publicado", publicado_em: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

test.describe("T770 — E306: capa do cartão com a foto do parceiro", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.conta = await criarConta({ email: `limp.t770g.${sufixo}@lab.vivanomads.test`, nome: "Gal Galeria", role: "owner" }, senha);
    ids.conta2 = await criarConta({ email: `limp.t770s.${sufixo}@lab.vivanomads.test`, nome: "Sil Semfoto", role: "owner" }, senha);
    ids.comGaleria = await parceiro(ids.conta, `[TESTE QA] Limpeza Galeria T770 ${sufixo}`, slugGaleria);
    ids.semFoto = await parceiro(ids.conta2, `[TESTE QA] Limpeza Sem Foto T770 ${sufixo}`, slugSemFoto);
    // A galeria do parceiro (sem capa e sem foto de perfil): duas fotos reais no bucket público (o bucket só aceita WebP).
    const arquivos = ["public/images/parceiros-categorias/manutencao.webp", "public/images/parceiros-categorias/lavanderia.webp"];
    for (const i of [0, 1]) {
      const path = `${ids.comGaleria}/galeria-t770-${i}.webp`;
      const { error: eUp } = await adm().storage.from("parceiros").upload(path, readFileSync(arquivos[i]), { contentType: "image/webp", upsert: true });
      if (eUp) throw eUp;
      const { error } = await adm().from("parceiro_galeria").insert({ parceiro_id: ids.comGaleria, path, ordem: i });
      if (error) throw error;
    }
  });
  test.afterAll(async () => {
    for (const id of [ids.comGaleria, ids.semFoto]) if (id) await adm().from("parceiros").delete().eq("id", id);
    await apagarContas([ids.conta, ids.conta2]);
  });

  for (const largura of [390, 1280]) {
    test(`${largura} px`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/parceiros/buscar?categoria=limpeza&cidade=Uberl%C3%A2ndia&uf=MG", { waitUntil: "domcontentloaded" });
      const comGaleria = page.locator(`[data-testid="cartao-parceiro"][data-slug="${slugGaleria}"]`);
      await expect(comGaleria).toBeVisible({ timeout: 30_000 });
      const capa = comGaleria.getByTestId("cartao-parceiro-capa");
      await expect(capa).toHaveAttribute("data-origem", "galeria");
      const img = capa.locator("img").first();
      await expect(img).toHaveAttribute("src", new RegExp(`/storage/v1/object/public/parceiros/${ids.comGaleria}/galeria-t770-0\\.webp$`));
      await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), { timeout: 20_000 }).toBe(true);
      // Sem foto nenhuma: a categoria continua como último recurso (a capa nunca vazia, E298).
      const semFoto = page.locator(`[data-testid="cartao-parceiro"][data-slug="${slugSemFoto}"]`);
      await expect(semFoto.getByTestId("cartao-parceiro-capa")).toHaveAttribute("data-origem", "categoria");
      await comGaleria.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `tests/laboratorio/saida/t770-busca-parceiros-${largura}.png` });
      // O detalhe usa a mesma capa.
      await page.goto(`/parceiros/${slugGaleria}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("parceiro-capa")).toHaveAttribute("data-origem", "galeria", { timeout: 30_000 });
    });
  }
});
