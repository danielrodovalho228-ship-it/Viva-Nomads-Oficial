import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { TITULO_PASSO, noPasso, type PassoCadastro } from "../fixtures/cadastro";
import { prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T525 — E161 (#1376), guarda permanente da Pista C: a t474 mede o assistente VAZIO. Aqui, um rascunho cheio (8 fotos,
  título longo, descrição com uma palavra de 70 letras sem espaço, preço e período) aberto em cada um dos 10 passos:
   1. 1280 px: a área do assistente tem a largura do conteúdo da página do imóvel em todos os passos;
   2. 390 px: nenhum passo estoura na horizontal.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t525.${sufixo}@lab.vivanomads.test`, nome: "Rita Rascunho", role: "owner" as const };
const ids: Record<string, string> = {};
const PASSOS = Object.keys(TITULO_PASSO) as PassoCadastro[];
const PALAVRA = "Supercalifragilisticoexpialidociosamenteespacosoeiluminadoapartamentox";
const TITULO = `Apartamento amplo e iluminado perto da UFU com varanda gourmet ${sufixo}`;

test.describe("T525 — E161: rascunho cheio na largura do anúncio e íntegro no celular", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.ref = await criarImovelPronto(ids.dono, `Régua t525 ${sufixo}`, { ativo: true });
    ids.rascunho = await prepararRascunho(ids.dono, TITULO, {
      description: `Um apartamento ${PALAVRA} com sala ampla, dois quartos e varanda. `.repeat(4),
      monthlyPrice: "3600",
      condoFee: "350",
      minPeriod: "3",
    });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("1. a 1280 px: os 10 passos do rascunho cheio na largura do conteúdo do imóvel", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto(`/imoveis/${ids.ref}`, { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("imovel-largura-total")).toBeVisible({ timeout: 30_000 });
    const imovel = await p.getByTestId("imovel-largura-total").first().evaluate((e) => Math.round(e.getBoundingClientRect().width));
    for (const passo of PASSOS) {
      await p.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=${passo}`, { waitUntil: "domcontentloaded" });
      await noPasso(p, passo, 30_000);
      const assistente = await p.getByTestId("assistente-largura").first().evaluate((e) => Math.round(e.getBoundingClientRect().width));
      expect(Math.abs(assistente - imovel), `${passo}: assistente ${assistente} × imóvel ${imovel}`).toBeLessThanOrEqual(1);
      expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), passo).toBeLessThanOrEqual(1);
    }
    await p.screenshot({ path: `${SAIDA}/t525-revisao-1280.png`, fullPage: true });
    await p.context().close();
  });

  test("2. a 390 px: os 10 passos do rascunho cheio sem estouro horizontal", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    for (const passo of PASSOS) {
      await p.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=${passo}`, { waitUntil: "domcontentloaded" });
      await noPasso(p, passo, 30_000);
      await p.waitForTimeout(300);
      const sobra = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (sobra > 1) await p.screenshot({ path: `${SAIDA}/t525-estouro-${passo}-390.png`, fullPage: true });
      expect(sobra, `${passo}: estouro horizontal de ${sobra}px`).toBeLessThanOrEqual(1);
    }
    await p.screenshot({ path: `${SAIDA}/t525-revisao-390.png`, fullPage: true });
    await p.context().close();
  });
});
