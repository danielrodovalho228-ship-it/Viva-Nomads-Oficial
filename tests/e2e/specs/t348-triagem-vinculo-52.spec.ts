import { randomBytes } from "node:crypto";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T348 — Prompt 52: triagem do morador, o comprovante de vínculo (chave TRIAGEM_VINCULO_ATIVA).
 *   0. chave desligada: nenhuma tela nova (morador, admin e dono) e o envio responde 404;
 *   1. chave ligada só neste navegador (cookie do laboratório): o morador com candidatura aceita envia a carta do
 *      empregador; a equipe recusa com motivo legível; o morador lê o motivo e reenvia na hora; a equipe aprova (12 meses);
 *   2. o dono vê "Morador verificado · vínculo confirmado (carta do empregador)" SÓ com identidade + vínculo, e nunca o
 *      arquivo, o caminho ou valores; com a identidade vencida, o selo some;
 *   3. conta de teste aparece marcada na fila (fora das métricas).
 * Rodada da vigia (Pista C, 23/10 à noite): confirmação depois do #1190 (L-31) no lab-crítico do PR da vigia.
 */
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t348.${sufixo}@lab.vivanomads.test`, nome: "Dália Triagem", role: "owner" as const };
const morador = { email: `mor.t348.${sufixo}@lab.vivanomads.test`, nome: `Murilo Triagem ${sufixo}`, role: "tenant" as const };
const qa = { email: `qa.t348.${sufixo}@lab.vivanomads.test`, nome: `Quênia Teste ${sufixo}`, role: "tenant" as const };
const ids: { dono?: string; morador?: string; qa?: string; imovel?: string; lead?: string; leadQa?: string } = {};
const SELO = "Morador verificado · vínculo confirmado (carta do empregador)";

/** PDF de verdade (magic bytes) acima do tamanho mínimo. */
const pdf = () => Buffer.concat([Buffer.from("%PDF-1.4\n%lab\n"), randomBytes(24 * 1024), Buffer.from("\n%%EOF\n")]);

function semDialogo(page: Page) {
  page.on("dialog", (d) => {
    throw new Error(`diálogo do navegador não permitido: ${d.type()} ${d.message()}`);
  });
}
async function ligar(page: Page) {
  await page.context().addCookies([{ name: "vn_lab_triagem", value: "1", url: new URL(page.url()).origin }]);
}
async function abrir(browser: Browser, email: string, largura = 390, chave = true): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  semDialogo(page);
  if (chave) await ligar(page);
  return page;
}
async function abrirAdmin(browser: Browser, chave = true): Promise<Page> {
  const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
  const a = await ctx.newPage();
  semDialogo(a);
  await a.goto("/admin", { waitUntil: "domcontentloaded" });
  if (chave) await ligar(a);
  return a;
}
async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}
async function identidade(id: string, valida: boolean) {
  const agora = new Date();
  const ate = new Date(agora.getTime() + (valida ? 300 : -1) * 86_400_000);
  await adm().from("tenant_verifications").delete().eq("tenant_id", id);
  await adm()
    .from("tenant_verifications")
    .insert({ tenant_id: id, caf_result: { identity: true, document: true, liveness: true, light: "green", simulado: true }, traffic_light: "green", created_at: new Date(ate.getTime() - 365 * 86_400_000).toISOString(), valid_until: ate.toISOString() });
}
async function vinculos(userId: string) {
  const { data } = await adm().from("triagem_vinculos").select("id, tipo, status, motivo, valido_ate, path").eq("user_id", userId).order("enviado_em");
  return (data ?? []) as { id: string; tipo: string; status: string; motivo: string | null; valido_ate: string | null; path: string }[];
}
async function cartaoDoCandidato(page: Page) {
  await page.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
  const card = page.locator("li, article, div").filter({ hasText: "interesse em" }).filter({ hasText: `Studio triagem ${sufixo}` }).first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  return card;
}

test.describe("T348 — Prompt 52: triagem do morador (vínculo)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.qa = await criarConta(qa, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.qa);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio triagem ${sufixo}`, { ativo: true, preco: 2700 });
    ids.lead = await criarLead(ids.dono, ids.morador, ids.imovel, true);
    ids.leadQa = await criarLead(ids.dono, ids.qa, ids.imovel, true);
    await identidade(ids.morador, true);
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    for (const id of [ids.morador, ids.qa]) {
      if (!id) continue;
      const paths = (await vinculos(id)).map((v) => v.path);
      if (paths.length) await adm().storage.from("triagem-vinculos").remove(paths);
      await adm().from("tenant_verifications").delete().eq("tenant_id", id);
    }
    await adm().from("leads").delete().in("id", [ids.lead, ids.leadQa].filter(Boolean) as string[]);
    await apagarContas([ids.dono, ids.morador, ids.qa]);
  });

  test("0. chave desligada: nenhuma tela nova e o envio responde 404", async ({ browser }) => {
    const m = await abrir(browser, morador.email, 390, false);
    await m.goto("/dashboard/candidaturas", { waitUntil: "domcontentloaded" });
    await expect(m.getByRole("heading", { name: "Minhas candidaturas" })).toBeVisible({ timeout: 30_000 });
    await expect(m.getByTestId("triagem-vinculo")).toHaveCount(0);
    const r = await m.request.post("/api/upload/triagem-vinculo", { multipart: { tipo: "carta_empregador", file: { name: "carta.pdf", mimeType: "application/pdf", buffer: pdf() } } });
    expect(r.status()).toBe(404);
    expect(await vinculos(ids.morador!)).toHaveLength(0);
    await m.context().close();
    const a = await abrirAdmin(browser, false);
    await a.goto("/admin/documentos", { waitUntil: "domcontentloaded" });
    await expect(a.getByTestId("admin-vinculos")).toHaveCount(0);
    await a.context().close();
  });

  test("1. envio, recusa com motivo legível, reenvio na hora e aprovação de 12 meses", async ({ browser }) => {
    test.setTimeout(150_000);
    const m = await abrir(browser, morador.email);
    await m.goto("/dashboard/candidaturas", { waitUntil: "domcontentloaded" });
    const bloco = m.getByTestId("triagem-vinculo");
    await expect(bloco).toHaveAttribute("data-estado", "nenhum", { timeout: 30_000 });
    await bloco.getByTestId("triagem-tipo-carta_empregador").check();
    await bloco.getByLabel("Enviar comprovante de vínculo").setInputFiles({ name: "carta.pdf", mimeType: "application/pdf", buffer: pdf() });
    await expect(bloco).toHaveAttribute("data-estado", "pendente", { timeout: 30_000 });
    await semRolagemLateral(m);
    await m.screenshot({ path: `${SAIDA}/t348-vinculo-pendente-390.png`, fullPage: true });

    // Conta de teste também envia: aparece marcada na fila.
    const q = await abrir(browser, qa.email);
    await q.goto("/dashboard/candidaturas", { waitUntil: "domcontentloaded" });
    await q.getByTestId("triagem-vinculo").getByLabel("Enviar comprovante de vínculo").setInputFiles({ name: "contracheque.pdf", mimeType: "application/pdf", buffer: pdf() });
    await expect(q.getByTestId("triagem-vinculo")).toHaveAttribute("data-estado", "pendente", { timeout: 30_000 });
    await q.context().close();

    const a = await abrirAdmin(browser);
    await a.goto("/admin/documentos", { waitUntil: "domcontentloaded" });
    const fila = a.getByTestId("admin-vinculos");
    await expect(fila).toBeVisible({ timeout: 30_000 });
    const [v1] = await vinculos(ids.morador!);
    const item = a.locator(`[data-testid="admin-vinculo"][data-id="${v1.id}"]`);
    await expect(item).toContainText(morador.nome);
    await expect(item).toContainText("Carta do empregador");
    const [vq] = await vinculos(ids.qa!);
    await expect(a.locator(`[data-testid="admin-vinculo"][data-id="${vq.id}"]`)).toContainText("conta de teste");
    await item.getByTestId("admin-vinculo-motivo").selectOption("sem_nome");
    await item.getByTestId("admin-vinculo-complemento").fill("A carta está no nome de outra pessoa.");
    await item.getByTestId("admin-vinculo-recusar").click();
    await expect(item).toHaveCount(0, { timeout: 20_000 });
    expect((await vinculos(ids.morador!))[0].status).toBe("recusado");

    await m.reload({ waitUntil: "domcontentloaded" });
    await expect(bloco.getByTestId("triagem-recusado")).toContainText("Não aparece o seu nome no documento", { timeout: 30_000 });
    await expect(bloco.getByTestId("triagem-recusado")).toContainText("A carta está no nome de outra pessoa.");
    await bloco.getByTestId("triagem-tipo-carta_empregador").check();
    await bloco.getByLabel("Enviar comprovante de vínculo").setInputFiles({ name: "carta2.pdf", mimeType: "application/pdf", buffer: pdf() });
    await expect(bloco).toHaveAttribute("data-estado", "pendente", { timeout: 30_000 });

    await a.reload({ waitUntil: "domcontentloaded" });
    const v2 = (await vinculos(ids.morador!)).at(-1)!;
    const item2 = a.locator(`[data-testid="admin-vinculo"][data-id="${v2.id}"]`);
    await item2.getByTestId("admin-vinculo-aprovar").click();
    await expect(item2).toHaveCount(0, { timeout: 20_000 });
    const aprovado = (await vinculos(ids.morador!)).at(-1)!;
    expect(aprovado.status).toBe("aprovado");
    const dias = (Date.parse(aprovado.valido_ate!) - Date.now()) / 86_400_000;
    expect(dias).toBeGreaterThan(360);
    expect(dias).toBeLessThan(370);
    await a.screenshot({ path: `${SAIDA}/t348-fila-admin-1280.png`, fullPage: true });
    await a.context().close();

    await m.reload({ waitUntil: "domcontentloaded" });
    await expect(bloco.getByTestId("triagem-aprovado")).toContainText("Vínculo confirmado (Carta do empregador)", { timeout: 30_000 });
    await expect(bloco.getByTestId("triagem-arquivo")).toHaveCount(0);
    await m.context().close();
  });

  test("2. o dono vê o selo só com identidade + vínculo; nunca arquivo nem valores", async ({ browser }) => {
    test.setTimeout(120_000);
    const d = await abrir(browser, dono.email, 1280);
    const card = await cartaoDoCandidato(d);
    await expect(d.getByTestId("selo-morador-verificado")).toHaveCount(1, { timeout: 30_000 });
    await expect(d.getByTestId("selo-morador-verificado")).toHaveText(SELO);
    // A conta de teste (sem identidade e com vínculo pendente) não tem selo.
    const html = await d.content();
    expect(html).not.toContain("triagem-vinculos");
    expect(html).not.toMatch(/\/storage\/v1\/object\/sign\/triagem/);
    expect(html).not.toMatch(/R\$\s?\d|salári/i);
    await semRolagemLateral(d);
    await card.screenshot({ path: `${SAIDA}/t348-selo-dono-1280.png` }).catch(() => undefined);

    // Identidade vencida: o selo some (as duas confirmações e dentro da validade).
    await identidade(ids.morador!, false);
    await d.reload({ waitUntil: "domcontentloaded" });
    await expect(d.getByText("interesse em").first()).toBeVisible({ timeout: 30_000 });
    await expect(d.getByTestId("selo-morador-verificado")).toHaveCount(0);
    await identidade(ids.morador!, true);

    // Chave desligada no navegador do dono: nada de selo.
    await d.context().clearCookies({ name: "vn_lab_triagem" });
    await d.reload({ waitUntil: "domcontentloaded" });
    await expect(d.getByText("interesse em").first()).toBeVisible({ timeout: 30_000 });
    await expect(d.getByTestId("selo-morador-verificado")).toHaveCount(0);
    await d.context().close();
  });
});
