import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { account, hasAccount } from "../fixtures/accounts";
import { authFile } from "../fixtures/auth";

/**
 * T166 — Selo "Visto" no cartão da /buscar (ordens 8302024d e c7417849, parte b).
 * Inquilino logado com a marca gravada vê o selo no cartão; deslogado nunca vê.
 * A marca é semeada direto no banco e removida no fim (a regra de gravação está no t114).
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const temEnv = !!URL && !!ANON && !!SERVICE && hasAccount("inquilino");
const TAMANHOS = [
  { nome: "390 px", width: 390, height: 844 },
  { nome: "1280 px", width: 1280, height: 800 },
];

test.describe("T166 — Selo Visto na busca", () => {
  test.describe.configure({ mode: "default" });
  test.skip(!temEnv, "Sem URL/chaves do Supabase ou conta de teste do inquilino.");

  let userId = "";
  let imovelIds: string[] = [];

  test.beforeAll(async () => {
    const adm = createClient(URL!, SERVICE!, { auth: { persistSession: false } });
    const a = account("inquilino");
    const sb = createClient(URL!, ANON!, { auth: { persistSession: false } });
    const { data, error } = await sb.auth.signInWithPassword({ email: a.email, password: a.senha });
    if (error) throw new Error(`Login da conta de teste falhou: ${error.message}`);
    userId = data.user!.id;
    // Marca vários imóveis ativos: o mais novo nem sempre está na primeira página da /buscar (lab fc96d3c4).
    const { data: imoveis } = await adm.from("properties").select("id").eq("status", "active").order("created_at", { ascending: false }).limit(60);
    imovelIds = (imoveis ?? []).map((i) => i.id);
    if (!imovelIds.length) throw new Error("Nenhum imóvel ativo para marcar como visto.");
    const agora = new Date().toISOString();
    const ok = await adm.from("imovel_marcas").upsert(
      imovelIds.map((id) => ({ user_id: userId, imovel_id: id, visto_em: agora })),
      { onConflict: "user_id,imovel_id" },
    );
    if (ok.error) throw new Error(ok.error.message);
  });

  test.afterAll(async () => {
    if (!userId || !imovelIds.length) return;
    const adm = createClient(URL!, SERVICE!, { auth: { persistSession: false } });
    await adm.from("imovel_marcas").delete().eq("user_id", userId).in("imovel_id", imovelIds);
  });

  for (const t of TAMANHOS) {
    test.describe(t.nome, () => {
      test.describe("logado", () => {
        test.use({ storageState: authFile("inquilino"), viewport: { width: t.width, height: t.height } });
        test("o cartão do imóvel visto mostra o selo", async ({ page }) => {
          await page.goto("/buscar");
          const selo = page.getByTestId("marca-imovel").filter({ hasText: "Visto" });
          await expect(selo.first()).toBeVisible({ timeout: 20_000 });
          await expect(selo.first()).toHaveText(/Visto/);
        });
      });

      test.describe("deslogado", () => {
        test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: t.width, height: t.height } });
        test("nenhum cartão mostra selo", async ({ page }) => {
          await page.goto("/buscar");
          await expect(page.getByTestId("cartao-total-mes").first()).toBeVisible({ timeout: 20_000 });
          await expect(page.getByTestId("marca-imovel")).toHaveCount(0);
        });
      });
    });
  }
});
