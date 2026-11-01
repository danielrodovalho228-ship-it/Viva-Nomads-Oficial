import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T775 — E339 (01/11): a faixa do parceiro de teste diz a verdade conforme quem vê.
    • conta de teste (não dona): na busca e na página, "Parceiro de teste: visível só para contas de teste";
    • o próprio parceiro: na página, "Seu perfil de teste não aparece para o público"; no painel, a mesma explicação;
    • visitante sem login: fora da busca e, pelo link, a faixa de visitante (E297, sem mudança).
  390 e 1280.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: string[] = [];
const slug = `teste-e339-${sufixo}`.toLowerCase().replace(/[^a-z0-9-]/g, "");
const BUSCA = "/parceiros/buscar?categoria=fotografia&cidade=Uberl%C3%A2ndia";

async function conta(papel: "owner" | "tenant", nome: string) {
  const email = `${papel}.${randomBytes(3).toString("hex")}.${sufixo}@lab.vivanomads.test`;
  const id = await criarConta({ email, nome, role: papel }, senha);
  ids.push(id);
  await adm().from("profiles").update({ is_teste: true }).eq("id", id);
  return { id, email };
}

test.describe("T775 — E339: faixa do parceiro de teste", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas de teste).");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  let dono: { id: string; email: string };
  let qa: { id: string; email: string };

  test.beforeAll(async () => {
    dono = await conta("owner", `Paulo Parceiro E339 ${sufixo}`);
    qa = await conta("tenant", `Quésia QA E339 ${sufixo}`);
    const { data, error } = await adm()
      .from("parceiros")
      .insert({ user_id: dono.id, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: `Foto Teste E339 ${sufixo}`, slug, categorias: ["fotografia"], cidades: ["Uberlândia"], descricao_curta: "Parceiro de laboratório.", status: "publicado", publicado_em: new Date().toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    await adm().from("parceiro_servicos").insert({ parceiro_id: data.id, categoria: "fotografia", titulo: "Fotografia completa", preco_base: 300, unidade: "por serviço", ativo: true });
  });
  test.afterAll(async () => {
    await adm().from("parceiros").delete().eq("slug", slug);
    await apagarContas(ids);
  });

  for (const largura of [390, 1280]) {
    test(`conta de teste, dono e visitante (${largura})`, async ({ browser }) => {
      // Conta de teste (não dona): o vê na busca — e a faixa diz isso.
      const p = await entrar(browser, qa.email, senha);
      await p.setViewportSize({ width: largura, height: 900 });
      await p.goto(BUSCA, { waitUntil: "domcontentloaded" });
      const cartao = p.locator(`[data-testid="cartao-parceiro"][data-slug="${slug}"]`);
      await expect(cartao).toBeVisible({ timeout: 25_000 });
      await expect(cartao.getByTestId("cartao-parceiro-teste")).toHaveText("Parceiro de teste: visível só para contas de teste");
      await p.screenshot({ path: `tests/laboratorio/saida/t775-busca-teste-${largura}.png` });
      await p.goto(`/parceiros/${slug}`, { waitUntil: "domcontentloaded" });
      const faixa = p.getByTestId("faixa-parceiro-teste");
      await expect(faixa).toHaveAttribute("data-modo", "equipe", { timeout: 25_000 });
      await expect(faixa).toHaveText("Parceiro de teste: visível só para contas de teste");
      await p.context().close();

      // O próprio parceiro: página e painel dizem que o público não o vê.
      const d = await entrar(browser, dono.email, senha);
      await d.setViewportSize({ width: largura, height: 900 });
      await d.goto(`/parceiros/${slug}`, { waitUntil: "domcontentloaded" });
      await expect(d.getByTestId("faixa-parceiro-teste")).toHaveAttribute("data-modo", "dono", { timeout: 25_000 });
      await expect(d.getByTestId("faixa-parceiro-teste")).toHaveText("Seu perfil de teste não aparece para o público");
      await d.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
      await expect(d.getByTestId("parceiro-perfil-teste")).toHaveText("Seu perfil de teste não aparece para o público.", { timeout: 25_000 });
      await d.screenshot({ path: `tests/laboratorio/saida/t775-painel-dono-${largura}.png` });
      await d.context().close();

      // Visitante sem login: fora da busca; pelo link, a faixa de visitante (E297).
      const v = await (await browser.newContext({ viewport: { width: largura, height: 900 } })).newPage();
      await v.goto(BUSCA, { waitUntil: "domcontentloaded" });
      await expect(v.locator(`[data-testid="cartao-parceiro"][data-slug="${slug}"]`)).toHaveCount(0);
      await v.goto(`/parceiros/${slug}`, { waitUntil: "domcontentloaded" });
      await expect(v.getByTestId("faixa-parceiro-teste")).toHaveAttribute("data-modo", "visitante", { timeout: 25_000 });
      await v.context().close();
    });
  }
});
