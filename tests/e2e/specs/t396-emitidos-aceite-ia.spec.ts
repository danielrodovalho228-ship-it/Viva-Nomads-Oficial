import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { TERMO_IA_VERSAO } from "../../../src/lib/anuncio/termo-ia";

/*
  T396 — L2-B itens 14 e 23 (migração 0241), 390 e 1280 px.
   1. item 23: dono sem aceite no servidor vê a caixa do termo de IA no editor; com o aceite da versão atual gravado,
      vê a linha "Você já aceitou…" e o Publicar não depende da caixa; versão antiga não vale.
   2. item 14: admin › Documentos › aba "Emitidos": lista com número, tipo, destinatário mascarado e status do envio;
      filtro por tipo; documento entregue na plataforma (sem e-mail) não tem "Reenviar e-mail".
*/
const SAIDA = "tests/laboratorio/saida";

test.describe("T396 — Emitidos e aceite do termo de IA (L2-B 14 e 23)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t396.${sufixo}@lab.vivanomads.test`, nome: "Tereza Termo", role: "owner" as const };
  const ids: Record<string, string> = {};

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Termo t396 ${sufixo}`);
  });

  test.afterAll(async () => {
    if (ids.registro) await adm().from("documentos_registro").delete().eq("id", ids.registro);
    await apagarContas([ids.dono]);
  });

  test("1. termo de IA: caixa até aceitar; com o aceite da versão atual no servidor, só a linha", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await adm().from("termo_ia_aceites").delete().eq("user_id", ids.dono);
    await p.goto(`/dashboard/imoveis/${ids.imovel}/editar`, { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("aceite-ia").getByRole("checkbox")).toBeVisible({ timeout: 20_000 });
    // Versão antiga gravada: continua pedindo.
    await adm().from("termo_ia_aceites").insert({ user_id: ids.dono, versao: "2025-01-01" });
    await p.reload({ waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("aceite-ia").getByRole("checkbox")).toBeVisible({ timeout: 20_000 });
    // Versão atual: a caixa some e a linha aparece.
    await adm().from("termo_ia_aceites").insert({ user_id: ids.dono, versao: TERMO_IA_VERSAO });
    await p.reload({ waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("aceite-ia-ja-aceito")).toContainText("Você já aceitou o termo", { timeout: 20_000 });
    await expect(p.getByTestId("aceite-ia")).toHaveCount(0);
    await p.screenshot({ path: `${SAIDA}/t396-termo-ja-aceito-390.png`, fullPage: true });
    await p.context().close();
  });

  test.describe("admin", () => {
    test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
    test.use({ storageState: authFile("admin") });

    test("2. aba Emitidos: número, tipo, destinatário mascarado, status; filtro por tipo; sem e-mail não reenvia", async ({ page }) => {
      const { data, error } = await adm()
        .from("documentos_registro")
        .insert({ prefixo: "ORC", numero: `ORC-T396-${sufixo}`, tipo: "proposta", ref_tabela: "propostas", ref_id: ids.imovel, partes: [ids.dono], is_teste: true })
        .select("id")
        .single();
      if (error) throw error;
      ids.registro = data.id;
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto("/admin/documentos?aba=emitidos&tipo=ORC", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("documentos-aba-emitidos")).toHaveAttribute("aria-current", "page");
      const linha = page.getByTestId("emitido").filter({ hasText: `ORC-T396-${sufixo}` });
      await expect(linha).toBeVisible({ timeout: 20_000 });
      await expect(linha.getByTestId("emitido-destinatarios")).toContainText("***@lab.vivanomads.test");
      await expect(linha.getByTestId("emitido-destinatarios")).not.toContainText(dono.email);
      await expect(linha.getByTestId("emitido-envio")).toHaveAttribute("data-chave", "sem_email");
      await expect(linha.getByTestId("emitido-reenviar")).toHaveCount(0);
      // Filtro por tipo: só ORC na lista.
      for (const prefixo of await page.getByTestId("emitido").evaluateAll((els) => els.map((e) => e.getAttribute("data-prefixo")))) expect(prefixo).toBe("ORC");
      await page.screenshot({ path: `${SAIDA}/t396-emitidos-1280.png`, fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: `${SAIDA}/t396-emitidos-390.png`, fullPage: true });
    });
  });
});
