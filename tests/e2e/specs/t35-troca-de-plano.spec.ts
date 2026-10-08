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
 * T35 — TROCA DE PLANO COM IMÓVEL JÁ CADASTRADO (laboratório). Conta NOVA de dono
 * com 6 imóveis prontos: 5 publicados (o limite do Essencial) e 1 rascunho.
 *  1. Subir (Essencial → Profissional): o 6º, que estava sem vaga, passa a publicar;
 *     os 5 que já estavam no ar continuam no ar.
 *  2. Descer (Profissional → Gratuito, limite 1, com 6 no ar): NADA some e nada
 *     quebra — os 6 continuam publicados, a lista e o editor abrem, e um 7º não
 *     publica (a tela diz que não há vaga).
 * Falha conhecida (marcada, não escondida): depois de descer, nenhuma tela explica
 * que os anúncios acima do limite continuam no ar mas que não dá para publicar
 * novos (achado para o Otávio).
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

  test("Essencial lotado (5 de 5): o 6º não tem vaga e a tela diz por quê", async ({ browser }) => {
    test.setTimeout(90_000);
    expect(await contarAtivos(ids.dono!)).toBe(5);
    const page = await entrar(browser, dono.email, senha);
    await page.goto(`/dashboard/imoveis/${ids.sexto}/editar`, { waitUntil: "networkidle" });
    await expect(page.getByText(/Vaga no seu plano/).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Publicar", exact: true })).toBeDisabled();
    await page.screenshot({ path: "tests/laboratorio/saida/t35-1-essencial-lotado.png", fullPage: true });
    await page.context().close();
  });

  test("SUBIR para Profissional: o 6º publica e os 5 que estavam no ar continuam", async ({ browser }) => {
    test.setTimeout(120_000);
    await definirPlano(ids.dono!, "pro");
    const page = await entrar(browser, dono.email, senha);
    await publicarPeloEditor(page, ids.sexto!);
    await expect(page.getByTestId("prontidao")).toHaveText("Anúncio publicado", { timeout: 20_000 });
    expect(await statusDoImovel(ids.sexto!)).toBe("active");
    for (const id of ids.no_ar) expect(await statusDoImovel(id)).toBe("active");
    expect(await contarAtivos(ids.dono!)).toBe(6);
    await page.screenshot({ path: "tests/laboratorio/saida/t35-2-subiu-para-pro.png", fullPage: true });
    await page.context().close();
  });

  test("DESCER para Gratuito com 6 no ar: nada some, nada quebra; um 7º não publica", async ({ browser }) => {
    test.setTimeout(120_000);
    await definirPlano(ids.dono!, null); // assinatura encerrada → plano Gratuito (limite 1)
    expect(await contarAtivos(ids.dono!)).toBe(6);

    const page = await entrar(browser, dono.email, senha);
    // A lista abre e mostra os 6 anúncios.
    const resposta = await page.goto("/dashboard/imoveis", { waitUntil: "networkidle" });
    expect(resposta?.status()).toBe(200);
    for (let i = 1; i <= 7; i++) await expect(page.getByText(titulo(i)).first()).toBeVisible();

    // O editor de um anúncio que já está no ar (acima do limite) abre e continua "publicado".
    await page.goto(`/dashboard/imoveis/${ids.no_ar[2]}/editar`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("prontidao")).toHaveText("Anúncio publicado");

    // Um novo (o 7º) não publica: sem vaga, botão travado, com a explicação.
    await page.goto(`/dashboard/imoveis/${ids.setimo}/editar`, { waitUntil: "networkidle" });
    await expect(page.getByText(/Vaga no seu plano/).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Publicar", exact: true })).toBeDisabled();
    expect(await statusDoImovel(ids.setimo!)).toBe("draft");

    // Nada foi despublicado pela troca.
    expect(await contarAtivos(ids.dono!)).toBe(6);
    await page.screenshot({ path: "tests/laboratorio/saida/t35-3-desceu-para-gratuito.png", fullPage: true });
    await page.context().close();
  });

  test("FALHA CONHECIDA: depois de descer, a tela deveria explicar o que acontece com os anúncios acima do limite", async ({ browser }) => {
    test.fail(true, "Falha conhecida: nenhuma tela avisa que os anúncios acima do limite continuam no ar e que novos não publicam.");
    const page = await entrar(browser, dono.email, senha);
    await page.goto("/dashboard/imoveis", { waitUntil: "networkidle" });
    const lista = await page.locator("body").innerText();
    await page.goto("/dashboard/assinatura", { waitUntil: "networkidle" });
    const assinatura = await page.locator("body").innerText();
    expect(lista + "\n" + assinatura).toMatch(/acima do limite|além do limite|continuam (no ar|publicados)|seu plano permite/i);
    await page.context().close();
  });
});
