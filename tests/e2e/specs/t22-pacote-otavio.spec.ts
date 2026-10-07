import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { account, hasAccount } from "../fixtures/accounts";

/**
 * T22 — Pacote do Otávio (migração 0083). Sem navegador: fala direto com o
 * PostgREST, como um atacante com a chave anon (que é pública).
 *
 *  #29/#25  anon não lê o mural de pedidos (função DEFINER nem view); logado lê.
 *
 * Sem env (URL/anon key/conta de teste), o teste é pulado.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const temEnv = !!URL && !!ANON && hasAccount("proprietario");

const cliente = (chave = ANON!): SupabaseClient => createClient(URL!, chave, { auth: { persistSession: false } });

async function logado(papel: "inquilino" | "proprietario"): Promise<SupabaseClient> {
  const sb = cliente();
  const a = account(papel);
  const { error } = await sb.auth.signInWithPassword({ email: a.email, password: a.senha });
  if (error) throw new Error(`Login da conta de teste falhou: ${error.message}`);
  return sb;
}

test.describe("T22 pacote do Otávio (0083) @seguranca", () => {
  test.skip(!temEnv, "Sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY ou conta de teste do proprietário.");

  test("#29/#25: anon não executa pedidos_publicos_lista nem lê a view; proprietário logado lê", async () => {
    const anon = cliente();
    const rpc = await anon.rpc("pedidos_publicos_lista");
    expect(rpc.error?.code, "anon executou a função DEFINER").toBe("42501");
    const view = await anon.from("pedidos_publicos").select("id").limit(1);
    expect(view.error?.code, "anon leu a view").toBe("42501");

    const dono = await logado("proprietario");
    const r = await dono.from("pedidos_publicos").select("id, cidade, uf").limit(1);
    expect(r.error).toBeNull();
    expect(Array.isArray(r.data)).toBe(true);
  });
});
