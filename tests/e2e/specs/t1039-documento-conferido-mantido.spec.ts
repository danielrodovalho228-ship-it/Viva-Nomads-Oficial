import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1039 — documento aprovado nunca é rebaixado por um envio novo. Nasceu para o #2331 (Relay 46, "nunca apagar, nunca
 * rebaixar") e segue a decisão que o substituiu, o #2343 (E-DOC-VIGENTE, Relay 47, Daniel em 02/11: "Manter o aprovado
 * até o novo ser aprovado"): o campo de envio volta, mas o envio novo fica À PARTE, em análise ou recusado, e o
 * aprovado (o VIGENTE) segue valendo para a tela e para publicar. Pela tela real /qualificar, 390 e 1280:
 *   1. só o aprovado: o campo de envio está lá, rotulado "Aprovado", sem aviso de envio novo;
 *   2. aprovado + envio novo em análise: "Documento novo em análise. O aprovado continua valendo até o novo ser
 *      aprovado." (documento-novo-em-analise);
 *   3. aprovado + envio novo recusado: "O documento novo foi recusado. O aprovado continua valendo. Motivo: …"
 *      (documento-novo-recusado);
 *   4. controle — só o envio em análise (sem aprovado): nenhum dos dois avisos.
 * E no banco (portão de publicar da 0285, properties_protege_campos): o imóvel com aprovado + envio novo em análise
 * PUBLICA; o do controle (só em análise) é barrado com "Documentação do imóvel ainda não aprovada".
 * A regra pura (estadoDocumentos, statusDepoisDoEnvio, linhasParaLigar) fica com o doc-vigente.test.ts.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1039.${sufixo}@lab.vivanomads.test`, nome: "Dalila Documento Souza", role: "owner" as const };
const EM_ANALISE = "Documento novo em análise. O aprovado continua valendo até o novo ser aprovado.";
const RECUSADO = "O documento novo foi recusado. O aprovado continua valendo.";
const MOTIVO = `Foto ilegível t1039 ${sufixo}`;
const ids: { dono?: string; aprovado?: string; emAnalise?: string; recusado?: string; pendente?: string } = {};

/** Linha nova DEPOIS da aprovada (created_at um minuto à frente), como um envio novo da tela deixaria. */
async function envioNovo(propertyId: string, status: "pending" | "rejected", motivo?: string) {
  const { error } = await adm()
    .from("qualification_checklists")
    .insert({
      owner_id: ids.dono,
      property_id: propertyId,
      document_status: status,
      document_review_reason: motivo ?? null,
      document_uploaded_at: new Date().toISOString(),
      created_at: new Date(Date.now() + 60_000).toISOString(),
    });
  if (error) throw error;
}

test.describe("T1039 — E-DOC-VIGENTE: o aprovado segue valendo até o novo ser aprovado", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.aprovado = await criarImovelPronto(ids.dono, `Studio aprovado t1039 ${sufixo}`);
    ids.emAnalise = await criarImovelPronto(ids.dono, `Studio novo em análise t1039 ${sufixo}`);
    await envioNovo(ids.emAnalise, "pending");
    ids.recusado = await criarImovelPronto(ids.dono, `Studio novo recusado t1039 ${sufixo}`);
    await envioNovo(ids.recusado, "rejected", MOTIVO);
    ids.pendente = await criarImovelPronto(ids.dono, `Studio só em análise t1039 ${sufixo}`, { documentoPendente: dono.nome });
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`/qualificar: aprovado sem aviso; envio novo em análise ou recusado à parte; controle sem aviso (${w})`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      const emAnalise = p.getByTestId("documento-novo-em-analise");
      const recusado = p.getByTestId("documento-novo-recusado");

      await p.goto(`/qualificar?imovel=${ids.aprovado}`, { waitUntil: "domcontentloaded" });
      await expect(p.locator('input[type="file"]').first()).toBeAttached({ timeout: 30_000 });
      await expect(p.getByText("Aprovado", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
      await expect(emAnalise).toHaveCount(0);
      await expect(recusado).toHaveCount(0);
      expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

      await p.goto(`/qualificar?imovel=${ids.emAnalise}`, { waitUntil: "domcontentloaded" });
      await expect(emAnalise).toHaveText(EM_ANALISE, { timeout: 30_000 });
      await expect(recusado).toHaveCount(0);

      await p.goto(`/qualificar?imovel=${ids.recusado}`, { waitUntil: "domcontentloaded" });
      await expect(recusado).toHaveText(`${RECUSADO} Motivo: ${MOTIVO}.`, { timeout: 30_000 });
      await expect(emAnalise).toHaveCount(0);
      expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

      await p.goto(`/qualificar?imovel=${ids.pendente}`, { waitUntil: "domcontentloaded" });
      await expect(p.locator('input[type="file"]').first()).toBeAttached({ timeout: 30_000 });
      await expect(emAnalise).toHaveCount(0);
      await expect(recusado).toHaveCount(0);
      await p.context().close();
    });
  }

  test("portão de publicar (0285): aprovado + envio novo em análise publica; só em análise é barrado", async () => {
    const ok = await adm().from("properties").update({ status: "active" }).eq("id", ids.emAnalise!).select("status").single();
    expect(ok.error, "o envio novo não tira a publicação do aprovado").toBeNull();
    expect(ok.data?.status).toBe("active");

    const barrado = await adm().from("properties").update({ status: "active" }).eq("id", ids.pendente!);
    expect(barrado.error?.message ?? "", "sem aprovado, o portão segue barrando").toContain("Documentação do imóvel ainda não aprovada");
    const { data } = await adm().from("properties").select("status").eq("id", ids.pendente!).single();
    expect(data?.status).not.toBe("active");
  });
});
