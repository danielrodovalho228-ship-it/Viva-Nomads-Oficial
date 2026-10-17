import { test, expect, type Browser, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T191 — Orçamentos de verdade (prompt 17), com 2 contas de teste por cenário, a 390 e 1280 px:
  1. proprietário envia R$ 3.200 × 4 (v1) → interessado vê "Vista" → "Vou ficar mais tempo" (6 meses, 6%) (v2) →
     proprietário aceita → o Fechamento abre com R$ 3.008 × 6 = R$ 18.048, sem redigitar;
  2. o interessado recusa com motivo → o proprietário vê o status e o motivo; nada de fechamento;
  3. validade vencida → "Expirada" e os botões somem;
  4. três versões → a 4ª contraproposta não aparece;
  5. outra pessoa não abre a proposta (não encontrada);
  6. "meu zap 34 9…" na contraproposta aparece como contato protegido;
  F/H/J: valor fixo (sem Contrapropor); abaixo do mínimo privado (só a próxima centena, nunca o número);
         só "meses" liberado (o valor mensal não aparece para editar).
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: (string | undefined)[] = [];

const NEGOCIA = { aceita: true, itens: ["valor_mensal", "meses", "data_entrada", "limpeza"], descontos: [{ mesesMin: 6, pct: 6 }] };

function emDias(d: number): string {
  return new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
}

interface Cenario {
  dono: { id: string; email: string };
  inq: { id: string; email: string };
  imovel: string;
  lead: string;
}

async function cenario(nome: string, negociacao: object = NEGOCIA, minimo?: number): Promise<Cenario> {
  const tag = `${nome}.${randomBytes(3).toString("hex")}.${sufixo}`;
  const dono = { email: `dono.${tag}@lab.vivanomads.test`, id: "" };
  const inq = { email: `inq.${tag}@lab.vivanomads.test`, id: "" };
  dono.id = await criarConta({ email: dono.email, nome: `Dona ${nome} Sobrenome`, role: "owner" }, senha);
  inq.id = await criarConta({ email: inq.email, nome: `Inês ${nome} Sobrenome`, role: "tenant" }, senha);
  ids.push(dono.id, inq.id);
  const imovel = await criarImovelPronto(dono.id, `Studio proposta ${nome}`, { ativo: true, preco: 3200 });
  await adm()
    .from("properties")
    .update({ negociacao, min_period_days: 30, max_period_days: 180, condo_fee: 0, utilities_mode: "real", prep_fee: 0, checkout_cleaning_enabled: false, limpeza_estadia: null })
    .eq("id", imovel);
  if (minimo) await adm().from("property_negociacao_limites").upsert({ property_id: imovel, owner_id: dono.id, valor_minimo: minimo });
  const lead = await criarLead(dono.id, inq.id, imovel);
  return { dono, inq, imovel, lead };
}

async function abrir(browser: Browser, email: string, largura: number): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: 900 });
  return page;
}

