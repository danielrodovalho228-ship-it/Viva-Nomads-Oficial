import { test, expect, type Locator, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1104 — E556 (#2481, 04/11): em Meus imóveis, a completude do RASCUNHO lê a internet e a privacidade do draft_data,
 * com a mesma regra do editor. Antes, a lista lia só as colunas internet_mbps / sem_cameras_interior (gravadas ao
 * publicar) e mostrava "Velocidade da internet" e "Declaração de privacidade" como falta para o que o dono já salvou
 * (o rascunho 4a693a63: 75% na lista × 90% no editor). Pela tela real, 390 e 1280, um rascunho com as duas COLUNAS
 * vazias (internet_mbps nulo, sem_cameras_interior falso) e só o draft_data mudando:
 *   1. draft_data com a velocidade em branco e a declaração não feita: as duas pendências aparecem (pendencia-internet,
 *      pendencia-privacidade) — o que o editor também mostra;
 *   2. draft_data com 300 Mbps e "sem câmeras dentro" = sim: as duas pendências somem e o "Anúncio N% completo" sobe,
 *      com as colunas do banco ainda vazias (a lista leu o draft_data);
 *   3. draft_data sem as duas chaves (rascunho antigo): vale o banco — as pendências voltam, nunca vira "ok" inventado.
 * As regras ficam com o e556-fatos-do-rascunho.test.ts.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1104.${sufixo}@lab.vivanomads.test`, nome: "Rita Completude Lima", role: "owner" as const };
const TITULO = `Casa do rascunho E556 ${sufixo}`;
const ids: Record<string, string> = {};

async function gravarRascunho(draft: Record<string, unknown>): Promise<void> {
  const { error } = await adm().from("properties").update({ draft_data: { title: TITULO, ...draft } }).eq("id", ids.rascunho);
  expect(error, error?.message).toBeNull();
}

async function cartao(p: Page): Promise<Locator> {
  await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
  const c = p.getByTestId("meu-anuncio").filter({ hasText: TITULO });
  await expect(c.getByTestId("prontidao")).toBeVisible({ timeout: 30_000 });
  return c;
}

async function pct(c: Locator): Promise<number> {
  const t = (await c.getByTestId("prontidao").innerText()).replace(/\s+/g, " ");
  if (/100% · Pronto para publicar/.test(t)) return 100;
  const m = t.match(/Anúncio (\d+)% completo/);
  expect(m, `"Anúncio N% completo" no cartão: ${t}`).not.toBeNull();
  return Number(m![1]);
}

test.describe("T1104 — E556: Meus imóveis lê a internet e a privacidade do rascunho (draft_data)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    // Rascunho com as duas colunas vazias: o que conta é só o draft_data.
    ids.rascunho = await criarImovelPronto(ids.dono, TITULO, { semInternet: true, semDeclaracaoCameras: true });
    const { data } = await adm().from("properties").select("status, internet_mbps, sem_cameras_interior").eq("id", ids.rascunho).single();
    expect(data).toMatchObject({ status: "draft", internet_mbps: null, sem_cameras_interior: false });
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`a lista segue o draft_data: falta → feito → rascunho antigo volta ao banco (${w})`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      try {
        // 1. Velocidade em branco e declaração não feita no draft_data: as duas pendências.
        await gravarRascunho({ internetMbps: "", privacidade: { semCamerasInterior: false } });
        let c = await cartao(p);
        await expect(c.getByTestId("pendencia-internet")).toBeVisible();
        await expect(c.getByTestId("pendencia-privacidade")).toBeVisible();
        const antes = await pct(c);

        // 2. 300 Mbps e "sem câmeras dentro" salvos no draft_data: as duas somem e o número sobe.
        await gravarRascunho({ internetMbps: "300", privacidade: { semCamerasInterior: true } });
        c = await cartao(p);
        await expect(c.getByTestId("pendencia-internet")).toHaveCount(0);
        await expect(c.getByTestId("pendencia-privacidade")).toHaveCount(0);
        const depois = await pct(c);
        expect(depois, `o número sobe com os dois itens (${antes}% → ${depois}%)`).toBeGreaterThan(antes);
        const { data } = await adm().from("properties").select("internet_mbps, sem_cameras_interior").eq("id", ids.rascunho).single();
        expect(data, "as colunas seguem vazias: foi o draft_data que contou").toMatchObject({ internet_mbps: null, sem_cameras_interior: false });

        // 3. Rascunho antigo (sem as chaves): vale o banco, as pendências voltam.
        await gravarRascunho({});
        c = await cartao(p);
        await expect(c.getByTestId("pendencia-internet")).toBeVisible();
        await expect(c.getByTestId("pendencia-privacidade")).toBeVisible();
        expect(await pct(c)).toBe(antes);
        test.info().annotations.push({ type: "numeros", description: `falta ${antes}% · feito ${depois}%` });

        const sobra = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(sobra).toBeLessThanOrEqual(1);
      } finally {
        await p.context().close();
      }
    });
  }
});
