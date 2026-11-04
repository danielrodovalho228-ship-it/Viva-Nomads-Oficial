import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { doTipoAoEndereco } from "../fixtures/cadastro";

/**
 * T1084 — E516 (#2433, 04/11): abrir o assistente não carimba "Salvo às" — só a edição do conteúdo. Antes, aplicar o
 * rascunho carregado mudava o estado do formulário e, 2 s depois, o autosave gravava e mostrava "Salvo às HH:MM" sem
 * nenhuma edição. Pela tela real, proprietário novo com um rascunho criado pelo próprio assistente, 390 e 1280:
 *   1. reabrir o rascunho (?draft=<id>) e esperar além do debounce: nada de "Salvando…" nem "Salvo às";
 *   2. mudar um campo (o bairro) → "Salvando…" e depois "Salvo às HH:MM" (o carimbo volta com a edição de verdade);
 *   3. recarregar: o bairro novo veio do servidor;
 *   4. (L-93) a edição feita logo ao abrir, antes do 1º debounce, também precisa ser gravada.
 * As regras (conteudoDoRascunho, decisaoAutosave) ficam com o salvo-fantasma.test.ts; o autosave em si, com a t8. *
 * L-93 (defeito de produto achado lendo o E516, 04/11): o 1º debounce depois de abrir o rascunho virava a BASE e não
 * gravava — a edição feita nesses primeiros ~2 s se perdia ao sair ou recarregar. A Pista B corrigiu no #2444 (seguimento
 * do E516); o teste 4 fica como regressão.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1084.${sufixo}@lab.vivanomads.test`, nome: "Silvio Salvo Nunes", role: "owner" as const };
const ids: Record<string, string> = {};
let rascunho = "";

async function comQualificacao(p: Page) {
  // Como a t8: a qualificação (elegível) é pré-requisito do editor; vai na sessionStorage.
  await p.addInitScript(() => {
    try {
      sessionStorage.setItem("vivanomads-qualification", JSON.stringify({ eligible: true, baseBadge: true, tHome: true, tWork: false, score: 5 }));
    } catch {
      /* sem sessionStorage */
    }
  });
}

async function criarRascunho(browser: Browser): Promise<string> {
  const p = await entrar(browser, dono.email, senha);
  await comQualificacao(p);
  await p.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
  const qualificacao = p.getByTestId("qualificacao");
  await p.getByTestId("passo-titulo").or(qualificacao).first().waitFor({ state: "visible", timeout: 30_000 });
  if (await qualificacao.isVisible()) await p.getByTestId("qualificacao-depois").click();
  await doTipoAoEndereco(p);
  await p.getByTestId("cadastro-rua").fill(`Rua do Carimbo ${sufixo}`);
  await p.getByTestId("cadastro-numero").fill("100");
  await p.locator('input[list="novo-bairros"]').fill(`Centro t1084 ${sufixo}`);
  await p.waitForTimeout(2_500);
  await expect(p.getByText("Salvando…")).toHaveCount(0, { timeout: 15_000 });
  await expect(p).toHaveURL(/\/dashboard\/imoveis\/novo\?draft=/, { timeout: 20_000 });
  const id = new URL(p.url()).searchParams.get("draft")!;
  await p.context().close();
  return id;
}

test.describe("T1084 — E516: abrir o rascunho não carimba 'Salvo às'; editar, sim", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000);
    ids.dono = await criarConta(dono, senha);
    rascunho = await criarRascunho(browser);
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`reabrir não mostra Salvando/Salvo às; mudar o bairro carimba e grava (${w})`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await comQualificacao(p);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      const estado = p.getByTestId("estado-salvamento");
      const bairro = p.locator('input[list="novo-bairros"]');

      // 1. Abrir o rascunho no Endereço e esperar além do debounce (2 s): nenhum salvamento visível.
      await p.goto(`/dashboard/imoveis/novo?draft=${rascunho}&etapa=2`, { waitUntil: "domcontentloaded" });
      await expect(bairro).toHaveValue(/^(Centro|Bairro) t1084 /, { timeout: 30_000 });
      await p.waitForTimeout(4_500);
      await expect(p.getByText("Salvando…"), "abrir não é editar").toHaveCount(0);
      await expect(p.getByText(/Salvo às \d{2}:\d{2}/), "sem carimbo ao abrir").toHaveCount(0);

      // 2. Editar o conteúdo: o carimbo volta.
      const novo = `Bairro t1084 ${w} ${sufixo}`;
      await bairro.fill(novo);
      await expect(estado).toHaveAttribute("data-estado", "saved", { timeout: 20_000 });
      await expect(estado).toContainText(/Salvo às \d{2}:\d{2}/);

      // 3. Gravou no servidor.
      await p.reload({ waitUntil: "domcontentloaded" });
      await expect(bairro).toHaveValue(novo, { timeout: 30_000 });
      await p.context().close();
    });
  }

  test("4. L-93 (corrigido no #2444): uma edição logo ao abrir (antes do 1º debounce) também é gravada (390)", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await comQualificacao(p);
    await p.setViewportSize({ width: 390, height: 844 });
    const bairro = p.locator('input[list="novo-bairros"]');
    await p.goto(`/dashboard/imoveis/novo?draft=${rascunho}&etapa=2`, { waitUntil: "domcontentloaded" });
    await expect(bairro).toHaveValue(/^(Centro|Bairro) t1084 /, { timeout: 30_000 });
    // Edita assim que o campo aparece (dentro dos 2 s do 1º debounce) e espera bem além dele, sem mais nada.
    const rapido = `Rapido t1084 ${sufixo}`;
    await bairro.fill(rapido);
    await p.waitForTimeout(6_000);
    await p.reload({ waitUntil: "domcontentloaded" });
    try {
      await expect(bairro, "a edição rápida foi gravada").toHaveValue(rapido, { timeout: 20_000 });
    } finally {
      await p.context().close();
    }
  });
});
