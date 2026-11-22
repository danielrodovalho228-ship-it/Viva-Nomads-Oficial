import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2213 — E1072 (negativo do registro complementar; roteiro de fecho da Estadia, passo 4.1b): num bloco pago em parte,
  um complemento ACIMA do que falta é recusado com mensagem clara e nada se grava; o complemento exacto entra a seguir.
  Só no laboratório. TRAVA EM RASCUNHO: a recusa hoje só tem teste unitário (e1072-registros-complementares.test.ts).
  Sem a correcção, o bloco pago em parte não oferece o complemento: o passo 2 falha por isso (sem caminho de complemento).
  Massa: um contrato assinado (simulação declarada), sem proposta e sem limpeza de preparação, com um bloco de R$ 2.500.
  Tudo o resto pela tela.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2213.${sufixo}@lab.vivanomads.test`, nome: "Dina Complemento", role: "owner" as const };
const mor = { email: `mor.t2213.${sufixo}@lab.vivanomads.test`, nome: "Mara Complemento", role: "tenant" as const };
const ids: { dono?: string; mor?: string; imovel?: string; lead?: string; contrato?: string; bloco?: string } = {};
const dia = (n: number) => new Date(Date.now() - 3 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);
const MSG_PASSA = "O valor passa do que falta registrar neste bloco.";

async function abrir(browser: Browser, email: string): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: 1280, height: 900 });
  return page;
}
async function contratos(p: Page) {
  await p.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
  await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}
/** O cartão do bloco 1 (o dono desta massa tem um contrato só). */
const cartao = (p: Page) => p.locator("div.rounded-xl", { hasText: "Bloco 1" }).filter({ hasText: "Valor do bloco" }).last();
const linhas = async () => (await adm().from("pagamentos_bloco").select("id, valor").eq("bloco_id", ids.bloco!).is("anulado_em", null)).data ?? [];

/** Abre o formulário do bloco, escreve o valor e envia. */
async function registrar(p: Page, valor: string) {
  await cartao(p).getByTestId("registrar-recebimento").click();
  const form = p.locator("div.rounded-xl", { has: p.getByText("você declara; a plataforma só registra") }).last();
  await form.locator("label", { hasText: /Valor/ }).locator("input").first().fill(valor);
  await p.getByTestId("confirmar-recebimento").click();
}

test.describe("T2213 — E1072: o registro complementar não passa do que falta no bloco @E1072", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.mor = await criarConta(mor, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.mor]);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio do complemento ${sufixo}`, { ativo: true, preco: 2500 });
    await adm().from("properties").update({ prep_fee: 0 }).eq("id", ids.imovel);
    ids.lead = await criarLead(ids.dono, ids.mor, ids.imovel, true);
    const agora = new Date().toISOString();
    // Simulação declarada: o contrato nasce assinado pelas duas partes (a assinatura tem prova própria, t2157 etapa 8).
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({
        lead_id: ids.lead, property_id: ids.imovel, tenant_id: ids.mor, owner_plan: "essential", faixa: "media_estadia",
        prazo_total_dias: 30, aluguel_mensal: 2500, tamanho_bloco_meses: 1, comissao_percent: 0.1, comissao_valor: 250,
        qtd_ocupantes: 1, capacidade_snapshot: 2, assinado_proprietario_em: agora, assinado_inquilino_em: agora,
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c.id as string;
    const { data: b, error: eb } = await adm()
      .from("contrato_blocos")
      .insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: dia(8), fim: dia(37), meses: 1, valor: 2500, caucao: 0, status: "ativo" })
      .select("id")
      .single();
    if (eb) throw eb;
    ids.bloco = b.id as string;
  });
  test.afterAll(async () => {
    if (ids.contrato) await adm().from("documentos_fiscais").delete().eq("contrato_id", ids.contrato);
    await apagarContas([ids.dono!, ids.mor!].filter(Boolean));
  });

  test("a 1ª parte entra; o complemento acima do que falta é recusado e nada se grava; o complemento exacto quita", async ({ browser }) => {
    const d = await abrir(browser, dono.email);

    await test.step("1. a 1ª parte (R$ 1.000) é aceite", async () => {
      await contratos(d);
      // Sem o bloco na tela o teste não prova nada.
      await expect(cartao(d).getByTestId("registrar-recebimento"), "o bloco oferece o registo da 1ª parte").toBeVisible({ timeout: 20_000 });
      await registrar(d, "1000");
      await expect(d.getByTestId("recebimento-registrado")).toBeVisible({ timeout: 20_000 });
      expect((await linhas()).length, "a 1ª parte ficou gravada").toBe(1);
    });

    await test.step("2. um complemento de R$ 2.000 (falta R$ 1.500) é recusado com a mensagem, e nada se grava", async () => {
      await contratos(d);
      const botao = cartao(d).getByTestId("registrar-recebimento");
      expect(await botao.count(), "E1072: o bloco pago em parte oferece o registo do complemento").toBeGreaterThan(0);
      await registrar(d, "2000");
      await expect(d.getByText(MSG_PASSA), `E1072: a recusa diz "${MSG_PASSA}"`).toBeVisible({ timeout: 20_000 });
      await expect(d.getByTestId("recebimento-registrado"), "a recusa não aparece como registo feito").toHaveCount(0);
      expect((await linhas()).length, "E1072: a recusa não grava nada (continua 1 registo)").toBe(1);
      await contratos(d);
      expect(await cartao(d).innerText(), "E1072: o Em aberto continua R$ 1.500").toMatch(/Em aberto\s*R\$\s*1\.500(,00)?\b/);
    });

    await test.step("3. o complemento exacto (R$ 1.500) entra e o bloco quita", async () => {
      await registrar(d, "1500");
      await expect(d.getByTestId("recebimento-registrado")).toBeVisible({ timeout: 20_000 });
      expect(await d.getByTestId("recebimento-registrado").innerText()).not.toMatch(/já foi registrado/i);
      expect((await linhas()).map((l) => Number(l.valor)).sort((a, b) => a - b), "E1072: dois registos, a parte e o complemento").toEqual([1000, 1500]);
      await contratos(d);
      expect(await cartao(d).innerText(), "E1072: com a soma igual ao total, nada em aberto").toMatch(/Em aberto\s*R\$\s*0(,00)?\b/);
    });
    await d.context().close();
  });
});
