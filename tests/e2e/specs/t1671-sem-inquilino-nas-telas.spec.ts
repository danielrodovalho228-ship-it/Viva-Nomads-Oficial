import { test, expect, type Page } from "@playwright/test";
import { comPrecos } from "../fixtures/precos";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1671 — Ordem a8c05cd0 (conta única), item 8(c), parte 1 (faixa A): nenhuma tela pública nem do painel mostra a
  palavra "inquilino" nem um seletor de modo Inquilino/Proprietário, a 360, 390 e 1280 px.
   1. Sem login: home, busca, como funciona, para proprietários, empresas, preços e cidades.
   2. llms.txt e llms-full.txt (texto público lido por buscadores de IA).
   3. No laboratório: dono com 1 anúncio publicado — Início, Meus imóveis, Mensagens e Pedidos de moradia.
  Fora desta parte: telas de contrato, fechamento, documento do morador, manutenção e atendimento (faixa B), /termos e
  /privacidade (exceção da ordem, texto da Dra. Beatriz) e o admin interno.
*/
const PALAVRA = /\binquilin[oa]s?\b/i;
const PUBLICAS = ["/", "/buscar", "/como-funciona", "/para-proprietarios", "/empresas", ...comPrecos("/precos"), "/cidades"];
const LARGURAS = [360, 390, 1280];

async function semInquilino(page: Page, rota: string) {
  const r = await page.goto(rota, { waitUntil: "domcontentloaded" });
  expect(r?.status() ?? 0, rota).toBeLessThan(500);
  await page.locator("main").first().waitFor();
  const texto = await page.locator("body").innerText();
  const trecho = texto.match(new RegExp(`.{0,40}${PALAVRA.source}.{0,40}`, "i"))?.[0];
  expect(trecho, `${rota}: "${trecho}"`).toBeUndefined();
  // Seletor de modo (a chave do cabeçalho que a ordem tirou): nenhum botão/aba chamado só "Inquilino".
  await expect(page.getByRole("button", { name: /^\s*inquilino\s*$/i })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /^\s*inquilino\s*$/i })).toHaveCount(0);
}

test.describe("T1671 — sem 'inquilino' nas telas (a8c05cd0 item 8c)", () => {
  for (const largura of LARGURAS) {
    test(`${largura}px: telas públicas sem 'inquilino' e sem seletor de modo`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      for (const rota of PUBLICAS) await semInquilino(page, rota);
    });
  }

  test("llms.txt e llms-full.txt sem 'inquilino'", async ({ request }) => {
    for (const rota of ["/llms.txt", "/llms-full.txt"]) {
      const r = await request.get(rota);
      expect(r.status(), rota).toBe(200);
      expect(await r.text(), rota).not.toMatch(PALAVRA);
    }
  });
});

test.describe("T1671 — painel do dono sem 'inquilino' (a8c05cd0 item 8c)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const ids: Record<string, string | undefined> = {};
  const dono = { email: `dono.t1671.${sufixo}@lab.vivanomads.test`, nome: "Dalva Palavras Sobrenome", role: "owner" as const };

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio palavras ${sufixo}`, { ativo: true });
  });

  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of LARGURAS) {
    test(`${largura}px: Início, Meus imóveis, Mensagens e Pedidos de moradia`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: largura, height: 900 });
      for (const rota of ["/dashboard", "/dashboard/imoveis", "/dashboard/mensagens", "/dashboard/pedidos-cidade"]) await semInquilino(page, rota);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.context().close();
    });
  }
});
