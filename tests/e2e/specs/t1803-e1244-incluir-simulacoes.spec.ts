import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1803 — E1244 (ORDENS-DUET 1213, 1219 e 1220): "Incluir simulações" na fila de atendimento da Central.
   1. desligada (o padrão), a fila é a de hoje: o chamado de simulação não aparece;
   2. ligada, aparece marcado "Simulação", sem relógio de prazo, e abre o detalhe;
   3. as contagens não mudam com a opção: a bolinha da aba "aprovação" é a mesma;
   4. (ORDEM-DUET 1231, ressalva da Pista 3) com uma simulação em "aguardando_aprovacao": a bolinha da aprovação é IGUAL
      com e sem a opção, a simulação não aparece na aba aprovação, e a aba não oferece a opção;
   5. (ORDEM-DUET 1233, texto do coordenador) a legenda segue a opção: desligada "Simulações ficam fora. Ligue
      'Incluir simulações' para vê-las."; ligada "Incluindo simulações, marcadas como 'Simulação'. Elas não entram nos
      números.".
  Simulação declarada: o chamado de simulação é aberto por uma conta de teste do laboratório (o gatilho da 0135 marca
  simulacao = true). Laboratório; não é prova ao vivo no site.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const pessoa = { email: `sim.t1803.${sufixo}@lab.vivanomads.test`, nome: "Sílvia Simula Chamado", role: "tenant" as const };
const ASSUNTO = `Simulação t1803 ${sufixo}`;
const ASSUNTO_APROVACAO = `Simulação t1803 aprovação ${sufixo}`;
const ids: Record<string, string | undefined> = {};

test.describe("T1803 — E1244: a opção 'Incluir simulações' na fila da Central @E1244", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ storageState: authFile("admin") });

  test.beforeAll(async () => {
    ids.pessoa = await criarConta(pessoa, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.pessoa);
    const agora = Date.now();
    const { data, error } = await adm()
      .from("chamados")
      .insert({
        usuario_id: ids.pessoa, tipo: "suporte", categoria: "duvida", prioridade: "p3", canal: "site", assunto: ASSUNTO,
        responsavel_tipo: "humano", prazo_primeira_resposta: new Date(agora - 3_600_000).toISOString(), prazo_resolucao: new Date(agora + 86_400_000).toISOString(),
      })
      .select("id, simulacao")
      .single();
    if (error) throw error;
    expect(data.simulacao, "conta de teste → simulação").toBe(true);
    ids.chamado = data.id as string;
  });
  test.afterAll(async () => {
    const chs = [ids.chamado, ids.aprovacao].filter((x): x is string => !!x);
    if (chs.length) await adm().from("chamados").delete().in("id", chs);
    await apagarContas([ids.pessoa]);
  });

  const bolinhaAprovacao = async (page: import("@playwright/test").Page) =>
    ((await page.getByRole("link", { name: /aprova/i }).first().textContent()) ?? "").replace(/\D/g, "");

  test("1. desligada (o padrão): a fila é a de hoje — a simulação não aparece", async ({ page }) => {
    await page.goto(`/admin/atendimento?aba=fila&q=${encodeURIComponent(ASSUNTO)}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Nenhum chamado na fila com esses filtros.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(ASSUNTO)).toHaveCount(0);
    ids.bolinha = await bolinhaAprovacao(page);
  });

  test("2. ligada: o chamado de simulação aparece marcado, sem relógio, e abre o detalhe; a bolinha da aprovação não muda", async ({ page }) => {
    await page.goto(`/admin/atendimento?aba=fila&q=${encodeURIComponent(ASSUNTO)}&simulacoes=1`, { waitUntil: "domcontentloaded" });
    const linha = page.getByTestId("chamado-linha").filter({ hasText: ASSUNTO });
    await expect(linha).toBeVisible({ timeout: 30_000 });
    await expect(linha.getByTestId("chamado-simulacao")).toHaveText("Simulação");
    await expect(linha.locator("svg.lucide-clock"), "sem relógio de prazo na simulação").toHaveCount(0);
    expect(await bolinhaAprovacao(page), "a bolinha da aprovação é a mesma com a opção").toBe(ids.bolinha);
    await expect(page.getByRole("checkbox", { name: "Incluir simulações" })).toBeChecked();
    await linha.click();
    await expect(page.getByTestId("chamado-cabecalho")).toContainText(ASSUNTO, { timeout: 30_000 });
    await expect(page.getByTestId("chamado-cabecalho").getByTestId("chamado-simulacao")).toHaveText("Simulação");
  });

  test("4. uma simulação em 'aguardando_aprovacao': a bolinha da aprovação é igual com e sem a opção, e a aba não a mostra", async ({ page }) => {
    const agora = Date.now();
    const { data, error } = await adm()
      .from("chamados")
      .insert({
        usuario_id: ids.pessoa, tipo: "suporte", categoria: "duvida", prioridade: "p3", canal: "site", assunto: ASSUNTO_APROVACAO, status: "aguardando_aprovacao",
        responsavel_tipo: "humano", prazo_primeira_resposta: new Date(agora - 3_600_000).toISOString(), prazo_resolucao: new Date(agora + 86_400_000).toISOString(),
      })
      .select("id, simulacao, status")
      .single();
    if (error) throw error;
    expect(data.simulacao, "conta de teste → simulação").toBe(true);
    expect(data.status).toBe("aguardando_aprovacao");
    ids.aprovacao = data.id as string;
    await page.goto(`/admin/atendimento?aba=fila`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("checkbox", { name: "Incluir simulações" })).toBeVisible({ timeout: 30_000 });
    const sem = await bolinhaAprovacao(page);
    await page.goto(`/admin/atendimento?aba=fila&simulacoes=1`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("checkbox", { name: "Incluir simulações" })).toBeChecked({ timeout: 30_000 });
    const com = await bolinhaAprovacao(page);
    expect(com, "a bolinha da aprovação é IGUAL com e sem a opção, com uma simulação à espera de aprovação").toBe(sem);
    await page.goto(`/admin/atendimento?aba=aprovacao&simulacoes=1`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: /aprova/i }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(ASSUNTO_APROVACAO), "a simulação não entra na aba aprovação").toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: "Incluir simulações" }), "a aba aprovação não oferece a opção").toHaveCount(0);
  });

  test("5. a legenda da fila segue a opção, com os textos do coordenador", async ({ page }) => {
    await page.goto(`/admin/atendimento?aba=fila`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Simulações ficam fora. Ligue 'Incluir simulações' para vê-las.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Incluindo simulações, marcadas como 'Simulação'. Elas não entram nos números.")).toHaveCount(0);
    await page.goto(`/admin/atendimento?aba=fila&simulacoes=1`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Incluindo simulações, marcadas como 'Simulação'. Elas não entram nos números.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Simulações ficam fora. Ligue 'Incluir simulações' para vê-las.")).toHaveCount(0);
    // ORDEM-DUET 1237: nas outras abas, nenhuma linha de legenda (a opção só existe na fila).
    await page.goto(`/admin/atendimento?aba=aprovacao&simulacoes=1`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: /aprova/i }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Simulações ficam fora|Incluindo simulações/)).toHaveCount(0);
  });
});
