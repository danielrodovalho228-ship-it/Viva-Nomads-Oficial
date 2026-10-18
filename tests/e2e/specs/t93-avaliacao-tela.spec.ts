import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { account, hasAccount, type Role } from "../fixtures/accounts";
import { authFile } from "../fixtures/auth";

/**
 * T93 — a TELA da avaliação recebida (ordem 404cd213 item 4, achado do Moacir no #550). Cliques de verdade:
 *  - o avaliado abre /dashboard/avaliacoes (390 px, sem rolagem lateral), clica "Responder" e a resposta aparece;
 *  - clica "Pedir revisão", escolhe o motivo e o pedido fica "em análise";
 *  - o admin abre /admin/avaliacoes, vê o pedido e clica "Manter no ar": o pedido vira "Mantida".
 * O T91 cobre as regras no banco; aqui é o que a pessoa vê e clica.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const temEnv = !!URL && !!ANON && !!SERVICE && hasAccount("inquilino") && hasAccount("proprietario") && hasAccount("admin");

const cliente = (chave = ANON!): SupabaseClient => createClient(URL!, chave, { auth: { persistSession: false } });
async function logado(papel: Role): Promise<{ sb: SupabaseClient; id: string }> {
  const sb = cliente();
  const a = account(papel);
  const { data, error } = await sb.auth.signInWithPassword({ email: a.email, password: a.senha });
  if (error) throw new Error(`Login da conta de teste falhou: ${error.message}`);
  return { sb, id: data.user!.id };
}

test.describe("T93 — Tela de avaliações recebidas (responder, pedir revisão, admin decide)", () => {
  test.skip(!temEnv, "Sem URL/chaves do Supabase ou contas de teste.");
  test.use({ storageState: temEnv ? authFile("proprietario") : undefined, viewport: { width: 390, height: 844 } });

  test("avaliado responde e pede revisão pela tela; admin mantém no ar pela tela", async ({ page, browser }) => {
    test.setTimeout(150_000);
    const adm = cliente(SERVICE!);
    const inq = await logado("inquilino");
    const dono = await logado("proprietario");
    const { data: imovel } = await adm.from("properties").select("id").eq("owner_id", dono.id).eq("status", "active").limit(1).single();
    const marca = Array.from({ length: 8 }, () => "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]).join("");
    const { data: ct } = await adm
      .from("contratos")
      .insert({ property_id: imovel!.id, tenant_id: inq.id, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3000, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 240, qtd_ocupantes: 1, status: "concluido", garantia: "caucao", encerrado_em: new Date(Date.now() - 24 * 3600_000).toISOString() })
      .select("id")
      .single();
    try {
      await inq.sb.from("avaliacoes").insert({ contrato_id: ct!.id, alvo_id: dono.id, papel_autor: "inquilino", nota_geral: 4, comentario_publico: `Estadia boa ${marca}`, status: "enviada" });
      await dono.sb.from("avaliacoes").insert({ contrato_id: ct!.id, alvo_id: inq.id, papel_autor: "proprietario", nota_geral: 5, status: "enviada" });

      // 1) O avaliado responde pela tela.
      await page.goto("/dashboard/avaliacoes", { waitUntil: "networkidle" });
      const cartao = page.getByTestId("avaliacao-recebida").filter({ hasText: marca });
      await expect(cartao).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await cartao.getByTestId("avaliacao-responder").click();
      await cartao.getByLabel(/sua resposta/i).fill(`Obrigado pela estadia ${marca}`);
      await cartao.getByTestId("avaliacao-enviar").click();
      // A resposta grava no servidor e a tela recarrega: no lab lento passa de 10 s. Se não vier, mostra o que a tela disse.
      await expect(cartao.getByTestId("avaliacao-resposta"), `alerta da tela: ${await cartao.getByRole("alert").allTextContents()}`).toContainText(`Obrigado pela estadia ${marca}`, { timeout: 30_000 });

      // 2) Pede revisão pela tela.
      await cartao.getByTestId("avaliacao-pedir-revisao").click();
      await cartao.getByLabel("Motivo", { exact: true }).selectOption("fato_falso");
      await cartao.getByLabel(/explique o motivo/i).fill(`O comentário cita um fato que não aconteceu ${marca}, tenho comprovação`);
      await cartao.getByTestId("avaliacao-enviar").click();
      await expect(cartao.getByTestId("revisao-em-analise")).toBeVisible({ timeout: 30_000 });

      // 3) O admin decide pela tela.
      const ctxAdmin = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 800 } });
      try {
        const pa = await ctxAdmin.newPage();
        await pa.goto("/admin/avaliacoes", { waitUntil: "networkidle" });
        const pedido = pa.locator("li").filter({ hasText: marca });
        await expect(pedido).toBeVisible();
        await pedido.getByLabel(/justificativa/i).fill("Conferido: o comentário é opinião sobre a estadia.");
        await pedido.getByRole("button", { name: /manter no ar/i }).click();
        await expect(pedido).toContainText("Mantida", { timeout: 30_000 });
      } finally {
        await ctxAdmin.close();
      }
      const { data: dec } = await adm.from("avaliacao_contestacoes").select("status").eq("detalhe", `O comentário cita um fato que não aconteceu ${marca}, tenho comprovação`).single();
      expect(dec!.status).toBe("mantida");
    } finally {
      await adm.from("contratos").delete().eq("id", ct!.id);
    }
  });
});
