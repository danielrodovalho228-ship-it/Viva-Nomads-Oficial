import { test, expect, type Browser, type Page } from "@playwright/test";
import { inflateSync } from "node:zlib";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2212 — E1072 (ORDEM-DUET-348): o registo do recebimento cobre exactamente o 1.º pagamento do contrato. Só no
  laboratório. TRAVA EM RASCUNHO: nasce vermelha na main de hoje e fica verde quando a correcção da Fable entrar.
  O critério aprovado pelo Gerente:
    - valor: o que o 1.º pagamento do contrato disser, nem mais nem menos (aqui, como no contrato provado:
      bloco R$ 2.583,33 + contas R$ 310,00 + limpeza R$ 250,00 = R$ 3.143,33);
    - forma: UM registo com os componentes discriminados — o dono regista uma vez, o morador confirma uma vez, e cada
      componente aparece como linha própria no registo, no recibo e no pacote de provas, contando para o quitado;
    - partes (num 2.º contrato, sem proposta): um bloco pago em partes completa-se com registos complementares no mesmo bloco, cada um com o seu recibo
      e a sua confirmação; o bloco quita quando a soma chega ao total.
  Massa própria: proposta aceita (31 dias, R$ 2.500/mês, consumo R$ 310, limpeza de preparação R$ 250) e o contrato
  assinado que nasce dela (simulação declarada). Tudo o resto pela tela.
  Uma só sequência com verificações suaves: uma corrida mostra todas as razões. O spec exige valores e linhas, não a
  redacção exacta, que é da Fable.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2212.${sufixo}@lab.vivanomads.test`, nome: "Dalva Componentes", role: "owner" as const };
const mor = { email: `mor.t2212.${sufixo}@lab.vivanomads.test`, nome: "Moema Componentes", role: "tenant" as const };
const ids: { dono?: string; mor?: string; imovel?: string; lead?: string; proposta?: string; contrato?: string; b1?: string; imovelB?: string; leadB?: string; contratoB?: string; b2?: string } = {};
const TITULO_A = `Studio dos componentes ${sufixo}`;
const TITULO_B = `Studio das partes ${sufixo}`;
const dia = (n: number) => new Date(Date.now() - 3 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);
const BLOCO = "2.583,33";
const CONTAS = "310,00";
const LIMPEZA = "250,00";
const TOTAL = "3.143,33";

async function abrir(browser: Browser, email: string): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: 1280, height: 900 });
  return page;
}
async function contratos(p: Page) {
  await p.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
  await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}
/** O cartão do bloco N do contrato do imóvel `titulo` (o dono tem dois contratos nesta massa). */
const cartao = (p: Page, titulo: string, n: number) => {
  const outro = titulo === TITULO_A ? TITULO_B : TITULO_A;
  // O cartão do contrato: o MAIOR bloco que tem o título deste imóvel e a linha da taxa, sem o título do outro contrato.
  const painel = p.locator("div").filter({ hasText: titulo }).filter({ hasNotText: outro }).filter({ has: p.getByTestId("contrato-taxa") }).first();
  return painel.locator("div.rounded-xl", { hasText: `Bloco ${n}` }).filter({ hasText: "Valor do bloco" }).last();
};/** Texto literal em regex; o espaço aceita também o espaço não separável que o formato de moeda usa ("R$\u00a01.500,00"). */
const re = (s: string) => new RegExp(s.replace(/[.$]/g, "\\$&").replace(/ /g, "[\\s\\u00a0]"));

/** O texto de um PDF do pdf-lib (fluxos Flate; texto em hex "<..> Tj", Helvetica WinAnsi). */
function textoDoPdf(buf: Buffer): string {
  const s = buf.toString("latin1");
  const out: string[] = [];
  for (const m of s.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let txt: string;
    try { txt = inflateSync(Buffer.from(m[1], "latin1")).toString("latin1"); } catch { txt = m[1]; }
    for (const t of txt.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) out.push(Buffer.from(t[1], "hex").toString("latin1"));
    for (const t of txt.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) out.push(t[1]);
  }
  return out.join("\n");
}

test.describe("T2212 — E1072: o registo do recebimento cobre exactamente o 1º pagamento do contrato @E1072", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 300_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.mor = await criarConta(mor, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.mor]);
    ids.imovel = await criarImovelPronto(ids.dono, TITULO_A, { ativo: true, preco: 2500 });
    ids.lead = await criarLead(ids.dono, ids.mor, ids.imovel, true);
    const entrada = dia(8);
    // A proposta aceita que dá o 1.º pagamento: 31 dias a R$ 2.500/mês, consumo R$ 310, limpeza de preparação R$ 250.
    const { data: prop, error: ep } = await adm()
      .from("propostas")
      .insert({ numero: `ORC-T2212-${sufixo}`, lead_id: ids.lead, property_id: ids.imovel, owner_id: ids.dono, tenant_id: ids.mor, status: "contrato_assinado", versao_atual: 1, validade_dias: 7, valida_ate: new Date(Date.now() + 7 * 86_400_000).toISOString(), aceita_em: new Date().toISOString() })
      .select("id")
      .single();
    if (ep) throw ep;
    ids.proposta = prop.id as string;
    const { error: ev } = await adm().from("proposta_versoes").insert({
      proposta_id: ids.proposta, versao: 1, autor: "owner", valor_base: 2500, valor_mensal: 2500, meses: 2, dias: 31, data_entrada: entrada,
      consumo: 310, limpeza_unica: 250, total_mensal: 2810, total_contrato: 3143.33,
    });
    if (ev) throw ev;
    // Simulação declarada: o contrato nasce da proposta, assinado pelas duas partes.
    const agora = new Date().toISOString();
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({
        lead_id: ids.lead, property_id: ids.imovel, tenant_id: ids.mor, owner_plan: "essential", faixa: "media_estadia", proposta_id: ids.proposta,
        prazo_total_dias: 31, aluguel_mensal: 2500, tamanho_bloco_meses: 1, comissao_percent: 0.1, comissao_valor: 258.33,
        qtd_ocupantes: 1, capacidade_snapshot: 2, assinado_proprietario_em: agora, assinado_inquilino_em: agora,
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c.id as string;
    const { data: b1, error: eb } = await adm()
      .from("contrato_blocos")
      .insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: entrada, fim: dia(38), meses: 2, valor: 2583.33, caucao: 0, status: "ativo" })
      .select("id")
      .single();
    if (eb) throw eb;
    ids.b1 = b1.id as string;

    // Contrato B, sem proposta e sem limpeza de preparação: um bloco de R$ 2.500 para o pagamento em duas partes.
    ids.imovelB = await criarImovelPronto(ids.dono, TITULO_B, { ativo: true, preco: 2500 });
    await adm().from("properties").update({ prep_fee: 0 }).eq("id", ids.imovelB);
    ids.leadB = await criarLead(ids.dono, ids.mor, ids.imovelB, true);
    const { data: cb, error: ecb } = await adm()
      .from("contratos")
      .insert({
        lead_id: ids.leadB, property_id: ids.imovelB, tenant_id: ids.mor, owner_plan: "essential", faixa: "media_estadia",
        prazo_total_dias: 30, aluguel_mensal: 2500, tamanho_bloco_meses: 1, comissao_percent: 0.1, comissao_valor: 250,
        qtd_ocupantes: 1, capacidade_snapshot: 2, assinado_proprietario_em: agora, assinado_inquilino_em: agora,
      })
      .select("id")
      .single();
    if (ecb) throw ecb;
    ids.contratoB = cb.id as string;
    const { data: b2, error: eb2 } = await adm()
      .from("contrato_blocos")
      .insert({ contrato_id: ids.contratoB, numero_bloco: 1, inicio: dia(60), fim: dia(89), meses: 1, valor: 2500, caucao: 0, status: "ativo" })
      .select("id")
      .single();
    if (eb2) throw eb2;
    ids.b2 = b2.id as string;
  });
  test.afterAll(async () => {
    for (const c of [ids.contrato, ids.contratoB]) if (c) await adm().from("documentos_fiscais").delete().eq("contrato_id", c);
    await apagarContas([ids.dono!, ids.mor!].filter(Boolean));
  });

  test("o 1º pagamento num só registo com os componentes; o recibo, o pacote e o quitado; o bloco em partes", async ({ browser }) => {
    test.info().annotations.push({ type: "simulação", description: "proposta aceita e contrato assinado gravados pelo laboratório; registos e confirmações pela tela" });
    const linhas = async (bloco: string) => (await adm().from("pagamentos_bloco").select("id").eq("bloco_id", bloco).is("anulado_em", null)).data ?? [];

    await test.step("1. o dono abre o registo do 1º bloco: ele oferece exactamente o 1º pagamento, com as componentes", async () => {
      const d = await abrir(browser, dono.email);
      await contratos(d);
      await cartao(d, TITULO_A, 1).getByTestId("registrar-recebimento").click();
      const form = d.locator("div.rounded-xl", { has: d.getByText("você declara; a plataforma só registra") }).last();
      await expect(form).toBeVisible();
      const texto = async () => `${await form.innerText()} ${(await form.locator("input").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))).join(" ")}`;
      expect.soft(await texto(), "E1072: o registo traz o total do 1º pagamento (R$ 3.143,33)").toMatch(re(TOTAL));
      expect.soft(await texto(), "E1072: o registo traz a limpeza como componente (R$ 250,00)").toMatch(/limpeza/i);
      expect.soft(await texto(), "E1072: a limpeza com o valor").toMatch(/250(,00)?\b/);
      expect.soft(await texto(), "E1072: as contas com o valor do 1º pagamento (R$ 310,00)").toMatch(/310(,00)?\b/);
      await d.getByTestId("confirmar-recebimento").click();
      await expect.poll(async () => (await linhas(ids.b1!)).length, { timeout: 20_000, message: "o registo grava" }).toBeGreaterThan(0);
      expect.soft((await linhas(ids.b1!)).length, "E1072: UM registo para o 1º pagamento, não um por componente").toBe(1);
      await d.context().close();
    });

    await test.step("2. a moradora confirma UMA vez; o recibo discrimina as componentes e soma o 1º pagamento", async () => {
      const m = await abrir(browser, mor.email);
      await m.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
      const confirmar = m.getByTestId("confirmar-pagamentos");
      await expect(confirmar).toBeVisible({ timeout: 20_000 });
      expect.soft(await confirmar.getByRole("button", { name: /Confirmar/ }).count(), "E1072: o morador confirma uma vez o 1º pagamento").toBe(1);
      expect.soft(await confirmar.innerText(), "E1072: o morador vê o total do 1º pagamento a confirmar").toMatch(re(TOTAL));
      await confirmar.getByRole("button", { name: /Confirmar/ }).first().click();
      await expect.poll(async () => (await adm().from("documentos_fiscais").select("id").eq("contrato_id", ids.contrato!).eq("tipo", "recibo_aluguel")).data?.length ?? 0, { timeout: 60_000 }).toBeGreaterThan(0);
      await m.context().close();

      const { data: docs } = await adm().from("documentos_fiscais").select("id").eq("contrato_id", ids.contrato!).eq("tipo", "recibo_aluguel").limit(1);
      const d = await abrir(browser, dono.email);
      const recibo = textoDoPdf(await (await d.request.get(`/api/documentos/${docs![0].id}`)).body());
      expect.soft(recibo, "E1072: o recibo tem a linha do bloco").toMatch(re(BLOCO));
      expect.soft(recibo, "E1072: o recibo tem a linha das contas").toMatch(new RegExp(`contas[^\\n]*\\n?[^\\n]*${CONTAS}`, "i"));
      expect.soft(recibo, "E1072: o recibo tem a linha da limpeza").toMatch(new RegExp(`limpeza[^\\n]*\\n?[^\\n]*${LIMPEZA}`, "i"));
      expect.soft(recibo, "E1072: o recibo soma o 1º pagamento").toMatch(re(`Total R$ ${TOTAL}`));
      await d.context().close();
    });

    await test.step("3. o pacote de provas traz cada componente na secção PAGAMENTOS", async () => {
      const d = await abrir(browser, dono.email);
      const texto = textoDoPdf(await (await d.request.get(`/api/contrato/${ids.contrato}/provas`)).body());
      const i = texto.indexOf("PAGAMENTOS");
      const fim = texto.indexOf("CONFERÊNCIAS", i);
      const secao = i < 0 ? "" : texto.slice(i, fim > i ? fim : undefined);
      expect(secao, "o pacote tem a secção PAGAMENTOS").toContain("PAGAMENTOS");
      expect.soft(secao, "E1072: o pacote tem a linha das contas, com o valor").toMatch(new RegExp(`contas[^\\n]*${CONTAS}`, "i"));
      expect.soft(secao, "E1072: o pacote tem a linha da limpeza, com o valor").toMatch(new RegExp(`limpeza[^\\n]*${LIMPEZA}`, "i"));
      await d.context().close();
    });

    await test.step("4. o 1º bloco conta todas as componentes no recebido", async () => {
      const d = await abrir(browser, dono.email);
      await contratos(d);
      expect.soft(await cartao(d, TITULO_A, 1).innerText(), "E1072: o recebido do 1º bloco é o 1º pagamento inteiro (R$ 3.143,33)").toMatch(re(TOTAL));
      await d.context().close();
    });

    await test.step("5. outro contrato, um bloco pago em duas partes: o complemento é aceite e o bloco quita na soma", async () => {
      const d = await abrir(browser, dono.email);
      for (const [parte, valor] of [[1, "1000"], [2, "1500"]] as const) {
        await contratos(d);
        const botao = cartao(d, TITULO_B, 1).getByTestId("registrar-recebimento");
        if (parte === 1) {
          // A 1ª parte tem de poder registar-se: sem isto o passo não prova nada (o bloco do contrato B tem de estar na tela).
          await expect(botao, "o bloco do contrato B oferece o registo da 1ª parte").toBeVisible({ timeout: 20_000 });
        } else if (!(await botao.count())) {
          expect.soft(false, "E1072: depois da 1ª parte, o bloco em aberto oferece o registo do complemento").toBe(true);
          break;
        }
        await botao.click();
        const form = d.locator("div.rounded-xl", { has: d.getByText("você declara; a plataforma só registra") }).last();
        await form.locator("label", { hasText: /Valor/ }).locator("input").first().fill(valor);
        await d.getByTestId("confirmar-recebimento").click();
        const resposta = d.getByTestId("recebimento-registrado");
        await expect(resposta).toBeVisible({ timeout: 20_000 });
        expect.soft(await resposta.innerText(), `E1072: a parte ${parte} do contrato B é aceite (sem "já registrado")`).not.toMatch(/já foi registrado/i);
      }
      expect.soft((await linhas(ids.b2!)).length, "E1072: o bloco do contrato B tem os dois registos (a parte e o complemento)").toBe(2);
      await contratos(d);
      expect.soft(await cartao(d, TITULO_B, 1).innerText(), "E1072: com a soma igual ao total, o bloco fica sem nada em aberto").toMatch(/Em aberto\s*R\$\s*0(,00)?\b/);
      await d.context().close();

      const m = await abrir(browser, mor.email);
      await m.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
      const confirmar = m.getByTestId("confirmar-pagamentos");
      if (await confirmar.count()) {
        const n = await confirmar.getByRole("button", { name: /Confirmar/ }).count();
        expect.soft(n, "E1072: cada parte do contrato B tem a sua confirmação").toBe(2);
        for (let i = 0; i < n; i++) {
          await confirmar.getByRole("button", { name: /Confirmar/ }).first().click();
          await expect(confirmar.getByRole("button", { name: /Confirmar/ })).toHaveCount(n - 1 - i, { timeout: 20_000 });
        }
      }
      await m.context().close();
      const recibos = async () => (await adm().from("documentos_fiscais").select("id").in("contrato_id", [ids.contrato!, ids.contratoB!]).eq("tipo", "recibo_aluguel")).data?.length ?? 0;
      await expect.poll(recibos, { timeout: 30_000 }).toBeGreaterThan(1).catch(() => {});
      expect.soft(await recibos(), "E1072: cada parte tem o seu recibo (1 do contrato A + 2 do contrato B)").toBe(3);
    });
  });
});
