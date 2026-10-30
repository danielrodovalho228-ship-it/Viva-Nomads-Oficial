import { test, expect, type Page, type Request } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T674 — E255: "Você entra na regra nova?" em Ganhos (chave ENQUADRAMENTO_REFORMA; no laboratório, o cookie
  vn_lab_reforma liga só neste navegador). 1280 e 390, com prints.
   1. Chave desligada: nem o aviso nem a ferramenta aparecem.
   2. Ligada: o aviso só nos limiares (3 imóveis ou mais na Viva); quem tem 1 imóvel vê a ferramenta, sem aviso.
   3. Os campos "fora da Viva" nunca saem do navegador (nenhuma requisição leva os números digitados); o resultado
      muda na hora; nenhum percentual na tela.
  Rodadas fora do lab completo (teto L-5): 30/10, sobre a main com #1553–#1556, no lab-crítico do #1558 (bloco 67).
*/
const SAIDA = "tests/laboratorio/saida";

async function ligar(p: Page) {
  await p.context().addCookies([{ name: "vn_lab_reforma", value: "1", url: new URL(p.url()).origin }]);
}

test.describe("T674 — E255: enquadramento da reforma em Ganhos", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });
  const senha = novaSenha();
  const sufixo = novoSufixo();
  const grande = { email: `dono.t674a.${sufixo}@lab.vivanomads.test`, nome: "Iara Carteira", role: "owner" as const };
  const pequeno = { email: `dono.t674b.${sufixo}@lab.vivanomads.test`, nome: "Otto Um", role: "owner" as const };
  const ids: string[] = [];

  test.beforeAll(async () => {
    const a = await criarConta(grande, senha);
    const b = await criarConta(pequeno, senha);
    ids.push(a, b);
    for (let i = 0; i < 3; i++) await criarImovelPronto(a, `Apartamento ${i + 1} ${sufixo}`, { ativo: true });
    await criarImovelPronto(b, `Studio Único ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  test("1. chave desligada: nada aparece", async ({ browser }) => {
    const p = await entrar(browser, grande.email, senha);
    await p.goto("/dashboard/ganhos", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("ganhos")).toBeVisible({ timeout: 30_000 });
    await expect(p.getByTestId("aviso-reforma")).toHaveCount(0);
    await expect(p.getByTestId("enquadramento-reforma")).toHaveCount(0);
    await p.context().close();
  });

  test("2. ligada: aviso só nos limiares (3 imóveis); o dono de 1 imóvel vê só a ferramenta", async ({ browser }) => {
    for (const w of [1280, 390]) {
      const p = await entrar(browser, grande.email, senha);
      await p.setViewportSize({ width: w, height: w === 1280 ? 900 : 844 });
      await ligar(p);
      await p.goto("/dashboard/ganhos", { waitUntil: "domcontentloaded" });
      const aviso = p.getByTestId("aviso-reforma");
      await expect(aviso).toContainText("A reforma tributária muda as regras para quem tem mais de 3 imóveis alugados. Confira se você entra.", { timeout: 30_000 });
      await expect(aviso).toHaveAttribute("href", "/dashboard/ganhos#enquadramento-reforma");
      await expect(p.getByTestId("enquadramento-reforma")).toBeVisible();
      await p.screenshot({ path: `${SAIDA}/t674-aviso-${w}.png` });
      await p.context().close();
    }
    const p = await entrar(browser, pequeno.email, senha);
    await ligar(p);
    await p.goto("/dashboard/ganhos", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("enquadramento-reforma")).toBeVisible({ timeout: 30_000 });
    await expect(p.getByTestId("aviso-reforma")).toHaveCount(0);
    await p.context().close();
  });

  test("3. fora da Viva fica no navegador; o resultado muda na hora; nenhum percentual", async ({ browser }) => {
    for (const w of [1280, 390]) {
      const p = await entrar(browser, pequeno.email, senha);
      await p.setViewportSize({ width: w, height: w === 1280 ? 900 : 844 });
      await ligar(p);
      await p.goto("/dashboard/ganhos", { waitUntil: "networkidle" });
      const sec = p.getByTestId("enquadramento-reforma");
      await expect(sec).toBeVisible({ timeout: 30_000 });
      const resultado = p.getByTestId("enquadramento-resultado");
      await expect(resultado).toHaveAttribute("data-criterios", "nao");
      // A partir daqui, toda requisição é guardada e conferida.
      const vistas: Request[] = [];
      p.on("request", (r) => vistas.push(r));
      await p.getByTestId("enq-outros-imoveis").fill("7");
      await p.getByTestId("enq-outra-receita").fill("987654");
      await expect(resultado).toHaveAttribute("data-criterios", "passa");
      await expect(resultado).toHaveAttribute("data-gatilho", "passa");
      await expect(p.getByTestId("enq-linha-criterios")).toHaveText("Pelos números informados, você passa dos dois critérios (mais de 3 imóveis E mais de R$ 240 mil).");
      await expect(p.getByTestId("enq-nao-e-orientacao")).toHaveText("Isso não é orientação tributária. Fale com seu contador.");
      await p.waitForTimeout(1500);
      for (const r of vistas) {
        const corpo = `${r.url()} ${r.postData() ?? ""}`;
        expect(corpo, r.url()).not.toMatch(/987\.?654/);
      }
      expect(await sec.innerText()).not.toMatch(/%|al[íi]quota|redutor|holding|confisco/i);
      await sec.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t674-ferramenta-${w}.png`, fullPage: w === 390 });
      expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await p.context().close();
    }
  });
});
