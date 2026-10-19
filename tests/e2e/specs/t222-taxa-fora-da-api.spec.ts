import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { CHAVE_ANON, NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T222 — A taxa de serviço não sai pela API (correção do coordenador depois do reteste do #866; item 5 da matriz).
  Laboratório, contas de teste. A 0177 tira o SELECT de contratos.comissao_valor/comissao_percent/valor_comissao e de
  leads.accepted_commission_rate/accepted_plan (e das colunas de origem) para authenticated e anon:
   1. com a sessão do inquilino (e com a do dono), GET /rest/v1/contratos?select=comissao_valor,… e
      /rest/v1/leads?select=accepted_commission_rate,accepted_plan dão erro de permissão (42501); select=* também;
      as colunas comuns continuam legíveis. As propostas já eram cobertas pelo t216 (taxa_no_envio/taxa_congelada).
   2. 1280 e 390 px: o dono continua vendo a taxa certa em Contratos & blocos e o Fechamento abre; o morador não vê taxa.
*/
const SAIDA = "tests/laboratorio/saida";
const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t222.${sufixo}@lab.vivanomads.test`, nome: "Dora Taxa Sobrenome", role: "owner" as const };
const inq = { email: `inq.t222.${sufixo}@lab.vivanomads.test`, nome: "Ivan Taxa Sobrenome", role: "tenant" as const };
const ids: Record<string, string> = {};

async function sessao(email: string) {
  const cli = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
  const { data, error } = await cli.auth.signInWithPassword({ email, password: senha });
  expect(error).toBeNull();
  return { cli, token: data.session!.access_token };
}

async function rest(token: string, caminho: string) {
  const r = await fetch(`${URL_SUPABASE}/rest/v1/${caminho}`, { headers: { apikey: CHAVE_ANON!, Authorization: `Bearer ${token}` } });
  return { status: r.status, corpo: await r.text() };
}

test.describe("T222 — a taxa de serviço não sai pela API (contratos e leads)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha, true);
    ids.inq = await criarConta(inq, senha, true);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio taxa API ${sufixo}`, { ativo: true, preco: 3200 });
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel, true);
    await adm().from("leads").update({ accepted_commission_rate: 0.12, accepted_plan: "free" }).eq("id", ids.lead);
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({ lead_id: ids.lead, property_id: ids.imovel, tenant_id: ids.inq, owner_plan: "free", faixa: "media_estadia", prazo_total_dias: 120, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 1536, valor_comissao: 1536, qtd_ocupantes: 1, garantia: "caucao", status: "ativo" })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c!.id as string;
    const hoje = new Date();
    const dia = (d: number) => new Date(hoje.getTime() + d * 86_400_000).toISOString().slice(0, 10);
    await adm().from("contrato_blocos").insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: dia(5), fim: dia(64), meses: 2, valor: 6400, caucao: 3200, status: "ativo" });
  });

  test.afterAll(async () => {
    await adm().from("contrato_blocos").delete().eq("contrato_id", ids.contrato);
    await adm().from("contratos").delete().eq("id", ids.contrato);
    await adm().from("leads").delete().eq("id", ids.lead);
    await apagarContas([ids.inq, ids.dono]);
  });

  test("1. API: com a sessão do inquilino e do dono, as colunas de taxa dão erro de permissão; as comuns continuam", async () => {
    for (const email of [inq.email, dono.email]) {
      const { cli, token } = await sessao(email);
      const c = await cli.from("contratos").select("comissao_valor, comissao_percent, valor_comissao").eq("id", ids.contrato);
      expect(c.error?.code, `${email}: contratos`).toBe("42501");
      const l = await cli.from("leads").select("accepted_commission_rate, accepted_plan").eq("id", ids.lead);
      expect(l.error?.code, `${email}: leads`).toBe("42501");
      // select=* também falha: a tabela não tem mais SELECT inteiro.
      expect((await cli.from("contratos").select("*").eq("id", ids.contrato)).error?.code).toBe("42501");
      // As colunas comuns continuam legíveis pelas partes (RLS).
      const ok = await cli.from("contratos").select("id, status, aluguel_mensal").eq("id", ids.contrato);
      expect(ok.error).toBeNull();
      expect(ok.data ?? []).toHaveLength(1);
      // A mesma chamada REST que o navegador faria.
      const r1 = await rest(token, `contratos?select=comissao_valor,comissao_percent,valor_comissao&id=eq.${ids.contrato}`);
      expect(r1.status, r1.corpo).not.toBe(200);
      expect(r1.corpo).toContain("42501");
      expect(r1.corpo).not.toContain("1536");
      const r2 = await rest(token, `leads?select=accepted_commission_rate,accepted_plan&id=eq.${ids.lead}`);
      expect(r2.status, r2.corpo).not.toBe(200);
      expect(r2.corpo).toContain("42501");
      expect(r2.corpo).not.toMatch(/0\.12/);
    }
  });

  for (const largura of [1280, 390]) {
    test(`2. ${largura} — o dono continua vendo a taxa certa (Contratos & blocos, Fechamento); o morador não vê taxa`, async ({ browser }) => {
      const d = await entrar(browser, dono.email, senha);
      await d.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await d.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
      const taxa = d.getByTestId("contrato-taxa").first();
      await expect(taxa).toContainText("R$ 1.536", { timeout: 20_000 });
      await expect(taxa).toContainText("12%");
      await d.screenshot({ path: `${SAIDA}/t222-contratos-dono-${largura}.png`, fullPage: true });
      await d.goto(`/dashboard/fechamento?c=${ids.lead}`, { waitUntil: "domcontentloaded" });
      await expect(d.locator("main")).toContainText(`Studio taxa API ${sufixo}`, { timeout: 20_000 });
      await expect(d.locator("main")).toContainText("Ivan Taxa Sobrenome");
      await d.context().close();

      const i = await entrar(browser, inq.email, senha);
      await i.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      for (const rota of ["/dashboard/contratos", "/dashboard/locacoes", `/dashboard/locacoes/${ids.contrato}`]) {
        await i.goto(rota, { waitUntil: "domcontentloaded" });
        await i.locator("main").first().waitFor();
        await i.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
        const html = await i.content();
        expect(html, rota).not.toMatch(/comissao_valor|comissao_percent|accepted_commission|Taxa de serviço/);
        expect(html, rota).not.toMatch(/1\.536/);
      }
      await i.screenshot({ path: `${SAIDA}/t222-morador-${largura}.png`, fullPage: true });
      await i.context().close();
    });
  }
});
