import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { adm, apagarContas, CHAVE_ANON, criarConta, NO_LABORATORIO, novaSenha, novoSufixo, URL_SUPABASE } from "../fixtures/laboratorio";

/**
 * T1059 — E444 (#2364, Relay 57, itens 1 e 2): a caixa de avisos do site (o sino), tabela `avisos` da 0286. O banco de
 * verdade do laboratório, com a sessão de cada pessoa (como as ações do sino leem e marcam):
 *   1. cada um lê SÓ os seus avisos; o visitante (anon) não lê nada;
 *   2. a pessoa marca o próprio aviso como lido — e é só isso: título, prioridade, url e "resolvido" não mudam, não insere
 *      aviso e não apaga; marcar o aviso de OUTRA pessoa não muda nada;
 *   3. avisos_resumo(): as não lidas e a maior prioridade pendente (não lida e não resolvida) são só as da própria pessoa.
 * A gravação pelo notify() (título do catálogo, url, ref_id) e a resolução pela ação ficam com o e444-avisos.test.ts.
 */
const sufixo = novoSufixo();
const senha = novaSenha();
const ana = { email: `ana.t1059.${sufixo}@lab.vivanomads.test`, nome: "Ana Avisos Souza", role: "tenant" as const };
const beto = { email: `beto.t1059.${sufixo}@lab.vivanomads.test`, nome: "Beto Avisos Lima", role: "owner" as const };
const ids: Record<string, string> = {};

async function sessao(email: string) {
  const cli = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
  const { error } = await cli.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
  return cli;
}
const linha = async (id: string) => (await adm().from("avisos").select("titulo, prioridade, url, lido_em, resolvido_em").eq("id", id).single()).data;

test.describe("T1059 — E444: avisos do sino, cada um lê e marca só os seus", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.ana = await criarConta(ana, senha);
    ids.beto = await criarConta(beto, senha);
    const { data, error } = await adm()
      .from("avisos")
      .insert([
        { usuario_id: ids.ana, evento: "proposta_recebida", prioridade: "critico", titulo: `Proposta t1059 ${sufixo}`, url: "/dashboard/propostas", ref_id: "t1059-a" },
        { usuario_id: ids.ana, evento: "new_message", prioridade: "urgente", titulo: `Mensagem t1059 ${sufixo}`, url: "/dashboard/mensagens" },
        { usuario_id: ids.ana, evento: "visita_pedida", prioridade: "critico", titulo: `Visita resolvida t1059 ${sufixo}`, resolvido_em: new Date().toISOString() },
        { usuario_id: ids.beto, evento: "contract_status", prioridade: "critico", titulo: `Contrato do Beto t1059 ${sufixo}` },
      ])
      .select("id, titulo");
    if (error) throw error;
    for (const r of data as { id: string; titulo: string }[]) {
      if (r.titulo.startsWith("Proposta")) ids.proposta = r.id;
      else if (r.titulo.startsWith("Mensagem")) ids.mensagem = r.id;
      else if (r.titulo.startsWith("Visita")) ids.visita = r.id;
      else ids.doBeto = r.id;
    }
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("avisos").delete().in("usuario_id", [ids.ana, ids.beto]);
    await apagarContas([ids.ana, ids.beto]);
  });

  test("1. cada um lê só os seus; o visitante não lê nada", async () => {
    const a = await sessao(ana.email);
    const { data, error } = await a.from("avisos").select("id, usuario_id");
    expect(error).toBeNull();
    const meus = (data ?? []) as { id: string; usuario_id: string }[];
    expect(meus.map((r) => r.id).sort()).toEqual([ids.proposta, ids.mensagem, ids.visita].sort());
    expect(meus.every((r) => r.usuario_id === ids.ana)).toBe(true);

    const visitante = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    const anon = await visitante.from("avisos").select("id").limit(5);
    expect(anon.data ?? [], "o visitante não lê avisos").toHaveLength(0);
  });

  test("2. marca o próprio como lido e nada mais; o de outra pessoa não muda", async () => {
    const a = await sessao(ana.email);
    const antes = await linha(ids.proposta);

    const lido = await a.from("avisos").update({ lido_em: new Date().toISOString() }).eq("id", ids.mensagem);
    expect(lido.error).toBeNull();
    expect((await linha(ids.mensagem))?.lido_em, "o próprio aviso fica lido").not.toBeNull();

    for (const mudanca of [{ titulo: "trocado" }, { prioridade: "normal" }, { url: "/outro" }, { resolvido_em: new Date().toISOString() }]) {
      const r = await a.from("avisos").update(mudanca).eq("id", ids.proposta);
      expect(r.error, JSON.stringify(mudanca)).not.toBeNull();
    }
    expect(await linha(ids.proposta), "título, prioridade, url e resolvido intactos").toEqual(antes);

    const ins = await a.from("avisos").insert({ usuario_id: ids.ana, evento: "new_message", prioridade: "normal", titulo: "inventado" });
    expect(ins.error, "a pessoa não grava aviso").not.toBeNull();
    await a.from("avisos").delete().eq("id", ids.proposta);
    expect(await linha(ids.proposta), "a pessoa não apaga aviso").not.toBeNull();

    await a.from("avisos").update({ lido_em: new Date().toISOString() }).eq("id", ids.doBeto);
    expect((await linha(ids.doBeto))?.lido_em, "o aviso de outra pessoa segue não lido").toBeNull();
  });

  test("3. avisos_resumo: não lidas e a maior prioridade pendente, só da própria pessoa", async () => {
    const a = await sessao(ana.email);
    const r = await a.rpc("avisos_resumo");
    expect(r.error).toBeNull();
    const linhaA = (Array.isArray(r.data) ? r.data[0] : r.data) as { nao_lidas: number; maior_prioridade: string | null };
    // Não lidas da Ana: a proposta (crítico, pendente) e a visita (crítico, já resolvida); a mensagem foi lida no teste 2.
    expect(linhaA.nao_lidas).toBe(2);
    expect(linhaA.maior_prioridade).toBe("critico");

    await adm().from("avisos").update({ lido_em: new Date().toISOString() }).eq("id", ids.proposta);
    const depois = await a.rpc("avisos_resumo");
    const linhaD = (Array.isArray(depois.data) ? depois.data[0] : depois.data) as { nao_lidas: number; maior_prioridade: string | null };
    // Sobra a visita: não lida, mas resolvida — não conta como pendente.
    expect(linhaD.nao_lidas).toBe(1);
    expect(linhaD.maior_prioridade).toBeNull();

    const b = await sessao(beto.email);
    const rb = await b.rpc("avisos_resumo");
    const linhaB = (Array.isArray(rb.data) ? rb.data[0] : rb.data) as { nao_lidas: number; maior_prioridade: string | null };
    expect(linhaB.nao_lidas).toBe(1);
    expect(linhaB.maior_prioridade).toBe("critico");
  });
});
