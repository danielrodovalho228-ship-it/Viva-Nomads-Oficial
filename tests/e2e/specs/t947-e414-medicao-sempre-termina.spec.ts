import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T947 — E414 (#2039): a medição da internet sempre termina — com resultado ou com aviso. Antes, sem o estado da
 * medição (sessão, imóvel, rede) o bloco não aparecia e o "Meça agora" abria um espaço vazio. Pela tela real
 * (edição do imóvel → Comodidades), 390 e 1280:
 *   1. leitura boa: o bloco "medir-internet" aparece e nenhum aviso de indisponível;
 *   2. /api/internet/medicoes falha (500 com HTML), responde sem o formato ({}), ou recusa com o motivo
 *      ({ ok: false, erro }): aparece o aviso (role=alert) com "Não deu para carregar agora." — ou o motivo do servidor —
 *      e nunca um espaço vazio; nada de rolagem lateral.
 * A rodada que passa do prazo (60 s, "A medição demorou demais e parou…") fica com o teste de unidade do #2039
 * (internet-motor-e414.test.ts): no laboratório o motor é simulado e responde na hora.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t947.${sufixo}@lab.vivanomads.test`, nome: "Ivo Internet", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};
const LARGURAS = [390, 1280] as const;
const API = "**/api/internet/medicoes**";

async function abrirComodidades(page: Page) {
  await page.goto(`/dashboard/imoveis/${ids.imovel}/editar`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Comodidades/ }).click({ timeout: 30_000 });
}
async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

test.describe("T947 — E414: a medição da internet sempre termina com resultado ou aviso", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio Wi-Fi t947 ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  test("leitura boa mostra o bloco; leitura que falha mostra o motivo, nunca um espaço vazio (390 e 1280)", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    for (const largura of LARGURAS) {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });

      await page.unroute(API);
      await abrirComodidades(page);
      await expect(page.getByTestId("medir-internet")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("medir-internet-indisponivel")).toHaveCount(0);

      const casos: { nome: string; resposta: { status: number; body: string; contentType?: string }; texto: string }[] = [
        { nome: "500 com HTML", resposta: { status: 500, body: "<html>erro</html>", contentType: "text/html" }, texto: "Não deu para carregar agora." },
        { nome: "200 sem o formato", resposta: { status: 200, body: "{}", contentType: "application/json" }, texto: "Não deu para carregar agora." },
        { nome: "recusa com motivo", resposta: { status: 200, body: JSON.stringify({ ok: false, erro: "Entre com a conta do proprietário para medir." }), contentType: "application/json" }, texto: "Entre com a conta do proprietário para medir." },
      ];
      for (const c of casos) {
        await page.unroute(API);
        await page.route(API, (r) => r.fulfill(c.resposta));
        await abrirComodidades(page);
        const aviso = page.getByTestId("medir-internet-indisponivel");
        await expect(aviso, `${c.nome} @${largura}`).toHaveText(c.texto, { timeout: 20_000 });
        await expect(aviso).toHaveAttribute("role", "alert");
        await expect(page.getByTestId("medir-internet")).toHaveCount(0);
        await semRolagemLateral(page);
      }
      await page.unroute(API);
    }
    await page.context().close();
  });
});
