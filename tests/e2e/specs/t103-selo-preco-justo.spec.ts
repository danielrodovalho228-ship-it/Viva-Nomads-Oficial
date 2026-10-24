import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { account, hasAccount } from "../fixtures/accounts";

/**
 * Rodada da vigia 24/10 (Pista C): triagem do lab completo de 5f44161, no lab-crítico, sem a carga do lab inteiro.
 * T103 — Selo "Preço justo" no anúncio e no cartão (ordem 4c74ac38, item 2; achado do Moacir no #567).
 * Caso positivo: equivalente mensal do Airbnb ACIMA do valor mensal → selo no /imoveis/<id> e no cartão de /buscar.
 * Caso negativo: equivalente ABAIXO (ou ausente) → sem selo. Restaura o valor original no fim.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const temEnv = !!URL && !!SERVICE && hasAccount("proprietario");

test.describe("T103 — Selo Preço justo", () => {
  test.skip(!temEnv, "Sem URL/chave de serviço ou conta de teste.");
  test.use({ viewport: { width: 390, height: 844 } });

  test("aparece só quando o Airbnb informado é maior que o valor mensal", async ({ page }) => {
    test.setTimeout(480_000);
    const adm = createClient(URL!, SERVICE!, { auth: { persistSession: false } });
    const a = account("proprietario");
    const { data: u } = await adm.from("profiles").select("id").eq("email", a.email).single();
    const { data: imovel } = await adm
      .from("properties").select("id, monthly_price, airbnb_monthly_price").eq("owner_id", u!.id).eq("status", "active").limit(1).single();
    const id = imovel!.id as string;
    const mensal = Number(imovel!.monthly_price);
    const selo = page.getByTestId("selo-preco-justo");
    // A página pública revalida a cada 60 s (ISR serve a cópia velha uma vez antes de refazer): dá folga de 150 s por passo.
    const confere = async (visivel: boolean) =>
      expect(async () => {
        await page.goto(`/imoveis/${id}`, { waitUntil: "networkidle" });
        await expect(selo).toHaveCount(visivel ? 1 : 0);
      }).toPass({ timeout: 150_000, intervals: [5_000] });
    try {
      await adm.from("properties").update({ airbnb_monthly_price: mensal + 500 }).eq("id", id);
      await confere(true);
      await expect(selo).toBeVisible();
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(sobra).toBeLessThanOrEqual(0);

      await adm.from("properties").update({ airbnb_monthly_price: Math.max(1, mensal - 1) }).eq("id", id);
      await confere(false);

      await adm.from("properties").update({ airbnb_monthly_price: null }).eq("id", id);
      await confere(false);
    } finally {
      await adm.from("properties").update({ airbnb_monthly_price: imovel!.airbnb_monthly_price }).eq("id", id);
    }
  });
});
