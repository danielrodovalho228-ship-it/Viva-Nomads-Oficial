import { test, expect } from "@playwright/test";
import {
  NO_LABORATORIO,
  apagarContas,
  contarAtivos,
  criarConta,
  criarImovelPronto,
  definirPlano,
  entrar,
  novaSenha,
  novoSufixo,
  publicarPeloEditor,
  statusDoImovel,
} from "../fixtures/laboratorio";

/**
 * T35 — TROCA DE PLANO COM IMÓVEL JÁ CADASTRADO (laboratório). Conta NOVA de dono com 7 imóveis prontos: 5
 * publicados e 2 rascunhos. E233-A: o plano (histórico) não limita mais quantos anúncios ficam no ar.
 *  1. Essencial com 5 no ar (o antigo "lotado"): o 6º publica, sem "Vaga no seu plano".
 *  2. Descer para Gratuito (sem assinatura) com 6 no ar: NADA some e nada quebra — a lista e o editor abrem — e o
 *     7º também publica.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.troca.${sufixo}@lab.vivanomads.test`, nome: "Tereza Troca de Plano", role: "owner" as const };
const titulo = (i: number) => `Studio ${i} do teste de troca de plano ${sufixo}`;
const ids: { dono?: string; no_ar: string[]; sexto?: string; setimo?: string } = { no_ar: [] };

test.describe("T35 — Troca de plano com imóvel cadastrado", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await definirPlano(ids.dono, "essential");
    for (let i = 1; i <= 5; i++) ids.no_ar.push(await criarImovelPronto(ids.dono, titulo(i), { ativo: true }));
    ids.sexto = await criarImovelPronto(ids.dono, titulo(6));
    ids.setimo = await criarImovelPronto(ids.dono, titulo(7));
  });

  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("Essencial com 5 no ar: o 6º publica, sem vaga no plano", async ({ browser }) => {
    test.setTimeout(120_000);
    expect(await contarAtivos(ids.dono!)).toBe(5);
    const page = await entrar(browser, dono.email, senha);
    await page.goto(`/dashboard/imoveis/${ids.sexto}/editar`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("prontidao")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Vaga no seu plano|seu plano permite|mude de plano/i)).toHaveCount(0);
    await publicarPeloEditor(page, ids.sexto!);
    await expect.poll(() => statusDoImovel(ids.sexto!), { timeout: 30_000 }).toBe("active");
    for (const id of ids.no_ar) expect(await statusDoImovel(id)).toBe("active");
    expect(await contarAtivos(ids.dono!)).toBe(6);
    await page.screenshot({ path: "tests/laboratorio/saida/t35-1-sexto-publicado.png", fullPage: true });
    await page.context().close();
  });

  test("DESCER para Gratuito com 6 no ar: nada some, nada quebra; o 7º também publica", async ({ browser }) => {
    test.setTimeout(120_000);
    await definirPlano(ids.dono!, null); // assinatura encerrada → sem plano pago
    expect(await contarAtivos(ids.dono!)).toBe(6);

    const page = await entrar(browser, dono.email, senha);
    const resposta = await page.goto("/dashboard/imoveis", { waitUntil: "networkidle" });
    expect(resposta?.status()).toBe(200);
    for (let i = 1; i <= 7; i++) await expect(page.getByText(titulo(i)).first()).toBeVisible();

    await page.goto(`/dashboard/imoveis/${ids.no_ar[2]}/editar`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("prontidao")).toHaveText("Anúncio publicado");

    await publicarPeloEditor(page, ids.setimo!);
    await expect.poll(() => statusDoImovel(ids.setimo!), { timeout: 30_000 }).toBe("active");
    expect(await contarAtivos(ids.dono!)).toBe(7);
    await page.screenshot({ path: "tests/laboratorio/saida/t35-2-desceu-e-publicou.png", fullPage: true });
    await page.context().close();
  });
});
