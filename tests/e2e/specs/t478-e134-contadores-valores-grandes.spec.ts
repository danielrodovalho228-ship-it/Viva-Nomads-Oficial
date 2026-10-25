import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";

/*
  T478 — E134 (#1375), guarda permanente da Pista C: os contadores do Passo 4 numa ÚNICA coluna também com os números
  preenchidos e grandes (a t469 confere o passo vazio). Quartos 12, Banheiros 10, Área 1250 m², Pessoas 16, Vagas 10:
  as 5 caixas com a mesma borda direita, a mesma largura e a mesma altura; o número inteiro cabe na caixa; sem rolagem
  lateral. A 390 e 1280 px.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t478.${sufixo}@lab.vivanomads.test`, nome: "Dino Contador", role: "owner" as const };
const ids: Record<string, string> = {};
const VALORES: [string, string][] = [
  ["cadastro-quartos", "12"],
  ["cadastro-banheiros", "10"],
  ["cadastro-area", "1250"],
  ["cadastro-capacidade", "16"],
  ["cadastro-vagas", "10"],
];

async function caixas(p: Page) {
  return p
    .getByTestId("cartao-numeros")
    .getByTestId("contador")
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) })));
}

test.describe("T478 — E134: contadores numa coluna com valores grandes", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: 12 / 10 / 1250 m² / 16 / 10 na mesma coluna`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto("/dashboard/imoveis/novo?etapa=detalhes", { waitUntil: "domcontentloaded" });
      await noPasso(p, "detalhes", 30_000);
      await expect(p.getByTestId("cartao-numeros").getByTestId("contador")).toHaveCount(5);
      for (const [id, v] of VALORES) await p.getByTestId(id).fill(v);
      for (const [id, v] of VALORES) await expect(p.getByTestId(id), id).toHaveValue(v);

      const c = await caixas(p);
      expect(new Set(c.map((x) => x.x)).size, `mesma borda direita: ${JSON.stringify(c)}`).toBe(1);
      expect(new Set(c.map((x) => x.w)).size, `mesma largura: ${JSON.stringify(c)}`).toBe(1);
      expect(new Set(c.map((x) => x.h)).size, `mesma altura: ${JSON.stringify(c)}`).toBe(1);
      // O número digitado cabe no campo (nada cortado).
      for (const [id] of VALORES) {
        const corta = await p.getByTestId(id).evaluate((e) => (e as HTMLInputElement).scrollWidth > (e as HTMLInputElement).clientWidth + 1);
        expect(corta, `${id}: número cortado`).toBe(false);
      }
      expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await p.getByTestId("cartao-numeros").scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t478-contadores-${w}.png`, fullPage: true });
      await p.context().close();
    });
  }
});
