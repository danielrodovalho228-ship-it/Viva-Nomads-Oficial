import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { MIN_FOTOS, OBRIGATORIOS_ROTULOS } from "../../../src/lib/anuncio/prontidao";
import { iaFotosLiberada, mensagemFaltamFotosIa } from "../../../src/lib/ai/fotos-prompt";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo, publicarPeloEditor, statusDoImovel } from "../fixtures/laboratorio";

/**
 * T45 — REGRA DAS 8 FOTOS (laboratório, ordem 225d0648). Anúncio só publica com 8 fotos, por TRÊS caminhos:
 *  1. Editor (tela): com 7 fotos o "Publicar" fica travado e a lista diz "Pelo menos 8 fotos".
 *  2. Banco, pelo próprio dono (API com a sessão dele, passando pela RLS): o gatilho recusa status "active".
 *  3. Banco, com a chave de serviço (nenhum código futuro consegue furar): mesma recusa.
 * Com a 8ª foto os três caminhos publicam. E a IA "Preencher com IA" é incremental: só libera com as 8 fotos
 * e avisa quantas faltam (nunca chama o provedor no laboratório: 503).
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.fotos.${sufixo}@lab.vivanomads.test`, nome: "Fabio Fotos", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};

test.describe("T45 — Regra das 8 fotos", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio das fotos ${sufixo}`);
    // Tira UMA foto: sobram 7 (o gatilho do banco recalcula photo_count).
    const { data: fotos } = await adm().from("property_photos").select("id").eq("property_id", ids.imovel).order("sort_order", { ascending: false }).limit(1);
    await adm().from("property_photos").delete().eq("id", fotos![0].id);
  });

  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("a regra e a IA incremental no código: 8 é o mínimo e a mensagem diz quantas faltam", () => {
    expect(MIN_FOTOS).toBe(8);
    expect(OBRIGATORIOS_ROTULOS).toContain("Pelo menos 8 fotos");
    expect(iaFotosLiberada(7)).toBe(false);
    expect(iaFotosLiberada(8)).toBe(true);
    expect(mensagemFaltamFotosIa(7)).toBe("Falta 1 foto para a IA montar seu anúncio.");
    expect(mensagemFaltamFotosIa(5)).toBe("Faltam 3 fotos para a IA montar seu anúncio.");
    expect(mensagemFaltamFotosIa(8)).toBe("");
  });

  test("caminho 1 — editor: com 7 fotos o Publicar fica travado e a lista pede 8", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, dono.email, senha);
    await page.goto(`/dashboard/imoveis/${ids.imovel}/editar`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("prontidao")).toContainText("% completo", { timeout: 15_000 });
    await expect(page.getByText(/Falta para publicar:.*Pelo menos 8 fotos/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Publicar", exact: true })).toBeDisabled();
    expect(await statusDoImovel(ids.imovel!)).toBe("draft");
    await page.context().close();
  });

  test("caminho 2 — API com a sessão do próprio dono: o banco recusa", async () => {
    const cliente = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    const { error: eLogin } = await cliente.auth.signInWithPassword({ email: dono.email, password: senha });
    expect(eLogin).toBeNull();
    const r = await cliente.from("properties").update({ status: "active" }).eq("id", ids.imovel!);
    expect(r.error?.message ?? "").toMatch(/8 fotos/);
    expect(await statusDoImovel(ids.imovel!)).toBe("draft");
  });

  test("caminho 3 — chave de serviço: o gatilho recusa do mesmo jeito", async () => {
    const r = await adm().from("properties").update({ status: "active" }).eq("id", ids.imovel!);
    expect(r.error?.message ?? "").toMatch(/8 fotos/);
    expect(await statusDoImovel(ids.imovel!)).toBe("draft");
  });

  test("IA por fotos não roda no laboratório (503) nem sem login (401/503), sem vazar chave", async ({ request }) => {
    const r = await request.post("/api/ai/fotos", { data: { miniaturas: [] } });
    expect([401, 503]).toContain(r.status());
    expect(await r.text()).not.toMatch(/sk-ant|api[_-]?key/i);
  });

  test("com a 8ª foto, o editor publica", async ({ browser }) => {
    test.setTimeout(120_000);
    const caminho = `${ids.dono}/${ids.imovel}-extra.png`;
    const { pngDeTeste } = await import("../fixtures/laboratorio");
    const { error: eUp } = await adm().storage.from("property-photos").upload(caminho, pngDeTeste(9), { contentType: "image/png", upsert: true });
    expect(eUp).toBeNull();
    const { error } = await adm().from("property_photos").insert({ property_id: ids.imovel, url: `https://lab.vivanomads.test/storage/v1/object/public/property-photos/${caminho}`, sort_order: 7 });
    expect(error).toBeNull();
    const page = await entrar(browser, dono.email, senha);
    await publicarPeloEditor(page, ids.imovel!);
    await expect(page.getByTestId("prontidao")).toHaveText("Anúncio publicado", { timeout: 20_000 });
    expect(await statusDoImovel(ids.imovel!)).toBe("active");
    await page.context().close();
  });
});
