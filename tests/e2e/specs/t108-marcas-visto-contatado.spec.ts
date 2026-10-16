import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { account, hasAccount, type Role } from "../fixtures/accounts";

/**
 * T108 — MARCAS "VISTO / VOCÊ JÁ CONTATOU" (0134, ordem 8302024d). Direto no PostgREST:
 *  - o inquilino grava e lê a própria marca;
 *  - o proprietário (outra conta) não vê a marca do inquilino (RLS);
 *  - anônimo não lê nada;
 *  - ninguém grava marca em nome de outro usuário.
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

test.describe("T108 — Marcas Visto / contatou (0134)", () => {
  test.skip(!temEnv, "Sem URL/chaves do Supabase ou contas de teste.");

  test("cada usuário vê só as próprias marcas", async () => {
    const adm = cliente(SERVICE!);
    const inq = await logado("inquilino");
    const dono = await logado("proprietario");
    const { data: imovel } = await adm.from("properties").select("id").eq("status", "active").limit(1).single();
    try {
      const agora = new Date().toISOString();
      const ok = await inq.sb.from("imovel_marcas").upsert({ user_id: inq.id, imovel_id: imovel!.id, visto_em: agora }, { onConflict: "user_id,imovel_id" });
      expect(ok.error).toBeNull();
      const minhas = await inq.sb.from("imovel_marcas").select("imovel_id, visto_em").eq("imovel_id", imovel!.id);
      expect(minhas.data?.length).toBe(1);
      const doOutro = await dono.sb.from("imovel_marcas").select("imovel_id").eq("user_id", inq.id);
      expect(doOutro.data ?? []).toHaveLength(0);
      const anon = await cliente().from("imovel_marcas").select("imovel_id").limit(5);
      expect(anon.data ?? []).toHaveLength(0);
      const forjada = await dono.sb.from("imovel_marcas").insert({ user_id: inq.id, imovel_id: imovel!.id, visto_em: agora });
      expect(forjada.error).not.toBeNull();
    } finally {
      await adm.from("imovel_marcas").delete().eq("user_id", inq.id).eq("imovel_id", imovel!.id);
    }
  });
});
