import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { authFile } from "../fixtures/auth";
import { account, hasAccount } from "../fixtures/accounts";

/**
 * T129 — MOTIVO DA ESTADIA NO PERFIL (ordens a8bb8cfa e 9a723929). Conta salva o motivo em 390 e 1280 px,
 * o pedido novo vem pré-preenchido, e valor fora da lista é recusado pelo servidor (check do banco).
 * Devolve o motivo original no fim.
 */
test.describe("T129 — Motivo da estadia no perfil", () => {
  test.use({ storageState: authFile("inquilino") });

  for (const [nome, largura, altura] of [["390 px", 390, 844], ["1280 px", 1280, 800]] as const) {
    test(`Conta salva o motivo e o pedido novo vem pré-preenchido (${nome})`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: altura });
      await page.goto("/dashboard/conta", { waitUntil: "networkidle" });
      const seletor = page.getByTestId("perfil-motivo-estadia");
      await expect(seletor).toBeVisible();
      const original = await seletor.inputValue();
      const novo = original === "viagem_longa" ? "mudanca_familiar" : "viagem_longa";
      try {
        await seletor.selectOption(novo);
        await page.getByRole("button", { name: "Salvar alterações" }).click();
        await expect(page.getByText("Dados salvos.")).toBeVisible();
        await page.reload({ waitUntil: "networkidle" });
        await expect(page.getByTestId("perfil-motivo-estadia")).toHaveValue(novo);

        await page.goto("/pedidos/novo", { waitUntil: "networkidle" });
        const rotulo = novo === "viagem_longa" ? "Viagem longa" : "Mudança familiar";
        await expect(page.getByRole("button", { name: new RegExp(rotulo) }).first()).toBeVisible();
      } finally {
        await page.goto("/dashboard/conta", { waitUntil: "networkidle" });
        await page.getByTestId("perfil-motivo-estadia").selectOption(original);
        await page.getByRole("button", { name: "Salvar alterações" }).click();
        await expect(page.getByText("Dados salvos.")).toBeVisible();
      }
    });
  }

  test("valor fora da lista é recusado pelo servidor", async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    test.skip(!url || !anon || !hasAccount("inquilino"), "Sem URL/chave do Supabase ou conta de teste.");
    const sb = createClient(url!, anon!, { auth: { persistSession: false } });
    const a = account("inquilino");
    const { data, error } = await sb.auth.signInWithPassword({ email: a.email, password: a.senha });
    expect(error).toBeNull();
    const r = await sb.from("profiles").update({ motivo_estadia: "ligue 34 99999-0000" }).eq("id", data.user!.id);
    expect(r.error).not.toBeNull();
  });
});
