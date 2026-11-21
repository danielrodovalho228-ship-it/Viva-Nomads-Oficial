import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1657 — E966 (lab, 390 e 1280): proposta com a validade vencida e o aviso CRÍTICO "responda a proposta" pendente para as
 * duas partes. O morador abre as propostas (a expiração roda na leitura): a proposta vira "Expirada", os avisos das DUAS
 * partes ficam resolvidos e a faixa vermelha do topo some. Antes: a faixa ficava para sempre.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: string[] = [];
const ontem = () => new Date(Date.now() - 86_400_000).toISOString();

test.describe("T1657 — @E966 proposta expirada resolve o aviso crítico e a faixa", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas de teste).");
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const largura of [390, 1280] as const) {
    test(`validade vencida: proposta 'Expirada', avisos das duas partes resolvidos, sem faixa vermelha (${largura} px)`, async ({ browser }) => {
      test.setTimeout(150_000);
      const tag = `e966.${largura}.${sufixo}`;
      const dono = { email: `dono.${tag}@lab.vivanomads.test`, id: "" };
      const inq = { email: `inq.${tag}@lab.vivanomads.test`, id: "" };
      dono.id = await criarConta({ email: dono.email, nome: "Dora Dona", role: "owner" }, senha);
      inq.id = await criarConta({ email: inq.email, nome: "Ivo Inquilino", role: "tenant" }, senha);
      ids.push(dono.id, inq.id);
      const imovel = await criarImovelPronto(dono.id, `Studio E966 ${largura}`, { ativo: true, preco: 3200 });
      const lead = await criarLead(dono.id, inq.id, imovel);
      const { data: numero } = await adm().rpc("next_document_number", { p_type: "orcamento", p_year: new Date().getFullYear() });
      const { data: p, error } = await adm()
        .from("propostas")
        .insert({ numero, lead_id: lead, property_id: imovel, owner_id: dono.id, tenant_id: inq.id, status: "enviada", versao_atual: 1, validade_dias: 3, valida_ate: ontem() })
        .select("id")
        .single();
      if (error) throw error;
      const entrada = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
      await adm().from("proposta_versoes").insert({ proposta_id: p.id, versao: 1, autor: "owner", valor_base: 3200, valor_mensal: 3200, meses: 4, data_entrada: entrada, total_mensal: 3200, total_contrato: 12800 });
      // O crítico "responda a proposta" para o morador e o "vencendo" para os dois, como o envio e a rotina gravam.
      await adm().from("avisos").insert([
        { usuario_id: inq.id, evento: "proposta_recebida", prioridade: "critico", titulo: "Você recebeu uma proposta", url: `/dashboard/propostas/${p.id}`, ref_id: p.id },
        { usuario_id: inq.id, evento: "proposta_vencendo", prioridade: "critico", titulo: "A proposta vence hoje", url: `/dashboard/propostas/${p.id}`, ref_id: p.id },
        { usuario_id: dono.id, evento: "proposta_vencendo", prioridade: "critico", titulo: "A proposta vence hoje", url: `/dashboard/propostas/${p.id}`, ref_id: p.id },
      ]);

      const page = await entrar(browser, inq.email, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/dashboard/propostas", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("proposta-status").first()).toHaveText("Expirada", { timeout: 20_000 });
      await expect
        .poll(async () => ((await adm().from("avisos").select("resolvido_em").eq("ref_id", p.id)).data ?? []).map((a) => !!a.resolvido_em), { timeout: 15_000 })
        .toEqual([true, true, true]);
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await expect(page.getByTestId("faixa-critico")).toHaveCount(0);
      await page.screenshot({ path: `tests/laboratorio/saida/t1657-e966-${largura}.png` });
      await page.context().close();
    });
  }
});
