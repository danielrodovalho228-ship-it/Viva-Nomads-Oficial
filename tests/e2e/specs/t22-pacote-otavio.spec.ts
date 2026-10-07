import { randomBytes } from "node:crypto";
import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { account, hasAccount } from "../fixtures/accounts";

/**
 * T22 — Pacote do Otávio (migração 0083). Sem navegador: fala direto com o
 * PostgREST, como um atacante com a chave anon (que é pública).
 *
 *  #29/#25  anon não lê o mural de pedidos (função DEFINER nem view); logado lê.
 *  #14      documento fiscal não se apaga, nem com service_role; anulação lógica
 *           grava uma vez só e a conferência pública diz "anulado". Cria um
 *           informe anual próprio (ano livre) porque documento não pode ser
 *           apagado depois — o do seed fica intacto para o /conferir.
 *  #32      anon não escreve em nenhuma das 43 tabelas (amostra pelo PostgREST:
 *           "permission denied" = sem privilégio, antes até do RLS); logado segue escrevendo.
 *
 * Sem env (URL/anon key/conta de teste), o teste é pulado.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
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

  test("#14: service_role não apaga documento fiscal; anulação lógica uma vez só e /conferir mostra anulado", async ({ request }) => {
    test.skip(!SERVICE || !hasAccount("inquilino"), "Sem SUPABASE_SERVICE_ROLE_KEY ou conta do inquilino.");
    const inq = await logado("inquilino");
    const tenantId = (await inq.auth.getUser()).data.user!.id;
    const adm = cliente(SERVICE!);
    const { data: usados } = await adm.from("documentos_fiscais").select("ano").eq("tipo", "informe_anual").eq("tenant_id", tenantId);
    const ano = [...Array(81).keys()].map((i) => 2020 + i).find((a) => !(usados ?? []).some((u) => u.ano === a))!;
    const codigo = randomBytes(16).toString("hex");
    const { data: doc, error: eIns } = await adm
      .from("documentos_fiscais")
      .insert({ tipo: "informe_anual", numero: `INF-T22-${Date.now()}`, ano, tenant_id: tenantId, locatario_nome: "Teste T22", valor: 1, hash: randomBytes(32).toString("hex"), codigo_verificacao: codigo, pdf_path: "lab/t22.pdf" })
      .select("id")
      .single();
    expect(eIns).toBeNull();

    // DELETE barrado (sem privilégio e, por baixo, o gatilho).
    const del = await adm.from("documentos_fiscais").delete().eq("id", doc!.id).select("id");
    expect(del.error?.code, "service_role apagou documento fiscal").toBe("42501");
    expect((await adm.from("documentos_fiscais").select("id").eq("id", doc!.id)).data).toHaveLength(1);

    // Anulação sem motivo é recusada; com motivo, grava.
    expect((await adm.from("documentos_fiscais").update({ anulado_em: new Date().toISOString() }).eq("id", doc!.id)).error).not.toBeNull();
    const anula = await adm.from("documentos_fiscais").update({ anulado_em: new Date().toISOString(), anulado_motivo: "teste T22: emitido em duplicidade" }).eq("id", doc!.id);
    expect(anula.error).toBeNull();
    // Não se desfaz nem se reescreve.
    const desfaz = await adm.from("documentos_fiscais").update({ anulado_em: null, anulado_motivo: null }).eq("id", doc!.id);
    expect(desfaz.error?.code).toBe("42501");
    // Campo comum continua imutável.
    expect((await adm.from("documentos_fiscais").update({ valor: 2 }).eq("id", doc!.id)).error?.code).toBe("42501");

    const conf = await cliente().rpc("conferir_documento", { p_codigo: codigo });
    expect(conf.error).toBeNull();
    expect((conf.data as { anulado_em: string | null }[])[0].anulado_em).toBeTruthy();
    const html = await (await request.get(`/conferir/${codigo}`)).text();
    expect(html).toContain('data-testid="conferir-anulado"');
    expect(html).not.toContain('data-testid="conferir-ok"');
  });

  test("#32: anon sem INSERT/UPDATE/DELETE nas tabelas; inquilino logado continua favoritando", async () => {
    const anon = cliente();
    const id = "00000000-0000-0000-0000-000000000000";
    for (const tabela of ["properties", "leads", "messages", "favorites", "avaliacoes", "documents", "pedidos_moradia", "contratos", "subscriptions", "vistorias"]) {
      const ins = await anon.from(tabela).insert({ id });
      expect(ins.error?.message ?? "", `anon inseriu em ${tabela}`).toMatch(/permission denied/);
      const upd = await anon.from(tabela).update({ id }).eq("id", id);
      expect(upd.error?.message ?? "", `anon atualizou ${tabela}`).toMatch(/permission denied/);
      const del = await anon.from(tabela).delete().eq("id", id);
      expect(del.error?.message ?? "", `anon apagou de ${tabela}`).toMatch(/permission denied/);
    }
    // Leitura pública continua (vitrine de imóveis).
    expect((await anon.from("properties").select("id").limit(1)).error).toBeNull();

    // Logado: favoritar e desfavoritar (escrita com RLS de auth.uid()).
    test.skip(!hasAccount("inquilino"), "Sem conta do inquilino.");
    const inq = await logado("inquilino");
    const uid = (await inq.auth.getUser()).data.user!.id;
    const { data: imovel } = await inq.from("properties").select("id").limit(1).single();
    await inq.from("favorites").delete().eq("tenant_id", uid).eq("property_id", imovel!.id);
    expect((await inq.from("favorites").insert({ tenant_id: uid, property_id: imovel!.id })).error).toBeNull();
    expect((await inq.from("favorites").delete().eq("tenant_id", uid).eq("property_id", imovel!.id)).error).toBeNull();
  });
});
