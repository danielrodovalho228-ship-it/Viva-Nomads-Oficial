import { test, expect, request as api } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { chaveCidade } from "../../../src/lib/cidades";

/*
  T741 — E288-B: tráfego de teste fora das métricas. Cada evento é uma "busca" numa cidade só deste teste:
    • requisição SEM a marca de teste            → trafego 'real'  → entra na contagem;
    • requisição com o cabeçalho x-vn-origem: e2e → trafego 'e2e'   → fora;
    • requisição só com o cookie vn_trafego=e2e   → trafego 'e2e'   → fora;
    • sessão de conta is_teste (sem a marca)      → trafego 'teste' → fora.
  /admin/eventos e a função da home (admin_visao_geral) contam 1 e dizem "3 eventos de teste fora da contagem"; o Funil
  mostra a linha discreta. O proxy devolve o cookie vn_trafego=e2e a quem chega com o cabeçalho (o playwright.config manda
  o cabeçalho em toda requisição da suíte).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const CIDADE = `Trafegopolis ${sufixo}`;
const K = chaveCidade(CIDADE);
const ids: string[] = [];
const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

const linhas = async () =>
  ((await adm().from("eventos").select("trafego, usuario_id").eq("cidade_chave", K).eq("tipo", "busca")).data ?? []) as { trafego: string; usuario_id: string | null }[];

test.describe("T741 — E288-B: tráfego de teste fora das métricas", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.afterAll(async () => {
    await adm().from("eventos").delete().eq("cidade_chave", K);
    await apagarContas(ids);
  });

  test("gravação: real, e2e (cabeçalho), e2e (cookie) e teste (conta is_teste)", async ({ browser, baseURL }) => {
    const corpo = JSON.stringify({ tipo: "busca", cidade: CIDADE });
    // Contexto de API SEM a marca de teste: o request de @playwright/test herda os padrões do playwright.config
    // (inclusive o cabeçalho x-vn-origem), então os cabeçalhos extras são zerados explicitamente.
    const semMarca = await api.newContext({ baseURL, extraHTTPHeaders: {} });
    expect((await semMarca.post("/api/evento", { data: corpo, headers: { "content-type": "text/plain" } })).status()).toBe(204);
    expect((await semMarca.post("/api/evento", { data: corpo, headers: { "content-type": "text/plain", "x-vn-origem": "e2e" } })).status()).toBe(204);
    expect((await semMarca.post("/api/evento", { data: corpo, headers: { "content-type": "text/plain", cookie: "vn_trafego=e2e" } })).status()).toBe(204);
    await semMarca.dispose();

    // Conta is_teste, num navegador SEM a marca da suíte: o evento sai 'teste'.
    const email = `teste.t741.${sufixo}@lab.vivanomads.test`;
    const id = await criarConta({ email, nome: "Tereza Teste Sobrenome", role: "tenant" }, senha);
    ids.push(id);
    expect((await adm().from("profiles").update({ is_teste: true }).eq("id", id)).error).toBeNull();
    const ctx = await browser.newContext({ baseURL, extraHTTPHeaders: {} });
    const page = await entrarNaPagina(await ctx.newPage(), email, senha);
    expect((await ctx.cookies()).find((c) => c.name === "vn_trafego"), "sem a marca, o proxy não grava o cookie").toBeUndefined();
    const st = await page.evaluate(async (b) => (await fetch("/api/evento", { method: "POST", body: b })).status, corpo);
    expect(st).toBe(204);
    await ctx.close();

    await expect
      .poll(async () => (await linhas()).map((l) => l.trafego).sort(), { timeout: 15_000 })
      .toEqual(["e2e", "e2e", "real", "teste"]);
    expect((await linhas()).find((l) => l.trafego === "teste")?.usuario_id).toBe(id);
  });

  test("proxy: quem chega com o cabeçalho da suíte recebe o cookie vn_trafego=e2e", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const c = (await page.context().cookies()).find((x) => x.name === "vn_trafego");
    expect(c?.value).toBe("e2e");
  });

  test("contagem: /admin/eventos e a função da home contam só o real; o resto aparece como 'fora da contagem'", async ({ browser }) => {
    const { data, error } = await adm().rpc("admin_visao_geral", { p_inicio: hoje(), p_fim: hoje(), p_cidade: CIDADE });
    expect(error).toBeNull();
    const atual = (data as { atual: Record<string, number> }).atual;
    expect(atual.buscas).toBe(1);
    expect(atual.eventos_teste_fora).toBe(3);
    const serie = (data as { serie: { buscas: number }[] }).serie;
    expect(serie.reduce((s, d) => s + d.buscas, 0)).toBe(1);

    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(`/admin/eventos?tipo=busca&de=${hoje()}&ate=${hoje()}&cidade=${encodeURIComponent(CIDADE)}`, { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("lista-total")).toHaveText("1", { timeout: 30_000 });
    await expect(p.getByTestId("eventos-fora-da-contagem")).toHaveAttribute("data-fora", "3");
    await expect(p.getByTestId("eventos-fora-da-contagem")).toContainText("3 eventos de teste fora da contagem");

    // Funil (7 dias, sem cidade): a linha discreta aparece — pelo menos os 3 deste teste.
    await p.goto("/admin/funil", { waitUntil: "domcontentloaded" });
    const fora = p.getByTestId("funil-fora-da-contagem");
    await expect(fora).toBeVisible({ timeout: 30_000 });
    expect(Number(await fora.getAttribute("data-fora"))).toBeGreaterThanOrEqual(3);
    await ctx.close();
  });
});
