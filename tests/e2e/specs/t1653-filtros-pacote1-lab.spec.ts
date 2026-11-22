import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1653 — Filtros pacote 1, prova com massa (SÓ laboratório; a parte que vale em qualquer ambiente é o t1652). Numa cidade
  única, quatro anúncios:
    A: ruído baixo · contas fixas com estimativa · ar-condicionado
    B: ruído alto COM isolamento acústico · ar-condicionado
    C: ruído médio SEM isolamento · contas fixas SEM estimativa ("não informados")
    D: sem ruído declarado · contas medidas
  "Ambiente silencioso" → A e B (o chip conta 2). "Contas incluídas" → só A (C não: o cartão dele diz "não informados").
  "Ar-condicionado" → A e B. Os três juntos → só A. Cada chip: o número = os cartões, a URL leva o parâmetro. 390 e 1280 px.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const CIDADE = `Cidade Filtros P1 ${sufixo}`;
const dono = { email: `dono.t1653.${sufixo}@lab.vivanomads.test`, nome: "Sílvia Silêncio", role: "owner" as const };
const ids: Record<string, string> = {};
const titulo = (l: string) => `Studio ${l} P1 ${sufixo}`;

async function abrirFolha(page: Page, url: string) {
  await expect(async () => {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.getByTestId("pilula-mais").click({ timeout: 5_000 });
    await expect(page.getByTestId("painel-filtros")).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  return page.getByTestId("painel-filtros");
}
const titulosNaLista = (page: Page) => page.getByTestId("card-resultado").evaluateAll((els) => els.map((e) => (e.textContent ?? "").trim()));

test.describe("T1653 — Filtros pacote 1 com massa (laboratório)", { tag: ["@E954", "@filtros-pacote1"] }, () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (anúncios criados pelo spec).");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    const massa: Record<string, { ruido: "baixo" | "medio" | "alto" | null; isolamento?: boolean; contas: [string, number]; ar?: boolean }> = {
      A: { ruido: "baixo", contas: ["fixed", 200], ar: true },
      B: { ruido: "alto", isolamento: true, contas: ["real", 0], ar: true },
      C: { ruido: "medio", isolamento: false, contas: ["fixed", 0] },
      D: { ruido: null, contas: ["real", 0] },
    };
    for (const [l, m] of Object.entries(massa)) {
      const id = await criarImovelPronto(ids.dono, titulo(l), { ativo: true, preco: 2000 });
      ids[l] = id;
      const { error } = await adm().from("properties").update({ city: CIDADE, utilities_mode: m.contas[0], utilities_estimate: m.contas[1] }).eq("id", id);
      if (error) throw error;
      if (m.ruido) {
        const n = await adm().from("imovel_nivel").upsert({ property_id: id, nivel: "essencial", ruido_classe: m.ruido }, { onConflict: "property_id" });
        if (n.error) throw n.error;
        const r = await adm()
          .from("imovel_ruido")
          .upsert({ property_id: id, via_intensa: m.ruido !== "baixo", noturno_obra_100m: false, aviao_ferrovia: false, isolamento_acustico: m.isolamento === true, classe: m.ruido }, { onConflict: "property_id" });
        if (r.error) throw r.error;
      }
      if (m.ar) {
        const a = await adm().from("property_amenities").insert({ property_id: id, label: "Ar-condicionado", category: "conforto" });
        if (a.error) throw a.error;
      }
    }
  });
  test.afterAll(async () => {
    if (NO_LABORATORIO) await apagarContas([ids.dono]);
  });

  const casos = [
    { nome: "Ambiente silencioso", testId: "faceta-silencioso", re: /[?&]silencioso=1(&|$)/, ficam: ["A", "B"] },
    { nome: "Contas incluídas", testId: "faceta-contas", re: /[?&]contas=1(&|$)/, ficam: ["A"] },
    { nome: "Ar-condicionado", testId: "faceta-comodidade-ar", re: /[?&]comod=ar(&|$)/, ficam: ["A", "B"] },
  ] as const;

  for (const largura of [390, 1280] as const) {
    for (const c of casos) {
      test(`a ${largura} px: "${c.nome}" fica com ${c.ficam.join(" e ")}; o chip conta ${c.ficam.length} = os cartões`, async ({ page }) => {
        await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
        const folha = await abrirFolha(page, `/buscar?local=${encodeURIComponent(CIDADE)}`);
        const chip = folha.getByTestId(c.testId);
        await expect(chip).toHaveAttribute("data-n", String(c.ficam.length), { timeout: 30_000 });
        await chip.click();
        await folha.getByTestId("aplicar-filtros").click();
        await expect(page).toHaveURL(c.re);
        await expect(page.getByTestId("card-resultado")).toHaveCount(c.ficam.length, { timeout: 30_000 });
        const lista = (await titulosNaLista(page)).join(" | ");
        for (const l of ["A", "B", "C", "D"]) {
          if ((c.ficam as readonly string[]).includes(l)) expect(lista, `${l} fica`).toContain(titulo(l));
          else expect(lista, `${l} sai`).not.toContain(titulo(l));
        }
        await page.screenshot({ path: `${SAIDA}/t1653-preview-${c.testId}-${largura}.png`, fullPage: false });
      });
    }
  }

  test("os três juntos ficam só com A; a URL leva os três e volta igual ao recarregar", async ({ page }) => {
    await page.goto(`/buscar?local=${encodeURIComponent(CIDADE)}&silencioso=1&contas=1&comod=ar`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("card-resultado")).toHaveCount(1, { timeout: 30_000 });
    expect((await titulosNaLista(page)).join(" ")).toContain(titulo("A"));
    await page.reload({ waitUntil: "domcontentloaded" });
    for (const re of [/silencioso=1/, /contas=1/, /comod=ar/]) await expect(page).toHaveURL(re);
    await expect(page.getByTestId("card-resultado")).toHaveCount(1, { timeout: 30_000 });
  });
});
