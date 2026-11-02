import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T996 — E267 resíduo (#2209): quando a moderação oculta um pedido de moradia, o e-mail ao morador diz QUAL pedido
 * (cidade e entrada) e o motivo — antes era só "seu pedido foi ocultado". Pela tela real do admin (/admin/pedidos no recorte Teste,
 * botão "Ocultar" e o diálogo do motivo, 1280) e pela caixa de testes (conta is_teste → emails_teste):
 *   1. o pedido vira removido_admin com o motivo; a linha do admin mostra "Motivo: …" (1280 e 390, sem rolagem lateral);
 *   2. o e-mail "pedido_moderado" chega com o assunto "Seu pedido em Uberlândia foi ocultado" e o corpo com a cidade, a
 *      entrada (dd/mm/aaaa) e o motivo; e sem prometer que o pedido volta.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const inq = { email: `inq.t996.${sufixo}@lab.vivanomads.test`, nome: "Telma Moderada Souza", role: "tenant" as const };
const ids: { inq?: string; pedido?: string } = {};
const ENTRADA = new Date(Date.now() - 3 * 3_600_000 + 25 * 86_400_000).toISOString().slice(0, 10);
const ENTRADA_BR = ENTRADA.split("-").reverse().join("/");
// O recorte padrão de /admin/pedidos é "Real" (contas de teste fora); a moradora é conta de teste (a caixa emails_teste).
const LISTA = "/admin/pedidos?tipo=teste";
const MOTIVO = `Texto com contato direto, contra as regras (t996 ${sufixo})`;

test.describe("T996 — E267 resíduo: o pedido ocultado pela moderação diz qual pedido e o motivo", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ is_teste: true, notif_email: true }).eq("id", ids.inq);
    const { data, error } = await adm()
      .from("pedidos_moradia")
      .insert({ inquilino_id: ids.inq, cidade: "Uberlândia", uf: "MG", data_inicio: ENTRADA, prazo_meses: 3, orcamento_mensal: 3500, qtd_ocupantes: 1, motivo: "trabalho_remoto", bairros: ["Centro"], quartos_min: 1 })
      .select("id")
      .single();
    if (error) throw error;
    ids.pedido = (data as { id: string }).id;
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    if (ids.inq) {
      await adm().from("emails_teste").delete().eq("usuario_id", ids.inq);
      await adm().from("pedidos_moradia").delete().eq("inquilino_id", ids.inq);
    }
    await apagarContas([ids.inq]);
  });

  test("1. o admin oculta com motivo; a linha mostra o motivo (1280 e 390)", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(LISTA, { waitUntil: "domcontentloaded" });
    const linha = page.locator(`[data-testid="admin-pedido-linha"][data-pedido="${ids.pedido}"]`);
    await expect(linha).toBeVisible({ timeout: 30_000 });
    await page.locator("tr", { has: linha }).getByRole("button", { name: "Ocultar" }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo).toContainText("Ocultar pedido");
    await dialogo.locator("#motivo-texto").fill(MOTIVO);
    await dialogo.getByRole("button", { name: "Ocultar", exact: true }).click();
    await expect
      .poll(async () => (await adm().from("pedidos_moradia").select("status, removido_motivo").eq("id", ids.pedido!).single()).data, { timeout: 20_000 })
      .toEqual({ status: "removido_admin", removido_motivo: MOTIVO });
    for (const w of [1280, 390] as const) {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.goto(LISTA, { waitUntil: "domcontentloaded" });
      const tr = page.locator("tr", { has: page.locator(`[data-testid="admin-pedido-linha"][data-pedido="${ids.pedido}"]`) });
      await expect(tr).toContainText(`Motivo: ${MOTIVO}`, { timeout: 30_000 });
      await expect(tr.getByRole("button", { name: "Reativar" })).toBeVisible();
    }
    await ctx.close();
  });

  test("2. o e-mail ao morador diz qual pedido (cidade e entrada) e o motivo", async () => {
    let m: { assunto: string; corpo: string } | undefined;
    await expect
      .poll(async () => {
        const { data } = await adm().from("emails_teste").select("assunto, corpo").eq("usuario_id", ids.inq!).eq("evento", "pedido_moderado").order("criado_em");
        m = (data ?? [])[0] as typeof m;
        return (data ?? []).length;
      }, { timeout: 45_000, message: "o e-mail pedido_moderado precisa chegar à caixa de testes" })
      .toBe(1);
    expect(m!.assunto).toBe("Seu pedido em Uberlândia foi ocultado");
    expect(m!.corpo).toContain(`a moderação ocultou o seu pedido de moradia em Uberlândia (entrada em ${ENTRADA_BR})`);
    expect(m!.corpo).toContain("Ele não aparece mais aos proprietários.");
    expect(m!.corpo).toContain(MOTIVO);
    expect(m!.corpo).not.toMatch(/volta a aparecer|será reativado/i);
  });
});
