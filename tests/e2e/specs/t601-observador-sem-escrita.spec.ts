// Portão pós-#1509/#1512 (Pista C, 29/10): E228 (links da auditoria) e botões do observador da QA; roda no lab-crítico deste PR.
import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, adm, apagarContas, criarAdmin, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

// Regressão dos merges #1472–#1479 (Pista C, 29/10): a suíte completa estoura o tempo antes de chegar aqui; roda no portão do PR.
/*
  T601 — 0253 (ponto aberto 1 do QA-LOGIN-B v2): o admin observador da QA continua LENDO o que o admin lê, mas não
  ESCREVE direto pela API (fora do site) nas tabelas de admin — Caixa já fechada na 0252; aqui o resto, incluindo
  qualification_checklists e fotos_perfil_revisao. A mesma escrita, pelo admin comum, continua passando. As linhas do
  próprio observador (o imóvel e o avatar dele) seguem dele. is_admin() e o 2FA não mudam: o observador é admin.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: Record<string, string> = {};
const chaveCidade = `t601-${sufixo}`.toLowerCase();
let obs: SupabaseClient;
let admin: SupabaseClient;

async function sessao(email: string): Promise<SupabaseClient> {
  const c = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
  return c;
}

test.describe("T601 — 0253: o admin observador lê, mas não escreve direto nas tabelas de admin", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    const emailObs = `qa+t601${sufixo}-observador@lab.vivanomads.test`;
    const emailAdm = `adm.t601.${sufixo}@lab.vivanomads.test`;
    ids.obs = await criarConta({ email: emailObs, nome: "Olivia Observadora", role: "tenant" }, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.obs);
    const { error: ePromo } = await adm().rpc("promover_qa_admin", { p_id: ids.obs });
    if (ePromo) throw ePromo;
    ids.adm = await criarAdmin(emailAdm, "Abel Admin", senha);
    ids.dono = await criarConta({ email: `dono.t601.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "owner" }, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio t601 ${sufixo}`, { ativo: true });
    ids.imovelObs = await criarImovelPronto(ids.obs, `Studio do observador t601 ${sufixo}`, { ativo: true });
    const { error: eCid } = await adm().from("cidades_liberadas").insert({ uf: "ZZ", chave: chaveCidade, cidade: "Cidade t601", liberada: false });
    if (eCid) throw eCid;
    const { data: g, error: eG } = await adm().from("gastos_marketing").insert({ mes: "2026-10-01", canal: "outro", observacao: `t601 ${sufixo}`, valor: 10, criado_por: ids.adm }).select("id").single();
    if (eG) throw eG;
    ids.gasto = g.id as string;
    const { data: f, error: eF } = await adm().from("fotos_perfil_revisao").insert({ user_id: ids.dono, caminho: `${ids.dono}/avatar.webp` }).select("id").single();
    if (eF) throw eF;
    ids.foto = f.id as string;
    for (const dono of [ids.dono, ids.obs]) {
      const { error: eUp } = await adm().storage.from("avatars").upload(`${dono}/t601.webp`, new Blob(["x"], { type: "image/webp" }), { upsert: true });
      if (eUp) throw eUp;
    }
    obs = await sessao(emailObs);
    admin = await sessao(emailAdm);
  });

  test.afterAll(async () => {
    await adm().from("cidades_liberadas").delete().eq("uf", "ZZ").eq("chave", chaveCidade);
    await adm().from("gastos_marketing").delete().like("observacao", `t601 ${sufixo}%`);
    await adm().from("fotos_perfil_revisao").delete().eq("id", ids.foto ?? "00000000-0000-0000-0000-000000000000");
    await adm().storage.from("avatars").remove([`${ids.dono}/t601.webp`, `${ids.obs}/t601.webp`]);
    await apagarContas([ids.obs, ids.adm, ids.dono]);
  });

  test("o observador é admin e lê as mesmas linhas que o admin comum", async () => {
    expect((await obs.rpc("is_admin")).data).toBe(true);
    expect((await obs.rpc("is_qa_admin", { uid: ids.obs })).data).toBe(true);
    const cid = await obs.from("cidades_liberadas").select("chave").eq("chave", chaveCidade);
    expect(cid.data).toEqual([{ chave: chaveCidade }]);
    const qc = await obs.from("qualification_checklists").select("property_id").eq("property_id", ids.imovel);
    expect(qc.data?.length).toBe(1);
    const fp = await obs.from("fotos_perfil_revisao").select("id").eq("id", ids.foto);
    expect(fp.data?.length).toBe(1);
  });

  test("o observador não escreve: update não pega linha, insert e delete são recusados ou não apagam", async () => {
    const up = async (tabela: string, valores: Record<string, unknown>, coluna: string, valor: string) =>
      (await obs.from(tabela).update(valores).eq(coluna, valor).select()).data ?? [];
    expect(await up("cidades_liberadas", { liberada: true }, "chave", chaveCidade)).toHaveLength(0);
    expect(await up("qualification_checklists", { document_status: "rejected" }, "property_id", ids.imovel)).toHaveLength(0);
    expect(await up("fotos_perfil_revisao", { status: "removida", motivo: "Imagem imprópria", revisado_em: new Date().toISOString() }, "id", ids.foto)).toHaveLength(0);
    expect(await up("gastos_marketing", { valor: 999 }, "id", ids.gasto)).toHaveLength(0);
    expect(await up("properties", { title: "mexido pelo observador" }, "id", ids.imovel)).toHaveLength(0);
    const ins = await obs.from("cidades_liberadas").insert({ uf: "ZZ", chave: `${chaveCidade}-obs`, cidade: "Cidade obs" });
    expect(ins.error?.code).toBe("42501");
    const insG = await obs.from("gastos_marketing").insert({ mes: "2026-10-01", canal: "outro", observacao: `t601 ${sufixo} obs`, valor: 1 });
    expect(insG.error?.code).toBe("42501");
    expect((await obs.from("gastos_marketing").delete().eq("id", ids.gasto).select()).data ?? []).toHaveLength(0);
    const rm = await obs.storage.from("avatars").remove([`${ids.dono}/t601.webp`]);
    expect(rm.data ?? []).toHaveLength(0);
    // Nada mudou de verdade (lido pela chave de serviço).
    expect((await adm().from("cidades_liberadas").select("liberada").eq("chave", chaveCidade).single()).data?.liberada).toBe(false);
    expect((await adm().from("fotos_perfil_revisao").select("status").eq("id", ids.foto).single()).data?.status).toBe("em_revisao");
    expect((await adm().from("gastos_marketing").select("valor").eq("id", ids.gasto).single()).data?.valor).toBe(10);
    expect((await adm().from("properties").select("title").eq("id", ids.imovel).single()).data?.title).toBe(`Studio t601 ${sufixo}`);
    const { data: restam } = await adm().storage.from("avatars").list(ids.dono);
    expect((restam ?? []).map((o) => o.name)).toContain("t601.webp");
  });

  test("as linhas do próprio observador continuam dele (imóvel e avatar)", async () => {
    expect(await obs.from("properties").update({ title: `Studio do observador t601 ${sufixo} editado` }).eq("id", ids.imovelObs).select("id").then((r) => r.data ?? [])).toHaveLength(1);
    const rm = await obs.storage.from("avatars").remove([`${ids.obs}/t601.webp`]);
    expect(rm.data ?? []).toHaveLength(1);
  });

  test("o admin comum continua escrevendo as mesmas linhas", async () => {
    expect((await admin.rpc("is_admin")).data).toBe(true);
    expect((await admin.from("cidades_liberadas").update({ liberada: true }).eq("chave", chaveCidade).select()).data ?? []).toHaveLength(1);
    expect((await admin.from("fotos_perfil_revisao").update({ status: "aprovada", revisado_em: new Date().toISOString(), revisado_por: ids.adm }).eq("id", ids.foto).select()).data ?? []).toHaveLength(1);
    expect((await admin.from("gastos_marketing").update({ valor: 11 }).eq("id", ids.gasto).select()).data ?? []).toHaveLength(1);
    const insG = await admin.from("gastos_marketing").insert({ mes: "2026-10-01", canal: "outro", observacao: `t601 ${sufixo} adm`, valor: 1 });
    expect(insG.error).toBeNull();
  });
});
