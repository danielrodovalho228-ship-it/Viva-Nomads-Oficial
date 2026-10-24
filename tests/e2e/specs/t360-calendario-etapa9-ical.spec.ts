import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * Rodada da vigia 24/10 (Pista C): confirmação do merge no lab-crítico do bloco 15 (t338). Era t359, repetida com a do #1208 (L-46).
 * T360 — E44: calendário de disponibilidade da etapa 9 do assistente (mockup cadastro-imovel-09) e exportação iCal.
 *   1. editor (Disponibilidade): a grade dos 3 meses renderiza com o bloqueio do dono marcado; "Exportar para outro site"
 *      mostra o link secreto .ics; o .ics responde 200 e traz o bloqueio manual como "Ocupado" (último dia incluso);
 *   2. cadastro (rascunho, etapa Preço e disponibilidade): a mesma grade e o mesmo link já aparecem (390 px);
 *   3. o link de outro imóvel (token trocado) não abre nada (404).
 */
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t359.${sufixo}@lab.vivanomads.test`, nome: "Clara Calendário", role: "owner" as const };
const ids: { dono?: string; ativo?: string; rascunho?: string } = {};

const emDias = (n: number) => {
  const d = new Date(Date.now() - 3 * 3_600_000);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const BLOQ_INI = emDias(20);
const BLOQ_FIM = emDias(22);
const compacta = (d: string) => d.replaceAll("-", "");

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

test.describe("T360 — E44: grade do calendário + exportação iCal", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.ativo = await criarImovelPronto(ids.dono, `Studio do calendário ${sufixo}`, { ativo: true, preco: 2600 });
    ids.rascunho = await criarImovelPronto(ids.dono, `Rascunho do calendário ${sufixo}`, {});
    const { error } = await adm().from("property_blocks").insert({ property_id: ids.ativo, inicio: BLOQ_INI, fim: BLOQ_FIM });
    if (error) throw error;
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  test("1. editor: grade com o bloqueio, link de exportação e .ics com o bloqueio como 'Ocupado'", async ({ browser }) => {
    test.setTimeout(150_000);
    const d = await entrar(browser, dono.email, senha);
    await d.setViewportSize({ width: 1280, height: 900 });
    await d.goto(`/dashboard/imoveis/${ids.ativo}/editar#calendario`, { waitUntil: "domcontentloaded" });
    const grade = d.getByTestId("calendario-dono-grade");
    await expect(grade).toBeVisible({ timeout: 30_000 });
    await expect(grade.locator("> *")).toHaveCount(3);
    await expect(d.locator(`[data-testid="bloqueio-item"][data-inicio="${BLOQ_INI}"]`)).toHaveCount(1);

    const link = d.getByTestId("exportar-calendario-link");
    await expect(link).toHaveValue(new RegExp(`/api/calendario/${ids.ativo}/[0-9a-f]{32}\\.ics$`), { timeout: 20_000 });
    await semRolagemLateral(d);
    await d.getByTestId("exportar-calendario").screenshot({ path: `${SAIDA}/t359-exportar-1280.png` });

    const url = new URL((await link.inputValue()) as string);
    const r = await d.request.get(url.pathname);
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toContain("text/calendar");
    const ics = await r.text();
    expect(ics).toContain("SUMMARY:Ocupado");
    expect(ics).toContain(`DTSTART;VALUE=DATE:${compacta(BLOQ_INI)}`);
    // Bloqueio é inclusivo no último dia; no iCal o fim é exclusivo → dia seguinte ao fim.
    expect(ics).toContain(`DTEND;VALUE=DATE:${compacta(emDias(23))}`);
    expect(ics).not.toContain(dono.nome);

    // 3. token de outro imóvel não abre.
    const trocado = url.pathname.replace(ids.ativo!, ids.rascunho!);
    expect((await d.request.get(trocado)).status()).toBe(404);
    await d.context().close();
  });

  test("2. cadastro (rascunho): a etapa de preço e disponibilidade já mostra a grade e o link — 390 px", async ({ browser }) => {
    test.setTimeout(150_000);
    const d = await entrar(browser, dono.email, senha);
    await d.setViewportSize({ width: 390, height: 844 });
    await d.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=regras`, { waitUntil: "domcontentloaded" });
    const etapa = d.getByTestId("calendario-etapa");
    await expect(etapa).toBeVisible({ timeout: 30_000 });
    await expect(etapa.getByTestId("calendario-dono-grade")).toBeVisible({ timeout: 30_000 });
    await expect(etapa.getByTestId("exportar-calendario-link")).toHaveValue(new RegExp(`/api/calendario/${ids.rascunho}/`), { timeout: 20_000 });
    await semRolagemLateral(d);
    await etapa.screenshot({ path: `${SAIDA}/t359-etapa-calendario-390.png` });
    await d.context().close();
  });
});
