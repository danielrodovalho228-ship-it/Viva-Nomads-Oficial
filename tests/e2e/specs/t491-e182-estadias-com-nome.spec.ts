import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T491 — E182 (QA ao vivo 25/10): em Minhas estadias, todo cartão traz o nome do imóvel — inclusive quando o imóvel
  foi pausado depois do contrato (o RLS de properties não mostra ao morador imóvel fora do ar; o cartão virava "Imóvel").
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t491.${sufixo}@lab.vivanomads.test`, nome: "Dina Nome", role: "owner" as const };
const morador = { email: `morador.t491.${sufixo}@lab.vivanomads.test`, nome: "Mel Nome", role: "tenant" as const };
const ids: Record<string, string> = {};
const TITULOS = [`Studio ativo t491 ${sufixo}`, `Loft pausado t491 ${sufixo}`];

test.describe("T491 — E182: estadias sempre com o nome do imóvel", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    const base = { tenant_id: ids.morador, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3000, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 240, qtd_ocupantes: 1, status: "concluido", garantia: "caucao", encerrado_em: new Date(Date.now() - 5 * 86_400_000).toISOString() };
    for (const [i, t] of TITULOS.entries()) {
      const imovel = await criarImovelPronto(ids.dono, t, { ativo: true });
      const lead = await criarLead(ids.dono, ids.morador, imovel, true);
      const { data, error } = await adm().from("contratos").insert({ ...base, property_id: imovel, lead_id: lead }).select("id").single();
      if (error) throw error;
      ids[`contrato${i}`] = data.id as string;
      ids[`imovel${i}`] = imovel;
    }
    // O segundo imóvel sai do ar depois do contrato.
    const { error } = await adm().from("properties").update({ status: "paused" }).eq("id", ids.imovel1);
    if (error) throw error;
  });
  test.afterAll(async () => {
    for (const k of ["contrato0", "contrato1"]) if (ids[k]) await adm().from("contratos").delete().eq("id", ids[k]);
    await apagarContas([ids.dono, ids.morador]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — os dois cartões com o nome, nenhum só "Imóvel"`, async ({ browser }) => {
      const p = await entrar(browser, morador.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
      const cartoes = p.getByTestId("locacao-cartao");
      await expect(cartoes).toHaveCount(2, { timeout: 30_000 });
      for (const t of TITULOS) await expect(cartoes.filter({ hasText: t })).toHaveCount(1);
      await expect(p.getByTestId("locacao-titulo").filter({ hasText: /^Imóvel$/ })).toHaveCount(0);
      await p.screenshot({ path: `${SAIDA}/t491-estadias-${largura}.png`, fullPage: true });
      await p.context().close();
    });
  }
});
