import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1803 — E1244 (ORDENS-DUET 1213, 1219 e 1220): "Incluir simulações" na fila de atendimento da Central.
   1. desligada (o padrão), a fila é a de hoje: o chamado de simulação não aparece;
   2. ligada, aparece marcado "Simulação", sem relógio de prazo, e abre o detalhe;
   3. as contagens não mudam com a opção: a bolinha da aba "aprovação" é a mesma.
  Simulação declarada: o chamado de simulação é aberto por uma conta de teste do laboratório (o gatilho da 0135 marca
  simulacao = true). Laboratório; não é prova ao vivo no site.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const pessoa = { email: `sim.t1803.${sufixo}@lab.vivanomads.test`, nome: "Sílvia Simula Chamado", role: "tenant" as const };
const ASSUNTO = `Simulação t1803 ${sufixo}`;
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
    if (ids.chamado) await adm().from("chamados").delete().eq("id", ids.chamado);
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
  });
});
