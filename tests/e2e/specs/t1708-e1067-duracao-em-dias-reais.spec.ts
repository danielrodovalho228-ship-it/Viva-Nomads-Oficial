import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { addDiasISO } from "../../../src/lib/contrato-blocos";
import { hojeBR } from "../../../src/lib/utils";

/*
  T1708 — E1067 @E1067: a estadia de 31 dias é descrita como "31 dias", pelos dias reais do contrato — nunca "2 meses".
  Na prova ao vivo de 20/11 (31 dias a R$ 2.500, bloco de R$ 2.583,33) as telas diziam "2 meses": o bloco do contrato em
  dias guarda 2 meses de REFERÊNCIA, e o rótulo lia esse número.
   1. O dono abre Contratos: o bloco diz "(31 dias)". Registra o 1º pagamento pela tela (R$ 2.583,33).
   2. A moradora abre Minhas locações: o pagamento a confirmar é "Bloco 1 (31 dias: DD/MM a DD/MM) — R$ 2.583,33".
   3. A página da estadia diz a conta em dias: "R$ 2.500,00 × 31 dias ÷ 30".
  Capturas a 390 e a 1280 px do bloco (dono) e a 390 px do pagamento a confirmar (moradora). Laboratório; não é prova ao vivo.
*/
const SAIDA = "tests/laboratorio/saida";
const INICIO = hojeBR();
const FIM = addDiasISO(INICIO, 30); // 31 dias, contando o primeiro e o último
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const ROTULO = `Bloco 1 (31 dias: ${ddmm(INICIO)} a ${ddmm(FIM)}) — R$ 2.583,33`;

const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1708.${sufixo}@lab.vivanomads.test`, nome: "Dora Duração Sobrenome", role: "owner" as const };
const inq = { email: `inq.t1708.${sufixo}@lab.vivanomads.test`, nome: "Iris Duração Sobrenome", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; contrato?: string } = {};

test.describe("T1708 — E1067: a duração da estadia pelos dias reais do contrato @E1067", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `[TESTE QA] Studio 31 dias ${sufixo}`, { ativo: true, preco: 2500 });
    const agora = new Date().toISOString();
    // O contrato em dias, como nasce de uma proposta de 31 dias: o bloco guarda 2 meses de referência e R$ 2.583,33.
    const { data, error } = await adm()
      .from("contratos")
      .insert({ property_id: ids.imovel, tenant_id: ids.inq, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 31, aluguel_mensal: 2500, tamanho_bloco_meses: 2, comissao_percent: 0.1, comissao_valor: 258.33, qtd_ocupantes: 1, status: "ativo", garantia: "caucao", assinado_proprietario_em: agora, assinado_inquilino_em: agora })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    const { error: eBloco } = await adm()
      .from("contrato_blocos")
      .insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: INICIO, fim: FIM, meses: 2, valor: 2583.33, caucao: 1292, status: "ativo" });
    if (eBloco) throw eBloco;
  });

  test.afterAll(async () => {
    if (ids.contrato) {
      await adm().from("pagamentos_bloco").delete().eq("contrato_id", ids.contrato);
      await adm().from("contratos").delete().eq("id", ids.contrato);
    }
    await apagarContas([ids.dono, ids.inq]);
  });

  test("1. dono: o bloco de 31 dias diz \"(31 dias)\" e o 1º pagamento é registrado", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    // ORDEM-DUET-348: a duração é procurada pelo texto junto de "Bloco 1" — "(Nm)" ou "(N dias)" —, sem marcação nova.
    const duracao = page.locator("p").filter({ hasText: /^\s*Bloco 1\s*\((\d+\s?m|\d+ dias?)\)\s*$/ }).first();
    await expect(duracao, "o título do bloco está na tela").toBeVisible({ timeout: 30_000 });
    await expect(duracao).toHaveText(/^\s*Bloco 1\s*\(31 dias\)\s*$/);
    await expect(page.locator("main")).not.toContainText("(2m)");
    const bloco = duracao.locator("xpath=ancestor::div[1]/..");
    await bloco.scrollIntoViewIfNeeded();
    await bloco.screenshot({ path: `${SAIDA}/t1708-1-dono-bloco-1280.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await duracao.scrollIntoViewIfNeeded();
    await expect(duracao).toBeVisible();
    await bloco.screenshot({ path: `${SAIDA}/t1708-1-dono-bloco-390.png` });
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.getByTestId("registrar-recebimento").first().click();
    await page.getByRole("button", { name: "Confirmar recebimento" }).click();
    await expect
      .poll(async () => ((await adm().from("pagamentos_bloco").select("valor").eq("contrato_id", ids.contrato!).eq("tipo", "aluguel")).data ?? []).map((p) => Number(p.valor)), { timeout: 30_000 })
      .toEqual([2583.33]);
    await page.context().close();
  });

  test("2. moradora: o pagamento a confirmar é \"Bloco 1 (31 dias: …) — R$ 2.583,33\"", async ({ browser }) => {
    const page = await entrar(browser, inq.email, senha);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
    const confirmar = page.getByTestId("confirmar-pagamentos");
    await expect(confirmar).toContainText(ROTULO, { timeout: 30_000 });
    await expect(confirmar).not.toContainText("2 meses");
    await confirmar.scrollIntoViewIfNeeded();
    await confirmar.screenshot({ path: `${SAIDA}/t1708-2-moradora-pagamento-390.png` });
    await page.context().close();
  });

  test("3. a página da estadia diz a conta em dias, para as duas partes", async ({ browser }) => {
    for (const email of [dono.email, inq.email]) {
      const page = await entrar(browser, email, senha);
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`/dashboard/estadia/${ids.contrato}`, { waitUntil: "domcontentloaded" });
      const principal = page.locator("main");
      await expect(principal).toContainText("R$ 2.500,00 × 31 dias ÷ 30 · pago direto ao proprietário", { timeout: 30_000 });
      await expect(principal).not.toContainText("R$ 2.500,00 × 1 mês");
      await expect(principal).not.toContainText("2 meses");
      await page.context().close();
    }
  });
});
