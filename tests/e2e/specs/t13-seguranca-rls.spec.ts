import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { account, hasAccount } from "../fixtures/accounts";

/**
 * T13 — Segurança no BANCO (P0 / migrações 0052 + 0053). Não usa navegador: fala direto
 * com o PostgREST como faria um atacante com a chave anon (que é pública).
 *
 *  C2  usuário comum NÃO consegue virar admin nem mexer em campo de confiança;
 *      campo de preferência (preferred_mode) continua editável.
 *  C3  as RPCs de contato (PII) não executam para usuário logado.
 *  C4  colunas sensíveis de properties não são legíveis (anon nem logado).
 *
 * C2 passa depois da 0052; C3 e C4 só depois da 0053. Rode após aplicar as DUAS.
 * Usa a conta TESTES_INQUILINO_* e, se houver, também TESTES_PROPRIETARIO_*.
 * Sem env (URL/anon key/conta de teste), o teste é pulado.
 *
 * Escrita: o único UPDATE real regrava preferred_mode com o MESMO valor lido
 * (não altera dado). As tentativas proibidas não gravam nada por definição.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const temEnv = !!URL && !!ANON && hasAccount("inquilino");

function cliente(): SupabaseClient {
  return createClient(URL!, ANON!, { auth: { persistSession: false } });
}

async function logado(papel: "inquilino" | "proprietario" = "inquilino"): Promise<{ sb: SupabaseClient; uid: string }> {
  const sb = cliente();
  const a = account(papel);
  const { data, error } = await sb.auth.signInWithPassword({ email: a.email, password: a.senha });
  if (error || !data.user) throw new Error(`Login da conta de teste falhou: ${error?.message}`);
  return { sb, uid: data.user.id };
}

test.describe("T13 segurança RLS (0052+0053) @criticos @seguranca", () => {
  test.skip(!temEnv, "Sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY ou conta de teste do inquilino.");

  for (const papel of ["inquilino", "proprietario"] as const) {
  test(`C2 (${papel}): não vira admin nem altera campos de confiança`, async () => {
    test.skip(!hasAccount(papel), `Sem conta de teste TESTES_${papel.toUpperCase()}_*.`);
    const { sb, uid } = await logado(papel);
    const { data: antes } = await sb
      .from("profiles")
      .select("role, is_verified, verification_progress, account_type, preferred_mode")
      .eq("id", uid)
      .single();
    expect(antes).toBeTruthy();

    // Cada tentativa deve ser recusada (sem grant de coluna e/ou trigger).
    const tentativas: Record<string, unknown>[] = [
      { role: "admin" },
      { is_verified: true },
      { verification_progress: 100 },
      { account_type: "gestor" },
      { fundador: true },
      { person_type: "pj" },
    ];
    for (const patch of tentativas) {
      const { error } = await sb.from("profiles").update(patch).eq("id", uid);
      expect(error, `deveria recusar ${JSON.stringify(patch)}`).not.toBeNull();
    }

    // Nada mudou de fato.
    const { data: depois } = await sb
      .from("profiles")
      .select("role, is_verified, verification_progress, account_type")
      .eq("id", uid)
      .single();
    expect(depois?.role).toBe(antes?.role);
    expect(depois?.is_verified).toBe(antes?.is_verified);
    expect(depois?.verification_progress).toBe(antes?.verification_progress);
    expect(depois?.account_type).toBe(antes?.account_type);
    expect(depois?.role).not.toBe("admin");

    // Controle: campo de preferência continua editável (regrava o mesmo valor).
    const { error: okErr } = await sb
      .from("profiles")
      .update({ preferred_mode: antes?.preferred_mode ?? null })
      .eq("id", uid);
    expect(okErr).toBeNull();
  });
  }

  test("C3: RPCs de contato (PII) não executam para usuário logado", async () => {
    const { sb } = await logado();
    const qualquer = "00000000-0000-0000-0000-000000000000";
    const chamadas = [
      sb.rpc("owner_notify_contact", { prop_id: qualquer }),
      sb.rpc("message_notify_contact", { target: qualquer }),
      sb.rpc("pedido_owner_recipients", { cidade_alvo: "Uberlândia" }),
      sb.rpc("pedido_inquilino_recipient", { pedido: qualquer }),
    ];
    for (const c of chamadas) {
      const { error } = await c;
      expect(error, "RPC de PII deveria negar execute").not.toBeNull();
    }
  });

  test("C4: colunas sensíveis de properties não são legíveis", async () => {
    const anon = cliente();
    const { sb } = await logado();
    for (const c of [anon, sb]) {
      for (const col of ["exact_address", "draft_data", "responsavel_local_telefone"]) {
        const { error } = await c.from("properties").select(col).limit(1);
        expect(error, `SELECT ${col} deveria ser negado`).not.toBeNull();
      }
      // Colunas públicas seguem legíveis.
      const { error: okErr } = await c.from("properties").select("id, title, city").limit(1);
      expect(okErr).toBeNull();
    }
  });
});
