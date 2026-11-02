import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T983 — #2159, varredura de erros rodada 18, achado 91: em Conta › Meus dados, a verificação do celular de quem JÁ É
 * verificado não volta para o formulário quando a leitura falha. Antes, getTelefoneEstado() engolia o erro e dizia
 * "não verificado": o formulário voltava, e pedir o código de novo zerava o selo de verdade. Agora a ação lança e a
 * tela esconde o bloco. 390 e 1280:
 *   1. controle: sem falha, o bloco mostra "Telefone verificado" (a massa é real: celular confirmado no Auth +
 *      telefone_verificacao.verificado_em);
 *   2. com a resposta de getTelefoneEstado() trocada por 500 (só ela: a resposta com "simulado" e "pendente"), a página
 *      abre, o bloco do celular não aparece, nada oferece "Enviar código", e o selo segue gravado no banco.
 * Os achados 89 e 90 (rodada 18), 92–94 (rodada 19, #2160) e os strikes do laudo (#2156) são leituras dentro do
 * servidor (renderização ou o meio de uma ação): o navegador não simula essa falha; ficam com os testes de unidade.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const t = String(Date.now());
const FONE = `55349${t.slice(-8)}`;
const conta = { email: `fone.t983.${sufixo}@lab.vivanomads.test`, nome: "Fábio Fone Sobrenome", role: "tenant" as const };
const ids: { conta?: string } = {};

async function abrir(browser: Browser, largura: number): Promise<Page> {
  const page = await entrar(browser, conta.email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  return page;
}

/** Troca por 500 só a resposta da ação do servidor com o estado do celular; as outras passam. */
async function falharLeitura(page: Page, vistas: string[]) {
  await page.route("**/dashboard/conta/dados**", async (r) => {
    if (r.request().method() !== "POST" || !r.request().headers()["next-action"]) return r.continue().catch(() => {});
    try {
      const resp = await r.fetch();
      const corpo = await resp.text();
      if (corpo.includes('"simulado"') && corpo.includes('"pendente"')) {
        vistas.push("falhou");
        return await r.fulfill({ status: 500, body: "falha simulada (t983)" });
      }
      return await r.fulfill({ response: resp, body: corpo });
    } catch {
      /* a página navegou ou a rota já foi resolvida */
    }
  });
}

test.describe("T983 — #2159 achado 91: falha na leitura do celular não desfaz o 'verificado'", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (modo simulado do SMS).");
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    ids.conta = await criarConta(conta, senha);
    const { error: e1 } = await adm().auth.admin.updateUserById(ids.conta, { phone: FONE, phone_confirm: true });
    if (e1) throw e1;
    const { error: e2 } = await adm().from("telefone_verificacao").upsert({ user_id: ids.conta, verificado_em: new Date().toISOString(), pedido_em: null });
    if (e2) throw e2;
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.conta]);
  });

  for (const w of [390, 1280] as const) {
    test(`controle: o bloco mostra "Telefone verificado" (${w})`, async ({ browser }) => {
      const page = await abrir(browser, w);
      await page.goto("/dashboard/conta/dados", { waitUntil: "domcontentloaded" });
      const painel = page.getByTestId("confianca-telefone");
      await expect(painel).toBeVisible({ timeout: 30_000 });
      await expect(painel.getByTestId("telefone-verificado")).toBeVisible();
      await page.context().close();
    });

    test(`leitura que falha: sem o bloco, sem "Enviar código", selo intacto (${w})`, async ({ browser }) => {
      const page = await abrir(browser, w);
      const vistas: string[] = [];
      await falharLeitura(page, vistas);
      await page.goto("/dashboard/conta/dados", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Meus dados" }).first()).toBeVisible({ timeout: 30_000 });
      await expect.poll(() => vistas.length, { timeout: 30_000, message: "a leitura do celular precisa ter sido interceptada" }).toBeGreaterThan(0);
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await expect(page.getByTestId("confianca-telefone")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Enviar código" })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.unrouteAll({ behavior: "wait" });
      await page.context().close();
      const { data } = await adm().from("telefone_verificacao").select("verificado_em").eq("user_id", ids.conta!).maybeSingle();
      expect(data?.verificado_em, "o selo continua gravado").toBeTruthy();
    });
  }
});
