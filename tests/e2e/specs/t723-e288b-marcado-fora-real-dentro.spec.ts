import { test, expect, request as api, type APIRequestContext } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, novoSufixo } from "../fixtures/laboratorio";
import { chaveCidade } from "../../../src/lib/cidades";

/*
  T723 — E288-B (#1635, 0266), os dois lados por tipo e nas duas larguras, o que a t741 não olha (ela grava "busca" e
  confere o admin a 1280). Pista C, bloco 77 (31/10). Numa cidade só deste teste:
   1. Gravação por tipo ("busca" e "iniciar_cadastro"): a mesma requisição SEM marca nasce 'real'; com o cabeçalho
      x-vn-origem: e2e ou com o cookie vn_trafego=e2e nasce 'e2e' — o valor exato, sem caixa nem espaço, ainda marca.
   2. Contagem (1280 e 390): a função da home (admin_visao_geral) conta só o real e diz quantos ficaram fora;
      /admin/eventos mostra, para cada tipo, só o real no total e "N eventos de teste fora da contagem"; o Funil mostra
      a linha discreta com pelo menos os deste teste.
   3. Real segue contando: um evento real a mais sobe o total do tipo em 1 e não mexe no "fora"; um marcado a mais sobe
      só o "fora".
*/
const sufixo = novoSufixo();
const CIDADE = `Marcadopolis ${sufixo}`;
const K = chaveCidade(CIDADE);
const TIPOS = ["busca", "iniciar_cadastro"] as const;
const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
let n = 0;
/** Cada envio com um user-agent próprio: a sessão anônima é hash(ip, ua, dia), então cada um vale uma sessão. */
const ua = () => `Mozilla/5.0 (X11; Linux x86_64) T723/${sufixo}/${++n}`;

const linhas = async (tipo: string) =>
  ((await adm().from("eventos").select("trafego").eq("cidade_chave", K).eq("tipo", tipo)).data ?? []).map((l) => (l as { trafego: string }).trafego).sort();

async function enviar(c: APIRequestContext, tipo: string, extra: Record<string, string> = {}) {
  const r = await c.post("/api/evento", { data: JSON.stringify({ tipo, cidade: CIDADE }), headers: { "content-type": "text/plain", "user-agent": ua(), ...extra } });
  expect(r.status()).toBe(204);
}

test.describe("T723 — E288-B: marcado nasce fora, real entra — por tipo, no admin e no Funil, a 390 e 1280", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  let semMarca: APIRequestContext;

  test.beforeAll(async ({ baseURL }) => {
    // O request do @playwright/test herda o cabeçalho x-vn-origem do playwright.config: aqui ele é zerado.
    semMarca = await api.newContext({ baseURL, extraHTTPHeaders: {} });
  });
  test.afterAll(async () => {
    await semMarca?.dispose();
    await adm().from("eventos").delete().eq("cidade_chave", K);
  });

  test("1. gravação por tipo: sem marca → real; cabeçalho ou cookie e2e (inclusive ' E2E ') → e2e", async () => {
    for (const tipo of TIPOS) {
      await enviar(semMarca, tipo);
      await enviar(semMarca, tipo, { "x-vn-origem": "e2e" });
      await enviar(semMarca, tipo, { cookie: "vn_trafego=e2e" });
      await enviar(semMarca, tipo, { "x-vn-origem": " E2E " });
      // Parecido mas não é a marca: conta como real.
      await enviar(semMarca, tipo, { "x-vn-origem": "e2e-nao" });
    }
    for (const tipo of TIPOS) {
      await expect.poll(() => linhas(tipo), { timeout: 15_000, message: tipo }).toEqual(["e2e", "e2e", "e2e", "real", "real"]);
    }
  });

  for (const largura of [1280, 390] as const) {
    test(`2. ${largura} px: home do admin, /admin/eventos (por tipo) e Funil contam só o real e mostram os de fora`, async ({ browser }) => {
      const { data, error } = await adm().rpc("admin_visao_geral", { p_inicio: hoje(), p_fim: hoje(), p_cidade: CIDADE });
      expect(error).toBeNull();
      const atual = (data as { atual: Record<string, number> }).atual;
      expect(atual.buscas).toBe(2);
      expect(atual.eventos_teste_fora).toBe(TIPOS.length * 3);

      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const p = await ctx.newPage();
      for (const tipo of TIPOS) {
        await p.goto(`/admin/eventos?tipo=${tipo}&de=${hoje()}&ate=${hoje()}&cidade=${encodeURIComponent(CIDADE)}`, { waitUntil: "domcontentloaded" });
        await expect(p.getByTestId("lista-total"), tipo).toHaveText("2", { timeout: 30_000 });
        const fora = p.getByTestId("eventos-fora-da-contagem");
        await expect(fora, tipo).toHaveAttribute("data-fora", "3");
        await expect(fora).toContainText("3 eventos de teste fora da contagem");
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `sem rolagem lateral (${tipo})`).toBeLessThanOrEqual(1);
      }
      await p.screenshot({ path: `tests/laboratorio/saida/t723-eventos-${largura}.png`, fullPage: largura === 390 });
      await p.goto("/admin/funil", { waitUntil: "domcontentloaded" });
      const linhaFora = p.getByTestId("funil-fora-da-contagem");
      await expect(linhaFora).toBeAttached({ timeout: 30_000 });
      expect(Number(await linhaFora.getAttribute("data-fora"))).toBeGreaterThanOrEqual(TIPOS.length * 3);
      await expect(p.getByTestId("funil-etapa").first()).toBeAttached();
      await ctx.close();
    });
  }

  test("3. real segue contando: +1 real sobe o total; +1 marcado sobe só o 'fora'", async ({ browser }) => {
    await enviar(semMarca, "busca");
    await enviar(semMarca, "busca", { "x-vn-origem": "e2e" });
    await expect.poll(() => linhas("busca"), { timeout: 15_000 }).toEqual(["e2e", "e2e", "e2e", "e2e", "real", "real", "real"]);
    const { data } = await adm().rpc("admin_visao_geral", { p_inicio: hoje(), p_fim: hoje(), p_cidade: CIDADE });
    const atual = (data as { atual: Record<string, number> }).atual;
    expect(atual.buscas).toBe(3);
    expect(atual.eventos_teste_fora).toBe(TIPOS.length * 3 + 1);
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(`/admin/eventos?tipo=busca&de=${hoje()}&ate=${hoje()}&cidade=${encodeURIComponent(CIDADE)}`, { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("lista-total")).toHaveText("3", { timeout: 30_000 });
    await expect(p.getByTestId("eventos-fora-da-contagem")).toHaveAttribute("data-fora", "4");
    await ctx.close();
  });
});
