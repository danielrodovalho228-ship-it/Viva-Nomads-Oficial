import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { account, hasAccount } from "../fixtures/accounts";

/**
 * Rodada da vigia 24/10 (Pista C): triagem do lab completo de 5f44161, no lab-crítico, sem a carga do lab inteiro.
 * T103 — Selo "Preço justo" no anúncio e no cartão (ordem 4c74ac38, item 2; achado do Moacir no #567).
 * E399-B: o selo compara o TOTAL POR MÊS (valor mensal + condomínio + contas fixas + limpeza) com o equivalente do Airbnb,
 * com "≤". Caso positivo: equivalente IGUAL ao total → selo na página. Casos sem selo (conferidos na coluna gerada, sem
 * depender do ISR): "contas à parte" (equivalente entre o valor mensal e o total, antes ganhava), abaixo do valor mensal
 * e ausente. Restaura o valor original no fim.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const temEnv = !!URL && !!SERVICE && hasAccount("proprietario");

test.describe("T103 — Selo Preço justo", () => {
  test.skip(!temEnv, "Sem URL/chave de serviço ou conta de teste.");
  test.use({ viewport: { width: 390, height: 844 } });

  test("aparece só quando o total por mês não passa do Airbnb informado (E399-B)", async ({ page }) => {
    test.setTimeout(480_000);
    const adm = createClient(URL!, SERVICE!, { auth: { persistSession: false } });
    const a = account("proprietario");
    const { data: u } = await adm.from("profiles").select("id").eq("email", a.email).single();
    const { data: imovel } = await adm
      .from("properties").select("id, monthly_price, condo_fee, utilities_mode, utilities_estimate, limpeza_estadia, airbnb_monthly_price").eq("owner_id", u!.id).eq("status", "active").limit(1).single();
    const id = imovel!.id as string;
    const mensal = Number(imovel!.monthly_price);
    const limpeza = Number((imovel!.limpeza_estadia as { valorMes?: unknown } | null)?.valorMes);
    // O total por mês do cartão (a mesma conta da coluna gerada da 0277).
    const total =
      mensal + Number(imovel!.condo_fee ?? 0) + (imovel!.utilities_mode === "fixed" ? Number(imovel!.utilities_estimate ?? 0) : 0) + (Number.isFinite(limpeza) && limpeza > 0 ? limpeza : 0);
    const selo = page.getByTestId("selo-preco-justo");
    // A página pública revalida a cada 60 s (ISR serve a cópia velha uma vez antes de refazer): dá folga de 150 s por passo.
    const confere = async (visivel: boolean) =>
      expect(async () => {
        await page.goto(`/imoveis/${id}`, { waitUntil: "networkidle" });
        await expect(selo).toHaveCount(visivel ? 1 : 0);
      }).toPass({ timeout: 150_000, intervals: [5_000] });
    try {
      await adm.from("properties").update({ airbnb_monthly_price: total }).eq("id", id);
      await confere(true);
      await expect(selo).toBeVisible();
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(sobra).toBeLessThanOrEqual(0);

      // Os casos SEM selo são conferidos na coluna gerada `preco_justo` (determinístico). A página pública revalida por
      // ISR (60 s) e a troca de "com selo" para "sem selo" depois de um update direto no banco às vezes passava dos
      // 150 s no lab-critico (falhava na 1ª tentativa e passava na repetição — #1995 e #2000). A regra é do banco; a
      // página já provou acima que mostra o selo quando a coluna diz que sim.
      const semSelo = async (airbnb: number | null) => {
        await adm.from("properties").update({ airbnb_monthly_price: airbnb }).eq("id", id);
        const { data: linha } = await adm.from("properties").select("preco_justo").eq("id", id).single();
        expect(linha!.preco_justo, `Airbnb ${airbnb} contra total ${total}`).toBe(false);
      };
      // Contas à parte: o equivalente cobre o valor mensal, mas não o total → sem selo (o bug do E399-B dava o selo).
      if (total > mensal) await semSelo(mensal + (total - mensal) / 2);
      await semSelo(Math.max(1, mensal - 1));
      await semSelo(null);
    } finally {
      await adm.from("properties").update({ airbnb_monthly_price: imovel!.airbnb_monthly_price }).eq("id", id);
    }
  });
});
