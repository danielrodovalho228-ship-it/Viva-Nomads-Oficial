import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { authFile } from "../fixtures/auth";

/**
 * T29 — O chat da Central NÃO aceita aprovação. "Ok, tudo aprovado" para o
 * Otávio (ou o Moacir) recebe a resposta que manda para os cartões Aprovar/Recusar e nada é gravado como ordem.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.describe("T29 — Chat sem falsas aprovações", () => {
  test.use({ storageState: authFile("admin") });

  for (const nome of ["Otávio", "Moacir"]) {
    test(`'Ok, tudo aprovado' para o ${nome}: não aprova nada e não cria ordem`, async ({ page }) => {
      test.skip(!URL || !SERVICE, "Precisa da service role do laboratório.");
      const adm = createClient(URL!, SERVICE!, { auth: { persistSession: false } });
      const { count: antes } = await adm.from("agentes_ordens").select("id", { count: "exact", head: true });
      await page.goto("/admin/agentes", { waitUntil: "networkidle" });
      await page.getByRole("tab", { name: "Conversar" }).click();
      await page.locator('aside[aria-label="Agentes"]').getByRole("button", { name: new RegExp(nome) }).click();
      const resp = page.getByText(/Daqui do chat eu não aprovo por texto/);
      const n = await resp.count();
      await page.getByPlaceholder(`Escreva para ${nome}…`).fill("Ok, tudo aprovado");
      await page.getByRole("button", { name: "Enviar" }).click();
      await expect(resp).toHaveCount(n + 1, { timeout: 15_000 });
      // O texto muda com 0, 1 ou vários cartões pendentes (respostaAprovacaoNoChat), mas a regra é fixa.
      await expect(resp.last()).toContainText("Daqui do chat eu não aprovo por texto.");
      await expect(resp.last()).not.toContainText("SQL Editor");
      const { count: depois } = await adm.from("agentes_ordens").select("id", { count: "exact", head: true });
      expect(depois).toBe(antes);
    });
  }
});
