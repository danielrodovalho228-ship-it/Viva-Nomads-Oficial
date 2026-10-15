import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { account, hasAccount, type Role } from "../fixtures/accounts";

/**
 * T91 — RESPOSTA PÚBLICA e PEDIDO DE REVISÃO de avaliação (0129, ordem 404cd213 item 4). Direto no PostgREST:
 *  - quem NÃO é o avaliado não responde (42501);
 *  - o avaliado responde UMA vez; contato no texto é recusado;
 *  - anônimo lê a resposta, mas nunca o autor_id;
 *  - o avaliado pede revisão (uma aberta por vez); quem não é o avaliado, não;
 *  - o pedido aparece na fila do admin (tabela) e a página do anúncio mostra a resposta.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const temEnv = !!URL && !!ANON && !!SERVICE && hasAccount("inquilino") && hasAccount("proprietario");

const cliente = (chave = ANON!): SupabaseClient => createClient(URL!, chave, { auth: { persistSession: false } });
async function logado(papel: Role): Promise<{ sb: SupabaseClient; id: string }> {
  const sb = cliente();
  const a = account(papel);
  const { data, error } = await sb.auth.signInWithPassword({ email: a.email, password: a.senha });
  if (error) throw new Error(`Login da conta de teste falhou: ${error.message}`);
  return { sb, id: data.user!.id };
}

test.describe("T91 — Resposta e revisão de avaliação (0129)", () => {
  test.skip(!temEnv, "Sem URL/chaves do Supabase ou contas de teste.");

  test("só o avaliado responde (uma vez, sem contato) e pede revisão; anônimo não vê o autor", async ({ page }) => {
    test.setTimeout(150_000);
    const adm = cliente(SERVICE!);
    const inq = await logado("inquilino");
    const dono = await logado("proprietario");
    const { data: imovel } = await adm.from("properties").select("id").eq("owner_id", dono.id).eq("status", "active").limit(1).single();
    const base = { property_id: imovel!.id, tenant_id: inq.id, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3000, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 240, qtd_ocupantes: 1, status: "concluido", garantia: "caucao" };
    const { data: ct } = await adm.from("contratos").insert({ ...base, encerrado_em: new Date(Date.now() - 24 * 3600_000).toISOString() }).select("id").single();
    const marca = Array.from({ length: 8 }, () => "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]).join("");
    try {
      // As duas partes avaliam (às cegas) → a do inquilino sobre o dono fica publicada.
      await inq.sb.from("avaliacoes").insert({ contrato_id: ct!.id, alvo_id: dono.id, papel_autor: "inquilino", nota_geral: 4, comentario_publico: `Bom imóvel ${marca}`, status: "enviada" });
      await dono.sb.from("avaliacoes").insert({ contrato_id: ct!.id, alvo_id: inq.id, papel_autor: "proprietario", nota_geral: 5, status: "enviada" });
      const { data: av } = await adm.from("avaliacoes").select("id, status").eq("contrato_id", ct!.id).eq("alvo_id", dono.id).single();
      expect(av!.status).toBe("publicada");

      // Quem não é o avaliado não responde nem pede revisão.
      const intruso = await inq.sb.from("avaliacao_respostas").insert({ avaliacao_id: av!.id, texto: "Resposta de quem não é o avaliado" });
      expect(intruso.error?.code).toBe("42501");
      const intrusoRev = await inq.sb.from("avaliacao_contestacoes").insert({ avaliacao_id: av!.id, motivo: "ofensa", detalhe: "Pedido de quem não é o avaliado, deve falhar" });
      expect(intrusoRev.error?.code).toBe("42501");

      // O avaliado responde: contato é recusado; texto limpo passa; segunda resposta não.
      const comContato = await dono.sb.from("avaliacao_respostas").insert({ avaliacao_id: av!.id, texto: "Me chame no whats 34 99999-1234" });
      expect(comContato.error).not.toBeNull();
      const ok = await dono.sb.from("avaliacao_respostas").insert({ avaliacao_id: av!.id, texto: `Obrigado pela estadia ${marca}` });
      expect(ok.error).toBeNull();
      const dup = await dono.sb.from("avaliacao_respostas").insert({ avaliacao_id: av!.id, texto: "Segunda resposta" });
      expect(dup.error?.code).toBe("23505");

      // Anônimo lê o texto, nunca o autor_id.
      const anon = cliente();
      const lida = await anon.from("avaliacao_respostas").select("texto").eq("avaliacao_id", av!.id);
      expect(lida.data).toEqual([{ texto: `Obrigado pela estadia ${marca}` }]);
      const autor = await anon.from("avaliacao_respostas").select("autor_id").limit(1);
      expect(autor.error?.message ?? "").toMatch(/permission denied/);

      // Pedido de revisão: uma aberta por vez; entra na fila do admin.
      const rev = await dono.sb.from("avaliacao_contestacoes").insert({ avaliacao_id: av!.id, motivo: "fato_falso", detalhe: "O comentário cita um fato que não aconteceu, tenho comprovação" });
      expect(rev.error).toBeNull();
      const rev2 = await dono.sb.from("avaliacao_contestacoes").insert({ avaliacao_id: av!.id, motivo: "ofensa", detalhe: "Segundo pedido enquanto o primeiro está aberto" });
      expect(rev2.error?.code).toBe("23505");
      const fila = await adm.from("avaliacao_contestacoes").select("status, motivo").eq("avaliacao_id", av!.id);
      expect(fila.data).toEqual([{ status: "aberta", motivo: "fato_falso" }]);

      // A página do anúncio mostra a resposta junto da avaliação (cache de 60 s: recarrega até entrar).
      await page.goto(`/imoveis/${imovel!.id}`, { waitUntil: "networkidle" });
      await expect(async () => {
        await page.reload({ waitUntil: "networkidle" });
        await expect(page.getByTestId("avaliacao-resposta").filter({ hasText: `Obrigado pela estadia ${marca}` })).toBeVisible({ timeout: 2_000 });
      }).toPass({ intervals: [1_000, 5_000, 10_000], timeout: 75_000 });
    } finally {
      await adm.from("contratos").delete().eq("id", ct!.id);
    }
  });
});