/** O proprietário monta e envia R$ 3.200 × 4 pela tela; devolve o id da proposta. */
async function enviarPelaTela(page: Page, c: Cenario, validade = "7"): Promise<string> {
  await page.goto(`/dashboard/orcamentos/nova?interessado=${c.lead}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("montagem-proposta")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("proposta-valor").fill("3200");
  await page.getByTestId("proposta-meses").selectOption("4");
  await page.getByTestId("proposta-data").fill(emDias(10));
  await page.getByTestId("proposta-validade").selectOption(validade);
  await expect(page.getByTestId("resumo-total-contrato")).toContainText("12.800");
  await expect(page.getByTestId("proposta-taxa-dono")).toContainText("12%");
  await page.getByTestId("enviar-proposta").click();
  await page.waitForURL(/\/dashboard\/propostas\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  return page.url().split("/").pop()!;
}

/** Proposta direto no banco (cenários que não testam a montagem). */
async function propostaNoBanco(c: Cenario, versoes: Array<{ autor: "owner" | "tenant"; valor: number; meses: number; mensagem?: string }>, status = "enviada", validaAte = emDias(7) + "T23:00:00Z") {
  const { data: numero } = await adm().rpc("next_document_number", { p_type: "orcamento", p_year: new Date().getFullYear() });
  const { data: p, error } = await adm()
    .from("propostas")
    .insert({ numero, lead_id: c.lead, property_id: c.imovel, owner_id: c.dono.id, tenant_id: c.inq.id, status, versao_atual: versoes.length, validade_dias: 7, valida_ate: validaAte })
    .select("id")
    .single();
  if (error) throw error;
  let i = 1;
  for (const v of versoes) {
    await adm().from("proposta_versoes").insert({
      proposta_id: p.id, versao: i++, autor: v.autor, valor_base: v.valor, valor_mensal: v.valor, meses: v.meses, data_entrada: emDias(10),
      total_mensal: v.valor, total_contrato: v.valor * v.meses, mensagem: v.mensagem ?? null,
    });
  }
  return p.id as string;
}

test.describe("T191 — propostas", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas de teste).");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const largura of [390, 1280]) {
    test(`${largura}px — 1: proposta → "Vou ficar mais tempo" → aceite → Fechamento com R$ 3.008 × 6 = R$ 18.048`, async ({ browser }) => {
      const c = await cenario(`Fluxo${largura}`);
      const dono = await abrir(browser, c.dono.email, largura);
      const id = await enviarPelaTela(dono, c);
      await expect(dono.getByTestId("proposta-status")).toHaveText("Enviada");
      await expect(dono.getByTestId("proposta-taxa")).toContainText("Taxa de serviço 12%");
      await dono.screenshot({ path: `${SAIDA}/t191-1-enviada-dono-${largura}.png`, fullPage: true });
      // Número do servidor.
      await expect(dono.getByRole("heading", { name: /Proposta ORC-\d{4}-\d{4}/ })).toBeVisible();

      const inq = await abrir(browser, c.inq.email, largura);
      await inq.goto(`/dashboard/propostas/${id}`, { waitUntil: "domcontentloaded" });
      await expect(inq.getByTestId("proposta-status")).toHaveText("Vista");
      // A taxa da Viva nunca aparece para o interessado.
      await expect(inq.getByTestId("proposta-taxa")).toHaveCount(0);
      expect(await inq.content()).not.toContain("Taxa de serviço");
      await inq.getByTestId("proposta-contrapropor").click();
      await inq.getByTestId("ficar-mais-tempo").click();
      await expect(inq.getByTestId("frase-mais-tempo")).toHaveText("Antes: R$ 3.200 × 4 = R$ 12.800 → Agora: R$ 3.008 × 6 = R$ 18.048 (6% de desconto)");
      await expect(inq.getByTestId("resumo-mudancas")).toContainText("4 meses");
      await inq.screenshot({ path: `${SAIDA}/t191-2-contraproposta-${largura}.png`, fullPage: true });
      await inq.getByTestId("enviar-contraproposta").click();
      await expect(inq.getByTestId("aguardando")).toBeVisible({ timeout: 15_000 });
      await expect(inq.getByTestId("proposta-status")).toHaveText("Contraproposta");

      // Cartão na conversa.
      await inq.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
      await inq.getByText(/Studio proposta Fluxo/).first().click().catch(() => {});
      await expect(inq.getByTestId("cartao-proposta").first()).toBeVisible({ timeout: 15_000 });
      await inq.screenshot({ path: `${SAIDA}/t191-3-cartao-conversa-${largura}.png`, fullPage: false });

      // Lista de Orçamentos do proprietário: status e versão.
      await dono.goto("/dashboard/orcamentos", { waitUntil: "domcontentloaded" });
      const linha = largura < 768 ? dono.getByTestId("proposta-item").first() : dono.getByTestId("tabela-propostas").locator("tbody tr").first();
      await expect(linha).toContainText("Contraproposta");
      await expect(linha).toContainText("v2");
      await dono.screenshot({ path: `${SAIDA}/t191-4-lista-${largura}.png`, fullPage: true });

      await dono.goto(`/dashboard/propostas/${id}`, { waitUntil: "domcontentloaded" });
      await expect(dono.getByTestId("historico-versoes").getByTestId("versao")).toHaveCount(2);
      await expect(dono.getByTestId("historico-versoes")).toContainText("4 meses");
      await expect(dono.getByTestId("historico-versoes")).toContainText("6 meses");
      await dono.screenshot({ path: `${SAIDA}/t191-5-historico-${largura}.png`, fullPage: true });
      await dono.getByTestId("proposta-aceitar").click();
      await dono.waitForURL(/\/dashboard\/fechamento\?c=/, { timeout: 20_000 });
      const acordo = dono.getByTestId("fechamento-proposta");
      await expect(acordo).toContainText("3.008", { timeout: 20_000 });
      await expect(acordo).toContainText("18.048");
      await dono.screenshot({ path: `${SAIDA}/t191-6-fechamento-${largura}.png`, fullPage: false });
      // Taxa congelada no aceite (1 imóvel ativo = 12%) e candidatura aceita.
      const { data: p } = await adm().from("propostas").select("status, taxa_congelada").eq("id", id).single();
      expect(p!.status).toBe("aceita");
      expect(Number(p!.taxa_congelada)).toBe(0.12);
      const { data: l } = await adm().from("leads").select("status, accepted_commission_rate").eq("id", c.lead).single();
      expect(l!.status).toBe("accepted");
      expect(Number(l!.accepted_commission_rate)).toBe(0.12);
      expect(await dono.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await dono.context().close();
      await inq.context().close();
    });
  }

  test("390px — 2: o interessado recusa com motivo; o proprietário vê o motivo e não há fechamento", async ({ browser }) => {
    const c = await cenario("Recusa");
    const id = await propostaNoBanco(c, [{ autor: "owner", valor: 3200, meses: 4 }]);
    const inq = await abrir(browser, c.inq.email, 390);
    await inq.goto(`/dashboard/propostas/${id}`, { waitUntil: "domcontentloaded" });
    await inq.getByTestId("proposta-recusar").click();
    await inq.getByTestId("form-recusa").getByText("Datas", { exact: true }).click();
    await inq.getByTestId("confirmar-recusa").click();
    await expect(inq.getByTestId("proposta-status")).toHaveText("Recusada", { timeout: 15_000 });
    await inq.context().close();
    const dono = await abrir(browser, c.dono.email, 390);
    await dono.goto(`/dashboard/propostas/${id}`, { waitUntil: "domcontentloaded" });
    await expect(dono.getByTestId("proposta-recusa")).toContainText("Motivo: Datas");
    await expect(dono.getByTestId("ir-fechamento")).toHaveCount(0);
    await dono.screenshot({ path: `${SAIDA}/t191-7-recusa-390.png`, fullPage: true });
    const { count } = await adm().from("contratos").select("id", { count: "exact", head: true }).eq("lead_id", c.lead);
    expect(count ?? 0).toBe(0);
    await dono.context().close();
  });

  test("1280px — 3: validade vencida vira Expirada e os botões somem", async ({ browser }) => {
    const c = await cenario("Expira");
    const id = await propostaNoBanco(c, [{ autor: "owner", valor: 3200, meses: 4 }], "enviada", new Date(Date.now() - 60_000).toISOString());
    const inq = await abrir(browser, c.inq.email, 1280);
    await inq.goto(`/dashboard/propostas/${id}`, { waitUntil: "domcontentloaded" });
    await expect(inq.getByTestId("proposta-status")).toHaveText("Expirada");
    await expect(inq.getByTestId("proposta-expirada")).toBeVisible();
    await expect(inq.getByTestId("proposta-acoes")).toHaveCount(0);
    await inq.screenshot({ path: `${SAIDA}/t191-8-expirada-1280.png`, fullPage: true });
    await inq.context().close();
  });

  test("390px — 4: com 3 versões a 4ª contraproposta não aparece (só aceitar ou recusar)", async ({ browser }) => {
    const c = await cenario("Rodadas");
    const id = await propostaNoBanco(
      c,
      [
        { autor: "owner", valor: 3200, meses: 4 },
        { autor: "tenant", valor: 3000, meses: 4 },
        { autor: "owner", valor: 3100, meses: 4 },
      ],
      "contraproposta",
    );
    const inq = await abrir(browser, c.inq.email, 390);
    await inq.goto(`/dashboard/propostas/${id}`, { waitUntil: "domcontentloaded" });
    await expect(inq.getByTestId("proposta-aceitar")).toBeVisible();
    await expect(inq.getByTestId("proposta-recusar")).toBeVisible();
    await expect(inq.getByTestId("proposta-contrapropor")).toHaveCount(0);
    await expect(inq.getByTestId("historico-versoes").getByTestId("versao")).toHaveCount(3);
    await inq.screenshot({ path: `${SAIDA}/t191-9-tres-rodadas-390.png`, fullPage: true });
    await inq.context().close();
  });

  test("1280px — 5 e 6: outra pessoa recebe 404; contato na contraproposta fica protegido", async ({ browser }) => {
    const c = await cenario("Isola");
    const id = await propostaNoBanco(c, [{ autor: "owner", valor: 3200, meses: 4 }]);
    const inq = await abrir(browser, c.inq.email, 1280);
    await inq.goto(`/dashboard/propostas/${id}`, { waitUntil: "domcontentloaded" });
    await inq.getByTestId("proposta-contrapropor").click();
    await inq.getByTestId("contra-meses").selectOption("5");
    await inq.getByTestId("contra-mensagem").fill("Fechamos rápido, meu zap 34 99999-1234");
    await inq.getByTestId("enviar-contraproposta").click();
    await expect(inq.getByTestId("proposta-mensagem")).toContainText("contato protegido", { timeout: 15_000 });
    expect(await inq.content()).not.toContain("99999-1234");
    await inq.context().close();

    const outro = await cenario("Outro");
    for (const email of [outro.dono.email, outro.inq.email]) {
      const p = await abrir(browser, email, 1280);
      const r = await p.goto(`/dashboard/propostas/${id}`, { waitUntil: "domcontentloaded" });
      // notFound(): 404 (ou a página de "não encontrada" já em streaming, por causa do loading do painel).
      expect([200, 404]).toContain(r?.status());
      await expect(p.getByText("Página não encontrada")).toBeVisible({ timeout: 15_000 });
      await expect(p.getByTestId("proposta-atual")).toHaveCount(0);
      await p.context().close();
    }
  });

  test("390px — F: valor fixo não tem Contrapropor; H: abaixo do mínimo só mostra a próxima centena", async ({ browser }) => {
    const fixo = await cenario("Fixo", { aceita: false, itens: [], descontos: [] });
    const idFixo = await propostaNoBanco(fixo, [{ autor: "owner", valor: 3200, meses: 4 }]);
    const a = await abrir(browser, fixo.inq.email, 390);
    await a.goto(`/dashboard/propostas/${idFixo}`, { waitUntil: "domcontentloaded" });
    await expect(a.getByTestId("proposta-aceitar")).toBeVisible();
    await expect(a.getByTestId("proposta-contrapropor")).toHaveCount(0);
    await expect(a.getByTestId("proposta-acoes")).toContainText("valor fixo");
    await a.context().close();

    const min = await cenario("Minimo", NEGOCIA, 2950);
    const idMin = await propostaNoBanco(min, [{ autor: "owner", valor: 3200, meses: 4 }]);
    const b = await abrir(browser, min.inq.email, 390);
    const respostas: string[] = [];
    b.on("response", async (r) => {
      try {
        respostas.push(await r.text());
      } catch {
        /* sem corpo */
      }
    });
    await b.goto(`/dashboard/propostas/${idMin}`, { waitUntil: "domcontentloaded" });
    await b.getByTestId("proposta-contrapropor").click();
    await b.getByTestId("contra-valor").fill("2800");
    await b.getByTestId("enviar-contraproposta").click();
    await expect(b.getByTestId("aviso-minimo")).toHaveText("Abaixo do que o proprietário aceita; tente a partir de R$ 3.000.");
    await b.screenshot({ path: `${SAIDA}/t191-10-abaixo-minimo-390.png`, fullPage: true });
    const tudo = (await b.content()) + respostas.join("\n");
    expect(tudo).not.toMatch(/2\.?950/);
    await b.context().close();
  });

  test("1280px — J: só 'meses' liberado → o valor mensal não aparece para editar", async ({ browser }) => {
    const c = await cenario("SoMeses", { aceita: true, itens: ["meses"], descontos: [] });
    const id = await propostaNoBanco(c, [{ autor: "owner", valor: 3200, meses: 4 }]);
    const p = await abrir(browser, c.inq.email, 1280);
    await p.goto(`/dashboard/propostas/${id}`, { waitUntil: "domcontentloaded" });
    await p.getByTestId("proposta-contrapropor").click();
    await expect(p.getByTestId("contra-meses")).toBeVisible();
    await expect(p.getByTestId("contra-valor")).toHaveCount(0);
    await p.context().close();
  });
});
