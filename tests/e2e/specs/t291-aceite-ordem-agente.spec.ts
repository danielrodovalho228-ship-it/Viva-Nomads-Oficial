import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { adm, NO_LABORATORIO } from "../fixtures/laboratorio";

/**
 * T291 — ACEITE NAS ORDENS DOS AGENTES (ordem 3c3d8a9e, parte 2): ordem criada pelo admin e concluída pelo agente
 * mostra "Aguardando seu aceite"; "Reabrir" exige o que falta e devolve a ordem a "pendente"; "Aceito" encerra.
 * Outra pessoa não aceita. Só no laboratório (precisa do banco local para fazer o papel do agente).
 */
test.describe("T291 — Aceite nas ordens dos agentes", () => {
  test.skip(!NO_LABORATORIO, "Só roda no laboratório (banco local).");
  test.use({ storageState: authFile("admin") });

  test("concluída → aguardando aceite → reabrir → aceito, e quem não criou não aceita", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const { data: eu } = await adm().from("profiles").select("id").eq("role", "admin").limit(1).single();
    const texto = `Ordem do aceite ${Date.now()}`;
    const { data: ordem } = await adm()
      .from("agentes_ordens")
      .insert({ agente_slug: "renato", texto, criado_por: eu!.id, status: "concluida" })
      .select("id")
      .single();
    const id = ordem!.id as string;
    try {
      const abrir = async () => {
        await page.goto("/admin/agentes", { waitUntil: "networkidle" });
        await page.getByRole("tab", { name: "Conversar" }).click();
        await page.locator('aside[aria-label="Agentes"]').getByRole("button", { name: /Renato/ }).click();
        await expect(page.getByTestId("chat-carregando")).toHaveCount(0, { timeout: 20_000 });
        return page.locator('[data-testid="ordem"]').filter({ hasText: texto });
      };
      let cartao = await abrir();
      await expect(cartao.getByTestId("aceite-ordem").getByText("Aguardando seu aceite")).toBeVisible();

      await cartao.getByRole("button", { name: "Reabrir", exact: true }).click();
      await expect(cartao.getByRole("button", { name: "Reabrir com este texto" })).toBeDisabled();
      await cartao.getByLabel("O que falta?").fill("Faltou o print da tela.");
      await cartao.getByRole("button", { name: "Reabrir com este texto" }).click();
      await expect(cartao.getByTestId("ordem-reaberta")).toContainText("Faltou o print da tela.");
      const aberta = (await adm().from("agentes_ordens").select("status, texto, reaberto_motivo").eq("id", id).single()).data;
      expect(aberta).toMatchObject({ status: "pendente", reaberto_motivo: "Faltou o print da tela." });
      expect(aberta?.texto).toContain("o que falta: Faltou o print da tela.");

      // O agente entrega de novo (service role) e a ordem volta a aguardar o aceite.
      await adm().from("agentes_ordens").update({ status: "concluida" }).eq("id", id);
      cartao = await abrir();
      await cartao.getByRole("button", { name: "Aceito", exact: true }).click();
      await expect(cartao.getByTestId("aceite-ordem")).toHaveCount(0);
      const aceita = (await adm().from("agentes_ordens").select("status, aceito_por, aceito_em").eq("id", id).single()).data;
      expect(aceita?.status).toBe("concluida");
      expect(aceita?.aceito_por).toBe(eu!.id);
      expect(aceita?.aceito_em).toBeTruthy();

      // Outro criador: sem botões para mim.
      const { data: outro } = await adm().from("profiles").select("id").neq("id", eu!.id).limit(1).single();
      await adm().from("agentes_ordens").update({ criado_por: outro!.id, aceito_em: null, aceito_por: null }).eq("id", id);
      cartao = await abrir();
      await expect(cartao.getByText("Aguardando o aceite de quem criou a ordem.")).toBeVisible();
      await expect(cartao.getByRole("button", { name: "Aceito", exact: true })).toHaveCount(0);

      await page.setViewportSize({ width: 390, height: 800 });
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(sobra).toBeLessThanOrEqual(1);
    } finally {
      await adm().from("agentes_ordens").delete().eq("id", id);
    }
  });
});
