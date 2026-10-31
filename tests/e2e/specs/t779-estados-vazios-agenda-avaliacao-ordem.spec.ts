import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T779 — estados vazios que dizem o que fazer, 2ª leva (Pista B, 31/10). Pista C, bloco 104. Pelas telas de verdade, a
  1280 e a 390 px, com contas novas:
   A. carteira do proprietário com um contrato que termina daqui a 120 dias: as três faixas de vencimento dizem
      "Nenhum contrato termina nesta faixa." (#1705);
   B. agenda do parceiro publicado sem janela nem bloqueio: o que vale sem janela e para que serve o bloqueio
      (#1702, #1706);
   C. avaliadora credenciada ativa sem pedido: "Visitas" diz o que entra e quando sai (#1707) e o histórico diz o que
      guarda (#1700);
   D. ordem de manutenção sem mensagem: cada lado lê o seu texto (#1703).
  Os outros merges do bloco já vêm com a guarda deles: #1698 (t756-texto-cortado-publico), #1699 (t598), #1701 (teste de
  unidade dos cantos do vídeo) e #1704 (t757, varredura da Pista A).
  A avaliadora fica numa cidade sem pedido (Araguari) e é apagada no fim, para não entrar no rodízio de outro spec.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t779.${sufixo}@lab.vivanomads.test`, nome: "Vera Vencimento", role: "owner" as const };
const morador = { email: `mor.t779.${sufixo}@lab.vivanomads.test`, nome: "Otto Ordem", role: "tenant" as const };
const avaliadora = { email: `ava.t779.${sufixo}@lab.vivanomads.test`, nome: "Alice Agenda", role: "tenant" as const };
const descricao = `Torneira do tanque pingando (T779 ${sufixo}).`;
const ids: Record<string, string> = {};

async function abrir(browser: Browser, email: string, caminho: string, largura: number, vistoria = false): Promise<Page> {
  const p = await entrar(browser, email, senha);
  await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  if (vistoria) await p.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: test.info().project.use.baseURL ?? new URL(p.url()).origin }]);
  await p.goto(caminho, { waitUntil: "domcontentloaded" });
  return p;
}

test.describe("T779 — estados vazios: carteira, agenda do parceiro, avaliação e mensagens da ordem (#1700, #1702, #1703, #1705, #1706, #1707)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.avaliadora = await criarConta(avaliadora, senha);
    // Com intenção gravada o login cai no painel; o proprietário no modo dono, os outros no de morador.
    await adm().from("profiles").update({ intencao: ["anunciar"] }).eq("id", ids.dono);
    for (const id of [ids.morador, ids.avaliadora]) await adm().from("profiles").update({ intencao: ["morar"] }).eq("id", id);
    ids.imovel = await criarImovelPronto(ids.dono, `Casa da ordem T779 ${sufixo}`, { ativo: true });
    ids.lead = await criarLead(ids.dono, ids.morador, ids.imovel, true);
    const agora = new Date();
    const dia = (d: Date) => d.toISOString().slice(0, 10);
    // Em vigência (F27): as duas assinaturas, bloco ativo e 1º aluguel confirmado. Termina daqui a 120 dias, fora das
    // faixas de até 90: dois blocos de 2 meses (prazo máximo 180 dias, bloco de 1 a 3 meses e até 90 dias); a carteira
    // lê o fim do último bloco (periodoDosBlocos). O 2º bloco entra com os dois aceites (regra da renovação).
    const { data: ct, error } = await adm()
      .from("contratos")
      .insert({ property_id: ids.imovel, tenant_id: ids.morador, lead_id: ids.lead, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 120, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 256, qtd_ocupantes: 1, status: "ativo", garantia: "caucao", assinado_proprietario_em: agora.toISOString(), assinado_inquilino_em: agora.toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = ct.id as string;
    const emDias = (n: number) => dia(new Date(agora.getTime() + n * 86_400_000));
    const { data: bloco, error: eb } = await adm()
      .from("contrato_blocos")
      .insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: emDias(0), fim: emDias(60), meses: 2, valor: 6400, caucao: 3200, status: "ativo" })
      .select("id")
      .single();
    if (eb) throw eb;
    const { error: eb2 } = await adm().from("contrato_blocos").insert({ contrato_id: ids.contrato, numero_bloco: 2, inicio: emDias(61), fim: emDias(120), meses: 2, valor: 6400, caucao: 0, status: "agendado", aceite_proprietario_em: agora.toISOString(), aceite_inquilino_em: agora.toISOString() });
    if (eb2) throw eb2;
    const { error: ep } = await adm().from("pagamentos_bloco").insert({ bloco_id: bloco.id, contrato_id: ids.contrato, tipo: "aluguel", valor: 3200, data_pagamento: dia(agora), marcado_por: ids.dono, confirmado_pelo_inquilino: true, confirmado_em: agora.toISOString() });
    if (ep) throw ep;
    const { data: so, error: eo } = await adm()
      .from("service_orders")
      .insert({ property_id: ids.imovel, tenant_id: ids.morador, owner_id: ids.dono, contrato_id: ids.contrato, category: "hidraulica", priority: "media", description: descricao, status: "aberto" })
      .select("id")
      .single();
    if (eo) throw eo;
    ids.ordem = so.id as string;
    const { data: parc, error: eP } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.avaliadora, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: avaliadora.nome, slug: `aval-t779-${sufixo}`, categorias: ["fotografia"], cidades: ["Araguari"], status: "publicado", publicado_em: agora.toISOString() })
      .select("id")
      .single();
    if (eP) throw eP;
    ids.parceiro = parc.id as string;
    const { data: numero } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "AGI" });
    const { data: cr, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: ids.parceiro, cidade: "Araguari", numero_credenciado: numero as string, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t779", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
      .select("id")
      .single();
    if (eC) throw eC;
    ids.cred = cr.id as string;
  });
  test.afterAll(async () => {
    if (ids.cred) {
      await adm().from("vistoria_designacoes").delete().eq("avaliador_id", ids.cred);
      await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    }
    if (ids.parceiro) {
      await adm().from("parceiro_agenda").delete().eq("parceiro_id", ids.parceiro);
      await adm().from("parceiros").delete().eq("id", ids.parceiro);
    }
    if (ids.ordem) await adm().from("service_orders").delete().eq("id", ids.ordem);
    if (ids.contrato) {
      for (const t of ["pagamentos_bloco", "contrato_eventos", "contrato_blocos"]) await adm().from(t).delete().eq("contrato_id", ids.contrato);
      await adm().from("contratos").delete().eq("id", ids.contrato);
    }
    if (ids.dono) await adm().from("leads").delete().eq("owner_id", ids.dono);
    await apagarContas([ids.dono, ids.morador, ids.avaliadora]);
  });

  for (const largura of [1280, 390] as const) {
    test(`A. ${largura} px: carteira — faixa de vencimento vazia diz que nenhum contrato termina nela (#1705)`, async ({ browser }) => {
      const p = await abrir(browser, dono.email, "/dashboard/carteira", largura);
      await expect(p.getByTestId("carteira-vencimentos")).toBeVisible({ timeout: 30_000 });
      for (const faixa of ["30", "60", "90"]) {
        await expect(p.getByTestId(`carteira-vence-${faixa}`)).toHaveAttribute("data-qtd", "0");
        await expect(p.getByTestId(`carteira-vence-${faixa}-vazio`)).toHaveText("Nenhum contrato termina nesta faixa.");
      }
      await p.context().close();
    });

    test(`B. ${largura} px: agenda do parceiro sem janela nem bloqueio diz o que vale e para que serve (#1702, #1706)`, async ({ browser }) => {
      const p = await abrir(browser, avaliadora.email, "/dashboard/parceiro", largura);
      await expect(p.getByTestId("parceiro-janelas-vazio")).toHaveText(
        "Nenhuma janela ainda: por enquanto, os pedidos aceitam qualquer horário futuro fora dos bloqueios. Adicione abaixo os dias e horários em que você atende, e só eles passam a valer.",
        { timeout: 30_000 },
      );
      await expect(p.getByTestId("parceiro-bloqueios-vazio")).toHaveText("Nenhum bloqueio. Bloqueie abaixo as datas em que você não atende (férias, por exemplo): nelas, nenhum pedido aceita horário.");
      await p.context().close();
    });

    test(`C. ${largura} px: avaliadora sem pedido — "Visitas" e o histórico dizem o que guardam (#1707, #1700)`, async ({ browser }) => {
      const p = await abrir(browser, avaliadora.email, "/dashboard/parceiro/avaliacao", largura, true);
      await expect(p.getByTestId("avaliacoes-visitas-vazio")).toHaveText(
        "Nenhuma visita por enquanto. As avaliações que você aceitar aparecem aqui, para agendar a visita com o proprietário, e saem daqui quando o laudo sai ou a avaliação é encerrada.",
        { timeout: 30_000 },
      );
      await expect(p.getByTestId("avaliacoes-historico-vazio")).toHaveText(
        "Aqui ficam as avaliações que você concluiu, as que recusou, as que passaram de 24 horas sem resposta e as ausências registradas. Ainda não há nenhuma.",
      );
      await p.context().close();
    });

    test(`D. ${largura} px: ordem sem mensagem — cada lado lê o seu texto (#1703)`, async ({ browser }) => {
      const casos = [
        { conta: dono, texto: "Nenhuma mensagem ainda. Escreva abaixo para o inquilino: a sua primeira mensagem já conta como resposta ao chamado." },
        { conta: morador, texto: "Nenhuma mensagem ainda. Escreva abaixo para o proprietário sobre este reparo: a conversa fica registrada nesta ordem." },
      ];
      for (const c of casos) {
        const p = await abrir(browser, c.conta.email, "/dashboard/solicitacoes", largura);
        const ordem = p.getByTestId("ordem-manutencao").filter({ hasText: descricao });
        await expect(ordem).toBeVisible({ timeout: 30_000 });
        await ordem.getByTestId("solicitacao-cartao").click();
        await expect(ordem.getByTestId("mensagens-ordem-vazio")).toHaveText(c.texto, { timeout: 20_000 });
        await p.context().close();
      }
    });
  }
});
