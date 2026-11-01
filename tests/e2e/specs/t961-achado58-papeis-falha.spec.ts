import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T961 — #2079 (varredura de erros, rodada 8, achado 58): getMinhaIntencao engolia o erro; em Conta › Papéis a falha
 * virava "nada marcado" e um toque gravava só a opção escolhida por cima das outras. Agora "as telas avisam e não
 * gravam". Pela tela real (/dashboard/conta/papeis), 390 e 1280, conta com "morar" e "anunciar" gravados:
 *   1. as ações do servidor da tela falham (resposta 500 — o efeito do "throw" novo): aparece "Não foi possível
 *      carregar suas escolhas agora. Recarregue a página para tentar de novo." e nenhum interruptor; o banco não muda;
 *   2. recarregada com o servidor de volta: os interruptores mostram o que está gravado ("Quero morar" ligado).
 * Os achados 59 (perfil público do proprietário) e 60 (Emitidos do admin) são lidos no servidor: ficam com o teste de
 * unidade do #2079 (achado58-60-leituras.test.ts).
 * L-89 (aberto): hoje o aviso não aparece (a tela fica no esqueleto de carregando) — o caso do aviso está em test.fail;
 * o "nada gravado" é teste normal.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = { email: `papeis.t961.${sufixo}@lab.vivanomads.test`, nome: "Paulo Papéis", role: "tenant" as const };
const ids: { conta?: string } = {};
const ROTA = "**/dashboard/conta/papeis**";
const AVISO = "Não foi possível carregar suas escolhas agora. Recarregue a página para tentar de novo.";

async function acoesFalham(page: Page, liga: boolean) {
  if (!liga) return page.unroute(ROTA);
  await page.route(ROTA, (r) =>
    r.request().method() === "POST" && r.request().headers()["next-action"] ? r.fulfill({ status: 500, body: "falha simulada (t961)" }) : r.continue(),
  );
}
async function intencaoGravada(): Promise<string[]> {
  const { data } = await adm().from("profiles").select("intencao").eq("id", ids.conta!).single();
  return (((data as { intencao?: string[] | null } | null)?.intencao ?? []) as string[]).slice().sort();
}

test.describe("T961 — #2079 achado 58: Conta › Papéis avisa a falha de leitura e não grava", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.conta = await criarConta(conta, senha);
    const { error } = await adm().from("profiles").update({ intencao: ["morar", "anunciar"] }).eq("id", ids.conta);
    if (error) throw error;
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.conta]);
  });

  test("falha → nada gravado e sem interruptores (390 e 1280)", async ({ browser }) => {
    const page = await entrar(browser, conta.email, senha);
    const antes = await intencaoGravada();
    for (const largura of [390, 1280] as const) {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await acoesFalham(page, true);
      await page.goto("/dashboard/conta/papeis", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await expect(page.getByTestId("papel-morar-toggle")).toHaveCount(0);
      expect(await intencaoGravada(), "nada gravado por cima").toEqual(antes);
      await acoesFalham(page, false);
    }
    await page.context().close();
  });

  test("falha → aviso, sem interruptores e sem gravar; servidor de volta → o que está gravado (390 e 1280)", async ({ browser }) => {
    // L-89 (registro-defeitos.md): com a leitura falhando, TelaPapeis fica em "tela-papeis-carregando" (o esqueleto) para
    // sempre — o aviso "erro_leitura" só existe no retorno normal, que não é desenhado com intencao null (lab do #2088,
    // run 41354491344, nas 2 tentativas). Nada é gravado (o caso acima é teste normal). Quem corrigir tira este test.fail.
    test.fail(true, "L-89: Conta › Papéis não mostra o aviso da falha de leitura (fica no esqueleto de carregando)");
    const page = await entrar(browser, conta.email, senha);
    const antes = await intencaoGravada();
    for (const largura of [390, 1280] as const) {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await acoesFalham(page, true);
      await page.goto("/dashboard/conta/papeis", { waitUntil: "domcontentloaded" });
      await expect(page.getByText(AVISO), `aviso da falha @${largura}`).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("papel-morar-toggle")).toHaveCount(0);
      expect(await intencaoGravada(), "nada gravado por cima").toEqual(antes);

      await acoesFalham(page, false);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("papel-morar-toggle")).toHaveAttribute("aria-checked", "true", { timeout: 30_000 });
      await expect(page.getByText(AVISO)).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    }
    expect(await intencaoGravada()).toEqual(antes);
    await page.context().close();
  });
});
