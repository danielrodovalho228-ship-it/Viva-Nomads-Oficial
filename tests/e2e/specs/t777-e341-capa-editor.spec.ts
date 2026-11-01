import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T777 — E341 (01/11): sem capa própria, a página pública do parceiro usa a 1ª foto da galeria (E306) — e o editor
  (aba Página) agora mostra ESSA foto como a capa que vale, com "Sem capa própria: sua página usa como capa a 1ª foto
  da sua galeria. Envie uma capa…", em vez de "Sem capa ainda (opcional)". 390 e 1280.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: string[] = [];
const slug = `capa-e341-${sufixo}`.toLowerCase().replace(/[^a-z0-9-]/g, "");
let email = "";
let parceiroId = "";

test.describe("T777 — E341: a capa que vale, no editor do parceiro", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas de teste).");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    email = `owner.${randomBytes(3).toString("hex")}.${sufixo}@lab.vivanomads.test`;
    const id = await criarConta({ email, nome: `Clara Capa E341 ${sufixo}`, role: "owner" }, senha);
    ids.push(id);
    const { data, error } = await adm()
      .from("parceiros")
      .insert({ user_id: id, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: `Reparos E341 ${sufixo}`, slug, categorias: ["manutencao"], cidades: ["Uberlândia"], descricao_curta: "Parceiro de laboratório.", status: "publicado", publicado_em: new Date().toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    parceiroId = data.id as string;
    // Uma foto real na galeria (o bucket só aceita WebP), sem capa e sem foto de perfil.
    const path = `${parceiroId}/galeria-t777-0.webp`;
    const { error: eUp } = await adm().storage.from("parceiros").upload(path, readFileSync("public/images/parceiros-categorias/manutencao.webp"), { contentType: "image/webp", upsert: true });
    if (eUp) throw eUp;
    const { error: eG } = await adm().from("parceiro_galeria").insert({ parceiro_id: parceiroId, path, ordem: 0 });
    if (eG) throw eG;
  });
  test.afterAll(async () => {
    await adm().storage.from("parceiros").remove([`${parceiroId}/galeria-t777-0.webp`]);
    await adm().from("parceiros").delete().eq("slug", slug);
    await apagarContas(ids);
  });

  for (const largura of [390, 1280]) {
    test(`editor mostra a capa da galeria que a página usa (${largura})`, async ({ browser }) => {
      const page = await entrar(browser, email, senha);
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
      const previa = page.getByTestId("parceiro-banner-previa");
      await expect(previa).toHaveAttribute("data-origem", "galeria", { timeout: 30_000 });
      await expect(previa).toHaveAttribute("src", /\/galeria-t777-0\.webp$/);
      await expect(page.getByTestId("parceiro-capa-aviso")).toHaveText(
        "Sem capa própria: sua página usa como capa a 1ª foto da sua galeria. Envie uma capa para escolher a sua.",
      );
      await expect(page.getByTestId("parceiro-enviar-banner")).toBeVisible();
      await expect(page.getByText("Sem capa ainda (opcional).")).toHaveCount(0);
      await previa.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `tests/laboratorio/saida/t777-editor-${largura}.png` });

      // A página pública usa a mesma foto.
      await page.goto(`/parceiros/${slug}`, { waitUntil: "domcontentloaded" });
      const capa = page.getByTestId("parceiro-capa");
      await expect(capa).toHaveAttribute("data-origem", "galeria", { timeout: 30_000 });
      await expect(capa.locator("img").first()).toHaveAttribute("src", /\/galeria-t777-0\.webp$/);
      await page.context().close();
    });
  }
});
