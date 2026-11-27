import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, adm, apagarContas, cnpjAleatorio, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2228 — E1112/E1113 (ORDEM-DUET-502; prova de COMPORTAMENTO dos gatilhos, Pista 3) @E1112 @E1113 — só no laboratório.
  As travas unitárias leem o texto das migrações 0357/0358; esta spec prova que o gatilho DISPARA no banco:
   • profiles.bio: a sessão NORMAL do próprio dono (chave anon + login, sem chave de serviço) grava a bio limpa — e o
     gatilho recusa a bio com telefone (23514); a bio fica como estava.
   • parceiros (nome_publico, descricao, descricao_curta): a sessão normal nem tem UPDATE na tabela (0190: só SELECT a
     authenticated) — o caminho de escrita é o servidor, com a chave de serviço. O gatilho guarda esse caminho para quem
     grava fora da action: a gravação limpa passa; com telefone, cada um dos três campos é recusado (23514).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `parc.t2228.${sufixo}@lab.vivanomads.test`, nome: "Paula Parceira", role: "owner" as const };
const ids: Record<string, string> = {};
const TELEFONE = "Me chama no (34) 99876-5432";
const LIMPO = "Atendo a cidade toda com hora marcada";

let sessao: SupabaseClient;

test.describe("T2228 — E1112/E1113: o gatilho recusa contacto no banco @E1112 @E1113", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    const p = await adm()
      .from("parceiros")
      .insert({ user_id: ids.dono, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: "Paula Serviços", slug: `t2228-${sufixo}`, categorias: ["limpeza"], descricao: LIMPO, descricao_curta: LIMPO })
      .select("id")
      .single();
    if (p.error) throw p.error;
    ids.parceiro = p.data.id;
    sessao = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    const { error } = await sessao.auth.signInWithPassword({ email: dono.email, password: senha });
    if (error) throw error;
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("E1113: a sessão normal grava a bio limpa; a bio com telefone é recusada pelo gatilho e não muda", async () => {
    const ok = await sessao.from("profiles").update({ bio: LIMPO }).eq("id", ids.dono).select("bio");
    expect(ok.error, "a bio limpa passa (a RLS deixa o dono gravar a própria bio)").toBeNull();
    expect(ok.data?.[0]?.bio).toBe(LIMPO);
    const r = await sessao.from("profiles").update({ bio: TELEFONE }).eq("id", ids.dono).select("bio");
    expect(r.error?.code, "o gatilho da 0358 recusa telefone na bio").toBe("23514");
    const lida = await adm().from("profiles").select("bio").eq("id", ids.dono).single();
    expect(lida.data?.bio, "a bio ficou como estava").toBe(LIMPO);
  });

  test("E1112: a sessão normal não grava em parceiros (só o servidor grava)", async () => {
    const r = await sessao.from("parceiros").update({ descricao_curta: LIMPO }).eq("id", ids.parceiro).select("id");
    expect(r.error?.code, "sem UPDATE para authenticated (0190)").toBe("42501");
  });

  for (const campo of ["nome_publico", "descricao", "descricao_curta"] as const) {
    test(`E1112: ${campo} — a gravação limpa passa; com telefone o gatilho da 0357 recusa e o campo não muda`, async () => {
      const limpo = campo === "nome_publico" ? "Paula Limpeza e Cuidado" : LIMPO;
      const ok = await adm().from("parceiros").update({ [campo]: limpo }).eq("id", ids.parceiro).select(campo).single();
      expect(ok.error, `${campo} limpo passa`).toBeNull();
      const r = await adm().from("parceiros").update({ [campo]: TELEFONE }).eq("id", ids.parceiro).select(campo);
      expect(r.error?.code, `o gatilho recusa telefone em ${campo}`).toBe("23514");
      const lida = await adm().from("parceiros").select(campo).eq("id", ids.parceiro).single();
      expect((lida.data as Record<string, string> | null)?.[campo], `${campo} ficou como estava`).toBe(limpo);
    });
  }
});
