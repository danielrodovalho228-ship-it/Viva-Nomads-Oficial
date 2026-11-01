import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T818 — #1778 (E314, E315) e #1780 (E317), Pista C, bloco 132. Pela tela de verdade, como moradora, a 390 e a 1280 px,
  com contas novas (dono, moradora, dois anúncios), apagadas no fim:
   1. E314 — candidatura em aberto ("Enviada") diz o que acontece agora, o próximo passo e a ação ("Ver mensagens");
   2. E315 — a validade da proposta aparece no detalhe mesmo depois de recusada ("Validade: dd/mm/aaaa"); antes só
      aparecia com a proposta em aberto;
   3. E317 — o formulário do pedido de moradia diz a tolerância do teto ("até 10% acima desse valor").
  Fora daqui: E312/E313 (o próprio merge atualizou t375, t402 e t745) e o E318 ("pedida em" da visita cancelada, que
  pede duas visitas canceladas parecidas; tem teste de unidade no merge).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t818.${sufixo}@lab.vivanomads.test`, nome: "Dario Dono", role: "owner" as const };
const morador = { email: `mor.t818.${sufixo}@lab.vivanomads.test`, nome: "Marta Moradora", role: "tenant" as const };
const ids: Record<string, string> = {};
const emDias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

test.describe("T818 — E314/E315/E317: próximo passo da candidatura, validade da proposta, tolerância do teto (#1778, #1780)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    await adm().from("profiles").update({ intencao: ["anunciar"] }).eq("id", ids.dono);
    await adm().from("profiles").update({ intencao: ["morar"] }).eq("id", ids.morador);
    ids.imovelAberto = await criarImovelPronto(ids.dono, `Studio da candidatura t818 ${sufixo}`, { ativo: true });
    ids.imovelProposta = await criarImovelPronto(ids.dono, `Casa da proposta t818 ${sufixo}`, { ativo: true });
    // Candidatura "Enviada": lead novo, sem o dono ter engajado.
    ids.leadAberto = await criarLead(ids.dono, ids.morador, ids.imovelAberto, false);
    // Proposta recusada, com validade gravada.
    ids.leadProposta = await criarLead(ids.dono, ids.morador, ids.imovelProposta, true);
    const { data: numero } = await adm().rpc("next_document_number", { p_type: "orcamento", p_year: new Date().getFullYear() });
    const { data: pr, error } = await adm()
      .from("propostas")
      .insert({ numero, lead_id: ids.leadProposta, property_id: ids.imovelProposta, owner_id: ids.dono, tenant_id: ids.morador, status: "recusada", versao_atual: 1, validade_dias: 7, valida_ate: `${emDias(7)}T23:00:00Z` })
      .select("id")
      .single();
    if (error) throw error;
    ids.proposta = pr.id as string;
    const { error: ev } = await adm().from("proposta_versoes").insert({
      proposta_id: ids.proposta, versao: 1, autor: "owner", valor_base: 3200, valor_mensal: 3200, meses: 3, data_entrada: emDias(10),
      total_mensal: 3200, total_contrato: 9_600, mensagem: "Proposta da t818.",
    });
    if (ev) throw ev;
  });
  test.afterAll(async () => {
    if (ids.proposta) {
      await adm().from("proposta_versoes").delete().eq("proposta_id", ids.proposta);
      await adm().from("propostas").delete().eq("id", ids.proposta);
    }
    if (ids.dono) await adm().from("leads").delete().eq("owner_id", ids.dono);
    await apagarContas([ids.dono, ids.morador]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px: próximo passo da candidatura, validade da proposta recusada e tolerância do teto`, async ({ browser }) => {
      const p = await entrar(browser, morador.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });

      // 1. E314.
      await p.goto("/dashboard/candidaturas", { waitUntil: "domcontentloaded" });
      const passo = p.getByTestId("candidatura-proximo-passo").first();
      await expect(passo).toBeVisible({ timeout: 30_000 });
      await expect(passo).toContainText("O proprietário recebeu a sua candidatura e ainda vai olhar.");
      await expect(passo).toContainText("Fique de olho nas mensagens: a resposta do proprietário chega pela plataforma.");
      const acao = passo.getByTestId("candidatura-proximo-passo-acao");
      await expect(acao).toContainText("Ver mensagens");
      await expect(acao).toHaveAttribute("href", "/dashboard/mensagens");

      // 2. E315.
      await p.goto(`/dashboard/propostas/${ids.proposta}`, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("proposta-validade")).toHaveText(/Validade: \d{2}\/\d{2}\/\d{4}/, { timeout: 30_000 });

      // 3. E317.
      await p.goto("/pedidos/novo", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("pedido-tolerancia-teto").first()).toHaveText("Você também recebe imóveis até 10% acima desse valor, marcados como acima do teto.", { timeout: 30_000 });
      await p.context().close();
    });
  }
});
