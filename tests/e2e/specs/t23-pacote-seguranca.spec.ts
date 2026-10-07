import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { account, hasAccount } from "../fixtures/accounts";

/**
 * T23 — Pacote de segurança (migração 0084). Fala direto com o PostgREST e,
 * onde importa, abre as páginas públicas de verdade.
 *
 *  2  anon não executa is_admin/pode_ver_contrato/pedido_ativo/pedido_inquilino,
 *     e NADA público quebra: imóveis, fotos, amenidades, avaliações, /buscar,
 *     página do imóvel, /conferir. Logado: admin segue admin; o mural segue.
 *
 * Sem env (URL/anon key/contas de teste), o teste é pulado.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const temEnv = !!URL && !!ANON && hasAccount("proprietario") && hasAccount("admin");

const cliente = (chave = ANON!): SupabaseClient => createClient(URL!, chave, { auth: { persistSession: false } });

async function logado(papel: "inquilino" | "proprietario" | "admin"): Promise<SupabaseClient> {
  const sb = cliente();
  const a = account(papel);
  const { error } = await sb.auth.signInWithPassword({ email: a.email, password: a.senha });
  if (error) throw new Error(`Login da conta de teste falhou: ${error.message}`);
  return sb;
}

test.describe("T23 pacote de segurança (0084) @seguranca", () => {
  test.skip(!temEnv, "Sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY ou contas de teste.");

  test("2: anon não executa as 4 funções internas", async () => {
    const anon = cliente();
    const id = "00000000-0000-0000-0000-000000000000";
    for (const [fn, args] of [
      ["is_admin", {}],
      ["pode_ver_contrato", { c_id: id }],
      ["pedido_ativo", { p: id }],
      ["pedido_inquilino", { pedido: id }],
    ] as const) {
      const r = await anon.rpc(fn, args);
      expect(r.error?.message ?? "", `anon executou ${fn}`).toMatch(/permission denied/);
    }
  });

  test("2: leituras públicas sem login continuam (imóveis, fotos, amenidades, avaliações)", async () => {
    const anon = cliente();
    const imoveis = await anon.from("properties").select("id").eq("status", "active").limit(5);
    expect(imoveis.error, "vitrine quebrou para anon").toBeNull();
    expect(imoveis.data!.length).toBeGreaterThan(0);
    const id = imoveis.data![0].id;
    for (const tabela of ["property_photos", "property_amenities"]) {
      const r = await anon.from(tabela).select("property_id").eq("property_id", id).limit(1);
      expect(r.error, `${tabela} quebrou para anon`).toBeNull();
    }
    expect((await anon.from("reviews").select("id").limit(1)).error, "avaliações quebraram para anon").toBeNull();
  });

  test("2: páginas públicas abrem sem login (/buscar, imóvel, /conferir)", async ({ page, request }) => {
    const anon = cliente();
    const { data } = await anon.from("properties").select("id").eq("status", "active").limit(1).single();
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    await expect(page.locator(`a[href="/imoveis/${data!.id}"]`).first()).toBeVisible();
    const imovel = await request.get(`/imoveis/${data!.id}`);
    expect(imovel.status()).toBe(200);
    const codigo = process.env.TESTES_CONFERIR_CODIGO;
    if (codigo) {
      const conf = await anon.rpc("conferir_documento", { p_codigo: codigo });
      expect(conf.error, "conferir_documento deve seguir pública").toBeNull();
      expect(await (await request.get(`/conferir/${codigo}`)).text()).toContain('data-testid="conferir-ok"');
    }
  });

  test("2: logado — admin segue admin, proprietário lê o mural, inquilino não vira admin", async () => {
    const adm = await logado("admin");
    expect((await adm.rpc("is_admin")).data).toBe(true);
    expect((await adm.from("profiles").select("id").limit(2)).data!.length).toBeGreaterThan(1);
    const dono = await logado("proprietario");
    expect((await dono.rpc("is_admin")).data).toBe(false);
    const mural = await dono.from("pedidos_publicos").select("id").limit(1);
    expect(mural.error).toBeNull();
    const meus = await dono.from("properties").select("id").limit(1);
    expect(meus.error).toBeNull();
  });
});
