import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T238 — Pacote de provas e linha do tempo do contrato (ordem 283d8001). Laboratório, contas de teste, 390 e 1280 px.
   1. Contrato assinado: as duas partes veem "Sua estadia" (linha do tempo) e o botão "Baixar pacote de provas (PDF)".
   2. A rota /api/contrato/[id]/provas devolve um PDF (application/pdf, começa com %PDF, sem cache) às duas partes.
   3. Quem não é parte recebe 404, e quem não entrou recebe 401: nenhum dado do contrato vaza.
   4. Contrato sem nenhuma assinatura não oferece o botão.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t238.${sufixo}@lab.vivanomads.test`, nome: "Olga Provas Sobrenome", role: "owner" as const };
const inq = { email: `inq.t238.${sufixo}@lab.vivanomads.test`, nome: "Iris Provas Sobrenome", role: "tenant" as const };
const fora = { email: `fora.t238.${sufixo}@lab.vivanomads.test`, nome: "Raul Provas Sobrenome", role: "tenant" as const };
const ids: Record<string, string> = {};
const t = "2026-10-01T12:00:00Z";
const dia = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

async function contrato(imovel: string, assinado: boolean, inicio: string, fim: string): Promise<string> {
  const { data: c, error } = await adm()
    .from("contratos")
    .insert({
      property_id: imovel,
      tenant_id: ids.inq,
      owner_plan: "essential",
      faixa: "media_estadia",
      prazo_total_dias: 60,
      aluguel_mensal: 3200,
      tamanho_bloco_meses: 2,
      comissao_percent: 0.12,
      comissao_valor: 768,
      qtd_ocupantes: 1,
      garantia: "caucao",
      status: "ativo",
      assinado_proprietario_em: assinado ? t : null,
      assinado_inquilino_em: assinado ? t : null,
    })
    .select("id")
    .single();
  if (error) throw error;
  const { error: eB } = await adm().from("contrato_blocos").insert({ contrato_id: c!.id, numero_bloco: 1, inicio, fim, meses: 2, valor: 6400, caucao: 3200, status: "ativo" });
  if (eB) throw eB;
  return c!.id as string;
}

async function abrir(browser: Browser, email: string, largura: number): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  return page;
}
async function ir(page: Page, rota: string) {
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  await page.locator("main").first().waitFor();
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}
async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

test.describe("T238 — pacote de provas e linha do tempo do contrato", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha, true);
    ids.inq = await criarConta(inq, senha, true);
    ids.fora = await criarConta(fora, senha, true);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq, ids.fora]);
    ids.imAssinado = await criarImovelPronto(ids.dono, `Provas assinado ${sufixo}`, { ativo: true, preco: 3200 });
    ids.imSemAssinatura = await criarImovelPronto(ids.dono, `Provas sem assinatura ${sufixo}`, { ativo: true, preco: 3200 });
    ids.assinado = await contrato(ids.imAssinado, true, dia(3), dia(62));
    ids.semAssinatura = await contrato(ids.imSemAssinatura, false, dia(3), dia(62));
  });

  test.afterAll(async () => {
    const cids = [ids.assinado, ids.semAssinatura].filter(Boolean);
    if (cids.length) {
      await adm().from("pagamentos_bloco").delete().in("contrato_id", cids);
      await adm().from("contrato_blocos").delete().in("contrato_id", cids);
      await adm().from("contratos").delete().in("id", cids);
    }
    await apagarContas([ids.inq, ids.fora, ids.dono]);
  });

  for (const largura of [1280, 390]) {
    test(`1. ${largura} — as duas partes veem a linha do tempo e o botão do pacote, sem rolagem lateral`, async ({ browser }) => {
      for (const [quem, email, rota] of [
        ["dono", dono.email, `/dashboard/contratos/${ids.assinado}`],
        ["inquilino", inq.email, `/dashboard/locacoes/${ids.assinado}`],
      ] as const) {
        const p = await abrir(browser, email, largura);
        await ir(p, rota);
        await expect(p.getByTestId("estadia-linha-tempo"), quem).toBeVisible({ timeout: 20_000 });
        const botao = p.getByTestId("baixar-provas");
        await expect(botao, quem).toBeVisible();
        await expect(botao).toHaveAttribute("href", `/api/contrato/${ids.assinado}/provas`);
        expect((await botao.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await semRolagemLateral(p);
        await p.screenshot({ path: `${SAIDA}/t238-${quem}-${largura}.png`, fullPage: true });
        await p.context().close();
      }
    });
  }

  test("2. a rota devolve um PDF às duas partes, sem cache", async ({ browser }) => {
    for (const email of [dono.email, inq.email]) {
      const p = await abrir(browser, email, 1280);
      const r = await p.request.get(`/api/contrato/${ids.assinado}/provas`);
      expect(r.status(), email).toBe(200);
      expect(r.headers()["content-type"]).toContain("application/pdf");
      expect(r.headers()["cache-control"]).toContain("no-store");
      expect(r.headers()["content-disposition"]).toContain("attachment");
      expect((await r.body()).subarray(0, 4).toString()).toBe("%PDF");
      await p.context().close();
    }
  });

  test("3. quem não é parte recebe 404 e quem não entrou recebe 401", async ({ browser, request }) => {
    const p = await abrir(browser, fora.email, 1280);
    const r = await p.request.get(`/api/contrato/${ids.assinado}/provas`);
    expect(r.status()).toBe(404);
    expect((await r.body()).subarray(0, 4).toString()).not.toBe("%PDF");
    await p.context().close();
    const anonimo = await request.get(`/api/contrato/${ids.assinado}/provas`);
    expect(anonimo.status()).toBe(401);
  });

  test("4. contrato sem nenhuma assinatura não oferece o botão", async ({ browser }) => {
    const p = await abrir(browser, dono.email, 390);
    await ir(p, `/dashboard/contratos/${ids.semAssinatura}`);
    await expect(p.getByTestId("estadia-linha-tempo")).toBeVisible({ timeout: 20_000 });
    await expect(p.getByTestId("baixar-provas")).toHaveCount(0);
    await p.context().close();
  });
});
