import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, novoSufixo } from "../fixtures/laboratorio";

/*
  T630 — E223: os interesses de parceria (formulário antigo, parceiros_interesse) aparecem em /admin/parceiros com a
  situação visível e os botões da situação, pela ação que já existe (atualizarStatusInteresse). Com UM interesse de
  teste criado aqui (nenhum interesse real é tocado):
   1. admin: novo → "Marcar como contatado" → contatado, e o contador "Novos (sem contato)" cai 1 (a mesma leitura da
      lista); "Arquivar" → arquivado; "Reabrir" → novo, e o contador volta. O banco acompanha cada passo.
   2. quem não é admin não alcança: não vê a lista, e a mesma chamada da ação, feita com a sessão de um proprietário,
      não muda nada no banco.
*/
const sufixo = novoSufixo();
const nome = `Lab T630 ${sufixo}`;
let id = "";
let chamada: { url: string; acao: string; tipo: string } | null = null;

const situacaoNoBanco = async () => ((await adm().from("parceiros_interesse").select("status").eq("id", id).single()).data?.status as string | undefined) ?? null;
const novos = async (page: Page) => Number(await page.getByTestId("interesses-novos").locator("[data-valor]").innerText());

test.describe("T630 — E223: interesses de parceria com a situação e os botões no admin", () => {
  test.skip(!NO_LABORATORIO, "Precisa do banco do laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    const { data, error } = await adm()
      .from("parceiros_interesse")
      .insert({ tipo: "fotografo", nome, cidade: "Goiânia", uf: "GO", email: `t630.${sufixo}@lab.vivanomads.test`, aceite_contato: true })
      .select("id")
      .single();
    if (error) throw error;
    id = data.id as string;
  });

  test.afterAll(async () => {
    if (id) await adm().from("parceiros_interesse").delete().eq("id", id);
  });

  test.describe("admin", () => {
    test.use({ storageState: authFile("admin") });

    test("1. novo → contatado (o contador cai) → arquivado → reabrir (o contador volta)", async ({ page }) => {
      page.on("request", (r) => {
        const acao = r.headers()["next-action"];
        if (!chamada && acao && r.method() === "POST" && (r.postData() ?? "").includes(id)) chamada = { url: r.url(), acao, tipo: r.headers()["content-type"] ?? "text/plain;charset=UTF-8" };
      });
      await page.goto("/admin/parceiros#interessados", { waitUntil: "domcontentloaded" });
      const linha = page.locator(`[data-testid="interesse-parceria"][data-id="${id}"]`);
      await expect(linha).toHaveAttribute("data-status", "novo", { timeout: 20_000 });
      await expect(linha.getByTestId("interesse-status")).toHaveText("Novo");
      await expect(linha).toContainText(nome);
      const antes = await novos(page);
      expect(antes).toBeGreaterThanOrEqual(1);

      await linha.getByTestId("interesse-para-contatado").click();
      await expect(linha).toHaveAttribute("data-status", "contatado", { timeout: 20_000 });
      await expect(linha.getByTestId("interesse-status")).toHaveText("Contatado");
      await expect.poll(() => novos(page)).toBe(antes - 1);
      expect(await situacaoNoBanco()).toBe("contatado");
      await page.screenshot({ path: "tests/laboratorio/saida/t630-contatado.png", fullPage: false });

      await linha.getByTestId("interesse-para-arquivado").click();
      await expect(linha).toHaveAttribute("data-status", "arquivado", { timeout: 20_000 });
      expect(await situacaoNoBanco()).toBe("arquivado");
      await expect(linha.getByTestId("interesse-para-contatado")).toHaveCount(0);

      await linha.getByTestId("interesse-para-novo").click();
      await expect(linha).toHaveAttribute("data-status", "novo", { timeout: 20_000 });
      await expect.poll(() => novos(page)).toBe(antes);
      expect(await situacaoNoBanco()).toBe("novo");
      expect(chamada, "a tela chamou a ação do servidor").not.toBeNull();
    });

    test("390 px: a linha e os botões cabem na tela", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/admin/parceiros#interessados", { waitUntil: "domcontentloaded" });
      const linha = page.locator(`[data-testid="interesse-parceria"][data-id="${id}"]`);
      await expect(linha.getByTestId("interesse-para-contatado")).toBeVisible({ timeout: 20_000 });
      const caixa = await linha.getByTestId("interesse-para-arquivado").boundingBox();
      expect(caixa && caixa.x + caixa.width).toBeLessThanOrEqual(390);
      await page.screenshot({ path: "tests/laboratorio/saida/t630-390.png", fullPage: false });
    });
  });

  test.describe("quem não é admin", () => {
    test.use({ storageState: authFile("proprietario") });

    test("2. proprietário não vê a lista e a mesma chamada da ação não muda nada", async ({ page }) => {
      await page.goto("/admin/parceiros", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("interesses-parceria")).toHaveCount(0);
      expect(chamada, "o caso 1 capturou a chamada da ação").not.toBeNull();
      const r = await page.request.post(chamada!.url, {
        headers: { "next-action": chamada!.acao, "content-type": chamada!.tipo, accept: "text/x-component" },
        data: JSON.stringify([id, "contatado"]),
        maxRedirects: 0,
      });
      expect(await r.text()).not.toMatch(/"ok":true/);
      expect(await situacaoNoBanco()).toBe("novo");
    });
  });
});
