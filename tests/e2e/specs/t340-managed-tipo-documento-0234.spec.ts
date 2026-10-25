import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NO_LABORATORIO, CHAVE_ANON, URL_SUPABASE, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T340 — 0234 (#1204, ordem ab50d8af): imóvel administrado (managed) só é publicado com o tipo do documento
 * (contrato de administração ou procuração). Teste permanente da Pista C, 24/10: o #1204 só trazia testes de texto
 * da migração; aqui o gatilho properties_exige_autorizacao roda de verdade no banco do laboratório, com a sessão do
 * próprio dono (o service role e o admin passam pelo gatilho sem regra, então não servem para testar).
 *   1. administrado ativo sem tipo: recusado (23514), e o anúncio continua como estava;
 *   2. administrado com o tipo "autorizacao" (o de sublocação): recusado;
 *   3. administrado com contrato de administração e com procuração: publicado;
 *   4. tirar o tipo de um administrado já ativo: recusado (o gatilho dispara na troca do tipo);
 *   5. sublocado continua com a regra da 0091: com declaração e arquivo publica sem tipo; sem arquivo, recusado;
 *   6. tipo fora da lista: recusado pelo check; o visitante (anon) não lê o tipo.
 * Só no laboratório.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t340.${sufixo}@lab.vivanomads.test`, nome: "Gilda Gestora", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};
let sb: SupabaseClient;

type Operacao = { ownership_type: "own" | "subleased" | "managed"; sublease_authorized?: boolean; sublease_doc_url?: string | null; sublease_doc_tipo?: string | null };
const arquivo = () => `${ids.dono}/autorizacao-t340.pdf`;

/** Volta o anúncio a "próprio e ativo" pelo service role, para cada caso começar do mesmo lugar. */
async function zerar() {
  const { error } = await adm()
    .from("properties")
    .update({ ownership_type: "own", sublease_authorized: false, sublease_doc_url: null, sublease_doc_tipo: null, status: "active" })
    .eq("id", ids.imovel!);
  if (error) throw error;
}
/** O dono muda a operação do anúncio ativo pela própria sessão (como a tela grava). */
async function donoGrava(op: Operacao) {
  return sb.from("properties").update(op).eq("id", ids.imovel!).select("status, ownership_type, sublease_doc_tipo").single();
}
async function lerComoAdmin() {
  const { data, error } = await adm().from("properties").select("status, ownership_type, sublease_doc_tipo").eq("id", ids.imovel!).single();
  if (error) throw error;
  return data;
}

test.describe("T340 — 0234: administrado só publica com contrato de administração ou procuração", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio administrado ${sufixo}`, { ativo: true });
    sb = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await sb.auth.signInWithPassword({ email: dono.email, password: senha });
    if (error) throw error;
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  test("1. administrado ativo sem tipo do documento: recusado e o anúncio não muda", async () => {
    await zerar();
    const { error } = await donoGrava({ ownership_type: "managed", sublease_authorized: true, sublease_doc_url: arquivo(), sublease_doc_tipo: null });
    expect(error?.code).toBe("23514");
    expect(error?.message).toContain("tipo do documento");
    expect(await lerComoAdmin()).toMatchObject({ status: "active", ownership_type: "own", sublease_doc_tipo: null });
  });

  test("2. administrado com o tipo de sublocação ('autorizacao'): recusado", async () => {
    await zerar();
    const { error } = await donoGrava({ ownership_type: "managed", sublease_authorized: true, sublease_doc_url: arquivo(), sublease_doc_tipo: "autorizacao" });
    expect(error?.code).toBe("23514");
    expect((await lerComoAdmin()).ownership_type).toBe("own");
  });

  for (const tipo of ["contrato_gestao", "procuracao"] as const) {
    test(`3. administrado com '${tipo}': publicado`, async () => {
      await zerar();
      const { data, error } = await donoGrava({ ownership_type: "managed", sublease_authorized: true, sublease_doc_url: arquivo(), sublease_doc_tipo: tipo });
      expect(error).toBeNull();
      expect(data).toMatchObject({ status: "active", ownership_type: "managed", sublease_doc_tipo: tipo });
    });
  }

  test("4. tirar o tipo de um administrado já ativo: recusado", async () => {
    await zerar();
    expect((await donoGrava({ ownership_type: "managed", sublease_authorized: true, sublease_doc_url: arquivo(), sublease_doc_tipo: "procuracao" })).error).toBeNull();
    const { error } = await sb.from("properties").update({ sublease_doc_tipo: null }).eq("id", ids.imovel!);
    expect(error?.code).toBe("23514");
    expect((await lerComoAdmin()).sublease_doc_tipo).toBe("procuracao");
  });

  test("5. sublocado segue a 0091: com declaração e arquivo publica sem tipo; sem arquivo, recusado", async () => {
    await zerar();
    const ok = await donoGrava({ ownership_type: "subleased", sublease_authorized: true, sublease_doc_url: arquivo(), sublease_doc_tipo: null });
    expect(ok.error).toBeNull();
    expect(ok.data).toMatchObject({ status: "active", ownership_type: "subleased" });
    await zerar();
    const semArquivo = await donoGrava({ ownership_type: "subleased", sublease_authorized: true, sublease_doc_url: null });
    expect(semArquivo.error?.code).toBe("23514");
    expect((await lerComoAdmin()).ownership_type).toBe("own");
  });

  test("6. tipo fora da lista é recusado pelo check; o visitante não lê o tipo", async () => {
    await zerar();
    const invalido = await adm().from("properties").update({ sublease_doc_tipo: "escritura" }).eq("id", ids.imovel!);
    expect(invalido.error?.code).toBe("23514");
    expect(invalido.error?.message).toContain("properties_sublease_doc_tipo_valido");
    const anon = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await anon.from("properties").select("id, sublease_doc_tipo").eq("id", ids.imovel!);
    // Sem o grant da coluna para anon, a leitura falha (42501) em vez de devolver o tipo.
    expect(error?.code, `anon leu: ${JSON.stringify(data)}`).toBe("42501");
  });
});
