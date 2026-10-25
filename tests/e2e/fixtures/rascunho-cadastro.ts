import { type Browser, type BrowserContextOptions, type Page } from "@playwright/test";
import { adm, criarImovelPronto, entrarNaPagina, pngDeTeste } from "./laboratorio";
import { noPasso, type PassoCadastro } from "./cadastro";

/*
  Levantamento do Daniel de 25/10 (E133–E154, assistente de cadastro), virado em spec pela Pista C: um rascunho do
  laboratório aberto direto no passo (?draft=…&etapa=…), com N fotos de teste e o que o passo precisa no draft_data.
*/

/** Data de Brasília daqui a `n` dias (AAAA-MM-DD). */
export function emDiasBR(n: number): string {
  const d = new Date(Date.now() - 3 * 3_600_000);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const isoParaBR = (iso: string) => iso.split("-").reverse().join("/");

/** "R$ 3.500,00" / "R$ 14.000" → 3500 / 14000. */
export function reais(texto: string): number {
  const m = texto.match(/R\$\s?([\d.]+(?:,\d{1,2})?)/);
  if (!m) return NaN;
  return Number(m[1].replace(/\./g, "").replace(",", "."));
}

/**
 * Rascunho com `nFotos` fotos de teste (a galeria no formato do envio: https na pasta do dono, como na t432) e o
 * draft_data do assistente com título, tipo, cidade, fotos e o que vier em `draft`.
 */
export async function prepararRascunho(donoId: string, titulo: string, draft: Record<string, unknown> = {}, nFotos = 8): Promise<string> {
  const id = await criarImovelPronto(donoId, titulo);
  const fotos: { id: string; url: string; name: string; path: string; demo: boolean }[] = [];
  for (let i = 0; i < nFotos; i++) {
    const caminho = `${donoId}/${id}-r${i}.png`;
    const { error } = await adm().storage.from("property-photos").upload(caminho, pngDeTeste(i), { contentType: "image/png", upsert: true });
    if (error) throw error;
    fotos.push({ id: `lab-${i}`, url: `https://lab.vivanomads.test/storage/v1/object/public/property-photos/${caminho}`, name: "", path: caminho, demo: false });
  }
  await adm().from("property_photos").delete().eq("property_id", id);
  if (fotos.length) {
    const { error } = await adm().from("property_photos").insert(fotos.map((f, i) => ({ property_id: id, url: f.url, sort_order: i })));
    if (error) throw error;
  }
  const { error } = await adm()
    .from("properties")
    .update({ draft_data: { title: titulo, propertyType: "Studio", city: "Uberlândia", photos: fotos, ...draft } })
    .eq("id", id);
  if (error) throw error;
  return id;
}

/** Entra como o dono e abre o rascunho no passo pedido (390 ou 1280 px; `ctx` para toque/idioma). */
export async function abrirPasso(
  browser: Browser,
  conta: { email: string; senha: string },
  id: string,
  passo: PassoCadastro,
  largura = 1280,
  ctx: BrowserContextOptions = {},
): Promise<Page> {
  const contexto = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 }, ...ctx });
  const page = await entrarNaPagina(await contexto.newPage(), conta.email, conta.senha);
  await page.goto(`/dashboard/imoveis/novo?draft=${id}&etapa=${passo}`, { waitUntil: "domcontentloaded" });
  await noPasso(page, passo, 30_000);
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  return page;
}

/** O "Continuar" do rodapé e o passo onde a tela ficou depois do clique. */
export async function continuarFicaEm(page: Page, passo: PassoCadastro) {
  await page.getByTestId("cadastro-continuar").click();
  await noPasso(page, passo);
}

