import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T776 — estados vazios que dizem o que fazer (Pista B, 31/10): #1695 (Início do proprietário, "Atividade recente"),
  #1696 (conferência sem itens) e #1697 (ocupantes sem ninguém). Pista C, bloco 103. Pelas telas de verdade, a 1280 e
  a 390 px, com um proprietário novo e uma moradora num contrato assinado para 2 ocupantes, bloco começando hoje:
   A. Início do proprietário: no lugar de "Sem atividade recente ainda.", a frase leva às Notificações;
   B. conferência de entrada sem cômodo, pelo proprietário (a vez dele): diz o que registrar e onde, no lugar de
      "Nenhum item registrado ainda.";
   C. ocupantes sem ninguém: a moradora lê o que preencher ("até 2 pessoas") e o proprietário lê o que vai aparecer.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t776.${sufixo}@lab.vivanomads.test`, nome: "Vera Vazio", role: "owner" as const };
const morador = { email: `mor.t776.${sufixo}@lab.vivanomads.test`, nome: "Otto Vazio", role: "tenant" as const };
const ids: Record<string, string> = {};

async function abrir(browser: Browser, email: string, caminho: string, largura: number): Promise<Page> {
  const p = await entrar(browser, email, senha);
  await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  await p.goto(caminho, { waitUntil: "domcontentloaded" });
  return p;
}

test.describe("T776 — estados vazios do painel dizem o que fazer (#1695, #1696, #1697)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    // Com intenção gravada o login cai no painel; o proprietário com "anunciar" (o Início dele mostra o bloco do dono).
    await adm().from("profiles").update({ intencao: ["anunciar"] }).eq("id", ids.dono);
    await adm().from("profiles").update({ intencao: ["morar"] }).eq("id", ids.morador);
    ids.imovel = await criarImovelPronto(ids.dono, `Casa vazia T776 ${sufixo}`, { ativo: true });
    // Um anúncio publicado sem contrato: o bloco do dono no Início (com a "Atividade recente") só aparece com anúncio no ar.
    ids.publicado = await criarImovelPronto(ids.dono, `Studio no ar T776 ${sufixo}`, { ativo: true });
    ids.lead = await criarLead(ids.dono, ids.morador, ids.imovel, true);
    const agora = new Date().toISOString();
    const { data, error } = await adm()
      .from("contratos")
      .insert({ property_id: ids.imovel, tenant_id: ids.morador, lead_id: ids.lead, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 256, qtd_ocupantes: 2, status: "ativo", garantia: "caucao", assinado_proprietario_em: agora, assinado_inquilino_em: agora })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    const hoje = new Date();
    const dia = (d: Date) => d.toISOString().slice(0, 10);
    const { error: eb } = await adm().from("contrato_blocos").insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: dia(hoje), fim: dia(new Date(hoje.getTime() + 60 * 86_400_000)), meses: 2, valor: 6400, caucao: 3200, status: "ativo" });
    if (eb) throw eb;
  });
  test.afterAll(async () => {
    if (ids.contrato) {
      const { data: confs } = await adm().from("conferencias").select("id").eq("contrato_id", ids.contrato);
      const confIds = (confs ?? []).map((c) => c.id as string);
      if (confIds.length) {
        for (const t of ["conferencia_laudos", "conferencia_respostas", "conferencia_itens"]) await adm().from(t).delete().in("conferencia_id", confIds);
        await adm().from("conferencias").delete().in("id", confIds);
      }
      for (const t of ["pagamentos_bloco", "contrato_eventos", "contrato_blocos"]) await adm().from(t).delete().eq("contrato_id", ids.contrato);
      await adm().from("contratos").delete().eq("id", ids.contrato);
    }
    if (ids.dono) await adm().from("leads").delete().eq("owner_id", ids.dono);
    await apagarContas([ids.dono, ids.morador]);
  });

  for (const largura of [1280, 390] as const) {
    test(`A. ${largura} px: Início do proprietário leva às Notificações (#1695)`, async ({ browser }) => {
      const p = await abrir(browser, dono.email, "/dashboard", largura);
      const vazio = p.getByTestId("atividade-recente-vazia");
      await expect(vazio).toBeVisible({ timeout: 30_000 });
      await expect(vazio).toHaveText("As novidades dos seus imóveis (interessados, propostas, visitas e avisos) chegam em Notificações.");
      await expect(vazio.getByRole("link", { name: "Notificações" })).toHaveAttribute("href", "/dashboard/notificacoes");
      await expect(p.getByText("Sem atividade recente ainda.")).toHaveCount(0);
      await p.context().close();
    });

    test(`B. ${largura} px: conferência de entrada sem cômodo diz o que registrar (#1696)`, async ({ browser }) => {
      const p = await abrir(browser, dono.email, `/dashboard/contratos/${ids.contrato}`, largura);
      const vazio = p.getByTestId("conferencia-entrada-vazia");
      await expect(vazio).toBeVisible({ timeout: 30_000 });
      await expect(vazio).toHaveText('Ninguém registrou cômodos ainda. Registre abaixo o estado de cada cômodo, com foto, em "Adicionar item": a outra parte confere e confirma ou contesta.');
      await expect(p.getByText("Nenhum item registrado ainda.")).toHaveCount(0);
      await p.context().close();
    });

    test(`C. ${largura} px: ocupantes sem ninguém — a moradora sabe o que preencher, o proprietário o que vai aparecer (#1697)`, async ({ browser }) => {
      const m = await abrir(browser, morador.email, `/dashboard/estadia/${ids.contrato}/ocupantes`, largura);
      await expect(m.getByTestId("ocupantes-vazio")).toHaveText("Ninguém na lista ainda. Preencha abaixo quem vai morar no imóvel (até 2 pessoas): a lista para a portaria sai com esses nomes.", { timeout: 30_000 });
      await expect(m.getByText("Nenhum ocupante preenchido ainda.")).toHaveCount(0);
      await m.context().close();
      const d = await abrir(browser, dono.email, `/dashboard/estadia/${ids.contrato}/ocupantes`, largura);
      await expect(d.getByTestId("ocupantes-vazio")).toHaveText("Ninguém na lista ainda. Quando o morador preencher quem vai morar no imóvel, os nomes e a lista para a portaria aparecem aqui.", { timeout: 30_000 });
      await d.context().close();
    });
  }
});
