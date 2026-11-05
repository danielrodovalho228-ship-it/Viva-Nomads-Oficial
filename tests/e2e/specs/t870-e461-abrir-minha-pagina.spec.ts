import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T870 — E461: no cartão "Imóveis fixos" do painel do parceiro, "Abrir minha página" levava ao próprio painel. Agora:
    1) página PUBLICADA → abre a página pública /parceiros/<slug> (em outra aba);
    2) página em RASCUNHO → leva ao editor da página no painel (#editor-pagina, à vista).
  390 e 1280, sessão real.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const pub = { email: `pub.t870.${sufixo}@lab.vivanomads.test`, nome: "Paula Publicada", role: "owner" as const };
const ras = { email: `ras.t870.${sufixo}@lab.vivanomads.test`, nome: "Rita Rascunho", role: "owner" as const };
const ids: Record<string, string> = {};
const slugPub = `paula-t870-${sufixo}`;

async function parceiro(userId: string, nome: string, slug: string, status: "publicado" | "rascunho"): Promise<string> {
  const { data, error } = await adm()
    .from("parceiros")
    .insert({ user_id: userId, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: nome, slug, categorias: ["limpeza"], cidades: ["Uberlândia"], descricao_curta: "Parceiro de laboratório.", status, publicado_em: status === "publicado" ? new Date().toISOString() : null })
    .select("id")
    .single();
  if (error) throw error;
  if (status === "publicado") await adm().from("parceiro_servicos").insert({ parceiro_id: data.id, categoria: "limpeza", titulo: "Limpeza completa", preco_base: 250, unidade: "por serviço", ativo: true });
  return data.id as string;
}

test.describe("T870 — 'Abrir minha página' do parceiro", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    ids.pub = await criarConta(pub, senha);
    ids.ras = await criarConta(ras, senha);
    ids.pPub = await parceiro(ids.pub, `Paula Limpeza ${sufixo}`, slugPub, "publicado");
    ids.pRas = await parceiro(ids.ras, `Rita Limpeza ${sufixo}`, `rita-t870-${sufixo}`, "rascunho");
  });
  test.afterAll(async () => {
    await adm().from("parceiro_servicos").delete().in("parceiro_id", [ids.pPub, ids.pRas].filter(Boolean));
    await adm().from("parceiros").delete().in("id", [ids.pPub, ids.pRas].filter(Boolean));
    await apagarContas([ids.pub, ids.ras]);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: publicada → página pública; rascunho → editor`, async ({ browser }) => {
      // 1) Publicada: abre /parceiros/<slug> numa aba nova.
      const c1 = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      const p1 = await entrarNaPagina(await c1.newPage(), pub.email, senha);
      await p1.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
      const b1 = p1.getByTestId("imoveis-fixos-minha-pagina");
      await expect(b1).toBeVisible({ timeout: 20_000 });
      await expect(b1).toHaveText("Abrir minha página");
      await expect(b1).toHaveAttribute("href", `/parceiros/${slugPub}`);
      await expect(b1).toHaveAttribute("target", "_blank");
      const [aba] = await Promise.all([c1.waitForEvent("page"), b1.click()]);
      await aba.waitForLoadState("domcontentloaded");
      expect(new URL(aba.url()).pathname).toBe(`/parceiros/${slugPub}`);
      await c1.close();

      // 2) Rascunho: leva ao editor da página no painel.
      const c2 = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      const p2 = await entrarNaPagina(await c2.newPage(), ras.email, senha);
      await p2.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
      const b2 = p2.getByTestId("imoveis-fixos-minha-pagina");
      await expect(b2).toBeVisible({ timeout: 20_000 });
      await expect(b2).toHaveAttribute("href", "/dashboard/parceiro#editor-pagina");
      await b2.click();
      await expect(p2).toHaveURL(/\/dashboard\/parceiro#editor-pagina$/);
      await expect(p2.locator("#editor-pagina")).toBeInViewport();
      await p2.screenshot({ path: `tests/laboratorio/saida/t870-editor-${w}.png` });
      await c2.close();
    });
  }
});
