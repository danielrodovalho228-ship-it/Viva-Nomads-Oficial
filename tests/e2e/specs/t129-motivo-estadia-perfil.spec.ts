import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { authFile } from "../fixtures/auth";
import { account, hasAccount } from "../fixtures/accounts";

/**
 * L-43 (vigia, 24/10): a Conta não assenta em "networkidle"; espera até 10 s e segue para o elemento.
 * T129 — MOTIVO DA ESTADIA NO PERFIL (ordens a8bb8cfa e 9a723929). E64 (QA 24/10): Meus dados não tem mais o
 * seletor (390 e 1280 px); o motivo gravado no perfil ainda pré-preenche o pedido novo, e valor fora da lista é
 * recusado pelo servidor (check do banco). Devolve o motivo original no fim.
 */
test.describe("T129 — Motivo da estadia no perfil", () => {
  test.use({ storageState: authFile("inquilino") });
  // Os dois tamanhos de tela salvam e restauram o motivo da MESMA conta: em paralelo um desfazia o do outro.
  test.describe.configure({ mode: "serial" });

  for (const [nome, largura, altura] of [["390 px", 390, 844], ["1280 px", 1280, 800]] as const) {
    test(`E64: Meus dados sem o seletor; o motivo do perfil ainda pré-preenche o pedido novo (${nome})`, async ({ page }) => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      test.skip(!url || !anon || !hasAccount("inquilino"), "Sem URL/chave do Supabase ou conta de teste.");
      await page.setViewportSize({ width: largura, height: altura });
      // E64 (QA 24/10): o motivo saiu de Meus dados (o desenho perfil-04 não tem); ele é perguntado no próprio pedido.
      await page.goto("/dashboard/conta/dados", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await expect(page.getByTestId("meus-dados")).toBeVisible();
      await expect(page.getByTestId("perfil-motivo-estadia")).toHaveCount(0);

      const sb = createClient(url!, anon!, { auth: { persistSession: false } });
      const a = account("inquilino");
      const { data } = await sb.auth.signInWithPassword({ email: a.email, password: a.senha });
      const id = data.user!.id;
      const original = ((await sb.from("profiles").select("motivo_estadia").eq("id", id).single()).data?.motivo_estadia as string | null) ?? null;
      const novo = original === "viagem_longa" ? "mudanca_familiar" : "viagem_longa";
      try {
        expect((await sb.from("profiles").update({ motivo_estadia: novo }).eq("id", id)).error).toBeNull();
        await page.goto("/pedidos/novo", { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
        // Prompt 12: o motivo é um select nativo, pré-preenchido com o do perfil.
        await expect(page.getByTestId("pedido-motivo")).toHaveValue(novo);
      } finally {
        await sb.from("profiles").update({ motivo_estadia: original }).eq("id", id);
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
