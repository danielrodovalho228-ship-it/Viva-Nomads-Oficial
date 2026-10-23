import { test, expect, type Browser, type Locator, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import {
  NO_LABORATORIO,
  adm,
  apagarContas,
  criarConta,
  criarImovelPronto,
  criarLead,
  entrar,
  novaSenha,
  novoSufixo,
  tornarContratoVigente,
} from "../fixtures/laboratorio";
import { CHAVES_CONFORTO, ITENS_CONFORTO } from "../../../src/config/conforto-minimo";

/*
  T288 — Prompt 59-A: a exibição do padrão mínimo e do compromisso de manutenção, a 390 e 1280 px. Só no laboratório.
   1. Cadastro: o bloco "Padrão mínimo da Viva" no passo Comodidades (os itens da lista, critério em uma linha); faltando item, a
      Revisão diz "Falta confirmar: …" ao lado do Publicar e o "Confirmar agora" volta ao bloco; completo, some.
   2. Painel do dono: "Confirme o padrão mínimo de [imóvel] até [data]" (a linha é o link para confirmar) e a pendência
      de conforto da entrada com o prazo, em "Hoje você tem N decisões".
   3. Conferência de entrada: "não confere" abre o texto curto e a foto opcional.
   4. Página do imóvel: "Padrão mínimo da Viva: confirmado pelo proprietário" + "O que é o padrão mínimo", o compromisso
      de manutenção com o texto exato e, no cartão do proprietário, a taxa (3 chamados resolvidos: 2 no prazo → 67%).
   5. Chamado nos 4 estados (no prazo, vencido, resolvido no prazo, fora do prazo); o dono vê "Chamar um parceiro de
      manutenção" só no vencido; o morador vê "Confirmar solução" / "Ainda não resolveu" com o "Responda até".
   6. Admin: "manutenção fora do prazo" e "pendência de conforto contestada" no topo das decisões; a fila decide
      procedente / improcedente.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.59a.${sufixo}@lab.vivanomads.test`, nome: "Regina Padrão", role: "owner" as const };
const inquilino = { email: `inq.59a.${sufixo}@lab.vivanomads.test`, nome: "Caio Padrão", role: "tenant" as const };
const T = {
  rascunho: `Studio do cadastro 59-A ${sufixo}`,
  antigo: `Loft sem padrão 59-A ${sufixo}`,
  casa: `Casa do compromisso 59-A ${sufixo}`,
};
const COMPROMISSO = "Manutenção: urgente com solução provisória em até 24 h e definitiva em até 72 h · comum em até 72 h · demais em até 7 dias";
const H = 3_600_000;
const LARGURAS = [390, 1280] as const;
const ORDENS = {
  no_prazo: `Lâmpada da sala queimada (${sufixo}).`,
  vencido: `Torneira da cozinha pingando (${sufixo}).`,
  resolvido_no_prazo: `Fechadura do quarto emperrada (${sufixo}).`,
  resolvido_fora: `Descarga sem parar de correr (${sufixo}).`,
};
const ids: { dono?: string; inquilino?: string; rascunho?: string; antigo?: string; casa?: string; lead?: string; contrato?: string } = {};

async function semRolagemLateral(page: Page) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra, "sem rolagem lateral").toBeLessThanOrEqual(1);
}

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}

async function admin(browser: Browser, w: number): Promise<Page> {
  const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: 900 }, timezoneId: "America/Sao_Paulo" });
  return ctx.newPage();
}

/** Um primário por tela: dentro do trecho, no máximo um botão com o estilo primário (bg-forest cheio). */
async function noMaximoUmPrimario(trecho: Locator, nome: string) {
  const n = await trecho.evaluate((el) =>
    [...el.querySelectorAll("button, a")].filter((b) => /(^|\s)bg-(forest|gold)(\s|$)/.test(b.className) && (b as HTMLElement).offsetParent).length,
  );
  expect(n, `${nome}: no máximo um primário`).toBeLessThanOrEqual(1);
}

test.describe("T288 — Prompt 59-A: padrão mínimo e compromisso de manutenção na tela", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inquilino = await criarConta(inquilino, senha);
    ids.rascunho = await criarImovelPronto(ids.dono, T.rascunho, { semConforto: true });
    // O assistente lê o rascunho de draft_data: título, valor mensal e garantia preenchidos, para o Continuar chegar à Revisão.
    await adm().from("properties").update({ draft_data: { title: T.rascunho, monthlyPrice: "3200", garantias: { caucao: true }, step: 3, ordemEtapas: 4, etapaMax: 5 } }).eq("id", ids.rascunho!);
    ids.antigo = await criarImovelPronto(ids.dono, T.antigo, { ativo: true, semConforto: true });
    ids.casa = await criarImovelPronto(ids.dono, T.casa, { ativo: true });
    ids.lead = await criarLead(ids.dono, ids.inquilino, ids.casa, true);
    const { data, error } = await adm()
      .from("contratos")
      .insert({
        property_id: ids.casa,
        tenant_id: ids.inquilino,
        lead_id: ids.lead,
        owner_plan: "essential",
        faixa: "temporada",
        prazo_total_dias: 60,
        aluguel_mensal: 3200,
        tamanho_bloco_meses: 2,
        comissao_percent: 0.08,
        comissao_valor: 512,
        qtd_ocupantes: 1,
        status: "ativo",
        garantia: "caucao",
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    await tornarContratoVigente(ids.contrato, ids.dono, 3200);

    // Prazo de adequação do anúncio antigo e duas pendências da entrada (uma aberta, uma contestada pelo dono).
    const agora = Date.now();
    const { error: eAdeq } = await adm().from("conforto_adequacao").upsert({ property_id: ids.antigo, prazo_ate: new Date(agora + 20 * 24 * H).toISOString(), lembretes: [], pausado_em: null });
    if (eAdeq) throw eAdeq;
    const { error: ePend } = await adm().from("conforto_pendencias").insert([
      { property_id: ids.casa, contrato_id: ids.contrato, chave: CHAVES_CONFORTO[1], status: "aberta", prazo_ate: new Date(agora + 5 * 24 * H).toISOString(), texto_morador: "Não conferiu na entrada." },
      {
        property_id: ids.casa,
        contrato_id: ids.contrato,
        chave: CHAVES_CONFORTO[3],
        status: "contestada",
        prazo_ate: new Date(agora + 5 * 24 * H).toISOString(),
        texto_morador: `Item ausente (${sufixo}).`,
        contestada_em: new Date(agora).toISOString(),
        motivo_contestacao: "O item estava no imóvel na entrega.",
      },
    ]);
    if (ePend) throw ePend;

    // Os 4 estados do chamado (2 resolvidos; o 3º entra no teste 4, para a taxa).
    const base = { property_id: ids.casa, tenant_id: ids.inquilino, owner_id: ids.dono, category: "outros" };
    const iso = (ms: number) => new Date(ms).toISOString();
    const { error: eOrd } = await adm()
      .from("service_orders")
      .insert([
        { ...base, priority: "baixa", description: ORDENS.no_prazo, status: "aberto", opened_at: iso(agora - 2 * H), first_response_at: iso(agora - H) },
        { ...base, priority: "media", description: ORDENS.vencido, status: "em_andamento", opened_at: iso(agora - 100 * H), first_response_at: iso(agora - 99 * H) },
        {
          ...base,
          priority: "media",
          description: ORDENS.resolvido_no_prazo,
          status: "resolvido",
          opened_at: iso(agora - 10 * H),
          first_response_at: iso(agora - 9 * H),
          solucao_marcada_em: iso(agora - H),
          resolved_at: iso(agora - H),
        },
        {
          ...base,
          priority: "media",
          description: ORDENS.resolvido_fora,
          status: "resolvido",
          opened_at: iso(agora - 200 * H),
          first_response_at: iso(agora - 199 * H),
          solucao_marcada_em: iso(agora - 100 * H),
          resolved_at: iso(agora - 100 * H),
          solucao_confirmada_em: iso(agora - 90 * H),
        },
      ]);
    if (eOrd) throw eOrd;
  });

  test.afterAll(async () => {
    if (ids.casa) await adm().from("service_orders").delete().eq("property_id", ids.casa);
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await apagarContas([ids.dono, ids.inquilino]);
  });

  test("1. cadastro: o bloco no passo Comodidades e o 'Falta confirmar' junto do Publicar", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    for (const w of LARGURAS) {
      await largura(page, w);
      await page.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=comodidades`, { waitUntil: "domcontentloaded" });
      const bloco = page.getByTestId("conforto-checklist");
      await expect(bloco).toBeVisible({ timeout: 30_000 });
      await expect(bloco).toContainText("Padrão mínimo da Viva");
      for (const i of ITENS_CONFORTO) {
        const item = page.getByTestId(`conforto-item-${i.chave}`);
        await expect(item.getByRole("checkbox")).toBeVisible();
        await expect(item).toContainText(i.rotulo);
        await expect(item).toContainText(i.criterio);
      }
      // Faltando 2 itens (marca um a um: o rascunho guarda o que foi marcado na largura anterior).
      for (const k of CHAVES_CONFORTO) await page.getByTestId(`conforto-item-${k}`).getByRole("checkbox").setChecked(k !== CHAVES_CONFORTO[0] && k !== CHAVES_CONFORTO[4]);
      await expect(page.getByTestId("conforto-faltam")).toHaveText("Faltam confirmar 2 itens.");
      await semRolagemLateral(page);
      await page.screenshot({ path: `tests/laboratorio/saida/t288-1-comodidades-faltando-${w}.png`, fullPage: true });

      await page.getByTestId("cadastro-continuar").click();
      await page.getByTestId("cadastro-continuar").click();
      const falta = page.getByTestId("publicar-falta-conforto");
      await expect(falta).toContainText(`Falta confirmar: ${ITENS_CONFORTO[0].rotulo}, ${ITENS_CONFORTO[4].rotulo}.`, { timeout: 20_000 });
      await expect(page.getByTestId("publicar-anuncio")).toBeDisabled();
      await semRolagemLateral(page);
      await page.screenshot({ path: `tests/laboratorio/saida/t288-1-revisao-falta-${w}.png`, fullPage: true });

      // "Confirmar agora" volta ao bloco; completo, a linha some da Revisão.
      await page.getByTestId("publicar-falta-conforto-resolver").click();
      await expect(page.getByTestId("conforto-checklist")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("conforto-marcar-todos")).toBeEnabled();
      await page.getByTestId("conforto-marcar-todos").click();
      await expect(page.getByTestId("conforto-checklist")).toHaveAttribute("data-faltam", "0");
      await page.getByTestId("cadastro-continuar").click();
      await page.getByTestId("cadastro-continuar").click();
      // Completo: a linha do padrão mínimo some; o que ainda falta no rascunho de teste continua listado ao lado.
      await expect(page.getByTestId("publicar-falta-outros")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("publicar-falta-conforto")).toHaveCount(0);
      await semRolagemLateral(page);
      await page.screenshot({ path: `tests/laboratorio/saida/t288-1-revisao-completa-${w}.png`, fullPage: true });
    }
    await page.context().close();
  });

  test("2. painel do dono: aviso do padrão mínimo e pendência de conforto com prazo", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    for (const w of LARGURAS) {
      await largura(page, w);
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const lista = page.getByTestId("lista-decisoes");
      const aviso = lista.locator(`[data-decisao="conforto-${ids.antigo}"]`);
      await expect(aviso).toContainText(new RegExp(`^Confirme o padrão mínimo de ${T.antigo} até \\d{2}/\\d{2}/\\d{4}`), { timeout: 30_000 });
      await expect(aviso).toHaveAttribute("href", `/dashboard/imoveis/${ids.antigo}/conforto`);
      const pend = lista.locator('[data-tipo="conforto"]').filter({ hasText: `Corrigir "${ITENS_CONFORTO[1].rotulo}"` });
      await expect(pend).toContainText(T.casa);
      await expect(pend.getByTestId("decisao-prazo")).toBeVisible();
      await semRolagemLateral(page);
      await page.screenshot({ path: `tests/laboratorio/saida/t288-2-painel-dono-${w}.png`, fullPage: true });
    }
    // A ação está dentro do aviso: abre a confirmação do padrão mínimo.
    await page.locator(`[data-decisao="conforto-${ids.antigo}"]`).click();
    await expect(page.getByTestId("conforto-checklist")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Padrão mínimo da Viva");
    await page.context().close();
  });

  test("3. conferência de entrada: 'não confere' abre o texto curto e a foto opcional", async ({ browser }) => {
    const page = await entrar(browser, inquilino.email, senha);
    const k = CHAVES_CONFORTO[2];
    for (const w of LARGURAS) {
      await largura(page, w);
      await page.goto(`/dashboard/locacoes/${ids.contrato}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("conforto-entrada-form")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId(`conforto-texto-${k}`)).toHaveCount(0);
      await page.getByTestId(`conforto-nao-confere-${k}`).check();
      await expect(page.getByTestId(`conforto-texto-${k}`)).toBeVisible();
      await expect(page.getByTestId(`conforto-foto-${k}`)).toHaveCount(1);
      await page.getByTestId(`conforto-texto-${k}`).fill("Chuveiro só sai frio.");
      await page.getByTestId(`conforto-entrada-item-${k}`).scrollIntoViewIfNeeded();
      await semRolagemLateral(page);
      await page.screenshot({ path: `tests/laboratorio/saida/t288-3-entrada-nao-confere-${w}.png`, fullPage: true });
    }
    await page.context().close();
  });

  test("4. página do imóvel: padrão mínimo confirmado, compromisso de manutenção e taxa do proprietário", async ({ browser }) => {
    // A página pública guarda o resultado por até 60 s: cada caso visita um imóvel que ainda não foi aberto.
    // Com 2 chamados resolvidos, a taxa fica oculta; o imóvel sem o padrão confirmado mostra só o compromisso.
    for (const w of LARGURAS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      await page.goto(`/imoveis/${ids.antigo}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("compromisso-manutencao")).toHaveText(COMPROMISSO, { timeout: 30_000 });
      await expect(page.getByTestId("padrao-minimo-confirmado")).toHaveCount(0);
      await expect(page.getByTestId("proprietario-manutencao-prazo")).toHaveCount(0);
      await ctx.close();
    }

    // O 3º chamado resolvido (2 no prazo de 3 → 67%).
    const agora = Date.now();
    const { error } = await adm().from("service_orders").insert({
      property_id: ids.casa,
      tenant_id: ids.inquilino,
      owner_id: ids.dono,
      category: "outros",
      priority: "baixa",
      description: `Prateleira solta (${sufixo}).`,
      status: "resolvido",
      opened_at: new Date(agora - 300 * H).toISOString(),
      first_response_at: new Date(agora - 299 * H).toISOString(),
      solucao_marcada_em: new Date(agora - 290 * H).toISOString(),
      resolved_at: new Date(agora - 290 * H).toISOString(),
      solucao_confirmada_em: new Date(agora - 280 * H).toISOString(),
    });
    if (error) throw error;

    for (const w of LARGURAS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      await page.goto(`/imoveis/${ids.casa}`, { waitUntil: "domcontentloaded" });
      const bloco = page.getByTestId("padrao-minimo-imovel");
      await expect(bloco).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("padrao-minimo-confirmado")).toContainText("Padrão mínimo da Viva: confirmado pelo proprietário");
      await expect(page.getByTestId("compromisso-manutencao")).toHaveText(COMPROMISSO);
      await expect(page.getByTestId("proprietario-manutencao-prazo")).toContainText("Manutenção resolvida no prazo: 67%");
      await semRolagemLateral(page);
      await bloco.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `tests/laboratorio/saida/t288-4-imovel-${w}.png` });
      await page.getByTestId("padrao-minimo-o-que-e").click();
      await expect(page.getByTestId("padrao-minimo-folha")).toBeVisible();
      await expect(page.getByTestId("padrao-minimo-folha")).toContainText(`Os ${ITENS_CONFORTO.length} itens que todo imóvel da Viva tem.`);
      for (const i of ITENS_CONFORTO) await expect(page.getByTestId(`padrao-minimo-folha-${i.chave}`)).toContainText(i.criterio);
      await page.screenshot({ path: `tests/laboratorio/saida/t288-4-o-que-e-${w}.png` });
      await ctx.close();
    }
  });

  test("5. chamado: os 4 estados, o parceiro só no vencido e a resposta do morador em 48 h", async ({ browser }) => {
    const esperado = { no_prazo: "No prazo", vencido: "Vencido", resolvido_no_prazo: "Resolvido no prazo", resolvido_fora: "Fora do prazo" } as const;
    const donoPg = await entrar(browser, dono.email, senha);
    for (const w of LARGURAS) {
      await largura(donoPg, w);
      await donoPg.goto("/dashboard/solicitacoes", { waitUntil: "domcontentloaded" });
      for (const [estado, texto] of Object.entries(ORDENS) as [keyof typeof ORDENS, string][]) {
        const o = donoPg.getByTestId("ordem-manutencao").filter({ hasText: texto });
        await expect(o.getByTestId("solucao-ordem")).toHaveAttribute("data-estado", estado, { timeout: 30_000 });
        await expect(o.getByTestId("solucao-estado")).toHaveText(esperado[estado]);
        await expect(o.getByTestId("solucao-ordem")).toContainText("Resolver até");
        await expect(o.getByTestId("ordem-chamar-parceiro")).toHaveCount(estado === "vencido" ? 1 : 0);
      }
      const vencido = donoPg.getByTestId("ordem-manutencao").filter({ hasText: ORDENS.vencido });
      await expect(vencido.getByTestId("ordem-chamar-parceiro")).toHaveText("Chamar um parceiro de manutenção");
      await expect(vencido.getByTestId("prazo-ordem")).toContainText("Responder até");
      await semRolagemLateral(donoPg);
      await donoPg.screenshot({ path: `tests/laboratorio/saida/t288-5-chamados-dono-${w}.png`, fullPage: true });
    }
    await donoPg.context().close();

    const morador = await entrar(browser, inquilino.email, senha);
    for (const w of LARGURAS) {
      await largura(morador, w);
      await morador.goto("/dashboard/solicitacoes", { waitUntil: "domcontentloaded" });
      const o = morador.getByTestId("ordem-manutencao").filter({ hasText: ORDENS.resolvido_no_prazo });
      await expect(o.getByTestId("solucao-estado")).toHaveText("Resolvido no prazo", { timeout: 30_000 });
      await expect(morador.getByTestId("ordem-chamar-parceiro")).toHaveCount(0);
      await o.getByTestId("solicitacao-cartao").click();
      await expect(o.getByTestId("ordem-confirmar-solucao")).toHaveText("Confirmar solução");
      await expect(o.getByTestId("ordem-reabrir")).toHaveText("Ainda não resolveu");
      await expect(o.getByTestId("ordem-responder-ate")).toContainText("Responda até");
      await noMaximoUmPrimario(o, "chamado aberto do morador");
      // Fora da janela de 48 h (já confirmado), não há botões.
      const fora = morador.getByTestId("ordem-manutencao").filter({ hasText: ORDENS.resolvido_fora });
      await fora.getByTestId("solicitacao-cartao").click();
      await expect(fora.getByTestId("ordem-confirmar-solucao")).toHaveCount(0);
      await semRolagemLateral(morador);
      await morador.screenshot({ path: `tests/laboratorio/saida/t288-5-chamados-morador-${w}.png`, fullPage: true });
      await o.getByTestId("solicitacao-cartao").click();
      await fora.getByTestId("solicitacao-cartao").click();
    }
    await morador.context().close();
  });

  test("6. admin: as duas filas do 59 no topo das decisões e a decisão da contestação", async ({ browser }) => {
    for (const w of LARGURAS) {
      const a = await admin(browser, w);
      await a.goto("/admin", { waitUntil: "domcontentloaded" });
      const linhas = a.getByTestId("admin-decisoes").locator("li[data-decisao]");
      await expect(linhas.first()).toHaveAttribute("data-decisao", "manutencao_fora_prazo", { timeout: 30_000 });
      await expect(linhas.first()).toContainText(/\d+ (manutenção|manutenções) fora do prazo/);
      await expect(linhas.nth(1)).toHaveAttribute("data-decisao", "conforto_contestacoes");
      await expect(linhas.nth(1)).toContainText(/\d+ (pendência de conforto contestada|pendências de conforto contestadas)/);
      await expect(a.getByTestId("decisao-conforto_contestacoes")).toHaveText("Decidir");
      await semRolagemLateral(a);
      await a.screenshot({ path: `tests/laboratorio/saida/t288-6-admin-decisoes-${w}.png` });

      await a.getByTestId("decisao-conforto_contestacoes").click();
      const linha = a.getByTestId("contestacao-linha").filter({ hasText: T.casa });
      await expect(linha).toBeVisible({ timeout: 30_000 });
      await expect(linha.getByTestId("contestacao-procedente")).toBeVisible();
      await expect(linha.getByTestId("contestacao-improcedente")).toBeVisible();
      await semRolagemLateral(a);
      await a.screenshot({ path: `tests/laboratorio/saida/t288-6-admin-contestacoes-${w}.png`, fullPage: true });
      if (w === 1280) {
        await linha.getByTestId("contestacao-improcedente").click();
        await expect(a.getByTestId("contestacao-linha").filter({ hasText: T.casa })).toHaveCount(0, { timeout: 20_000 });
      }
      await a.context().close();
    }
    const { data } = await adm().from("conforto_pendencias").select("status").eq("contrato_id", ids.contrato!).eq("chave", CHAVES_CONFORTO[3]).single();
    expect(data?.status).toBe("improcedente");
  });
});
