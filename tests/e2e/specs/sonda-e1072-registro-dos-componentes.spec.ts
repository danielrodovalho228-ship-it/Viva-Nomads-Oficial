import { test, expect, type Browser, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  SONDA E1072 (ORDEM-DUET-328) — ENSAIO, NUNCA MERGEAR. Massa própria do laboratório.
  O que o dono consegue registar, pela tela, de um recebimento: o bloco do aluguel, as contas, a limpeza.
    A. o formulário "Registrar recebimento" do bloco: que campos oferece (captura);
    B. bloco 1: valor do bloco + Contas 450 → o que grava e o que o bloco mostra (Recebido / quitado);
    C. bloco 2: registo parcial sem contas → tentar declarar as contas depois → o que o ecrã responde e o que fica gravado;
    D. o morador confirma → o recibo (REC) e o pacote de provas: o que cada um mostra das contas.
  Observação, não trava: cada leitura vai para o log como "SONDA E1072:" e as capturas para tests/laboratorio/saida.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.s1072.${sufixo}@lab.vivanomads.test`, nome: "Dina Componentes", role: "owner" as const };
const mor = { email: `mor.s1072.${sufixo}@lab.vivanomads.test`, nome: "Mauro Componentes", role: "tenant" as const };
const ids: { dono?: string; mor?: string; imovel?: string; lead?: string; contrato?: string; b1?: string; b2?: string } = {};
const dia = (n: number) => new Date(Date.now() - 3 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);
const log = (s: string) => console.log(`SONDA E1072: ${s}`);

async function abrir(browser: Browser, email: string): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: 1280, height: 900 });
  return page;
}
async function contratos(p: Page) {
  await p.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
  await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}
const formulario = (p: Page) => p.locator("div.rounded-xl", { has: p.getByText("você declara; a plataforma só registra") }).last();
async function campo(p: Page, rotulo: string) {
  return formulario(p).locator("label", { hasText: rotulo }).locator("input").first();
}
async function linhas(blocoId?: string) {
  let q = adm().from("pagamentos_bloco").select("id, bloco_id, tipo, valor, encargos, confirmado_pelo_inquilino").eq("contrato_id", ids.contrato!);
  if (blocoId) q = q.eq("bloco_id", blocoId);
  return (await q).data ?? [];
}
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

test.describe("SONDA E1072 — o registo do recebimento: bloco, contas e limpeza", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.mor = await criarConta(mor, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.mor]);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio dos componentes ${sufixo}`, { ativo: true, preco: 3000 });
    ids.lead = await criarLead(ids.dono, ids.mor, ids.imovel, true);
    const agora = new Date().toISOString();
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({
        lead_id: ids.lead, property_id: ids.imovel, tenant_id: ids.mor, owner_plan: "essential", faixa: "media_estadia",
        prazo_total_dias: 120, aluguel_mensal: 3000, tamanho_bloco_meses: 2, comissao_percent: 0.1, comissao_valor: 1200,
        qtd_ocupantes: 1, capacidade_snapshot: 2, assinado_proprietario_em: agora, assinado_inquilino_em: agora,
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c.id as string;
    const { data: bs, error: e1 } = await adm()
      .from("contrato_blocos")
      .insert([
        { contrato_id: ids.contrato, numero_bloco: 1, inicio: dia(8), fim: dia(67), meses: 2, valor: 6000, caucao: 0, status: "ativo" },
        { contrato_id: ids.contrato, numero_bloco: 2, inicio: dia(68), fim: dia(127), meses: 2, valor: 6000, caucao: 0, status: "pendente_aceite" },
      ])
      .select("id, numero_bloco");
    if (e1) throw e1;
    ids.b1 = bs!.find((b) => b.numero_bloco === 1)!.id as string;
    ids.b2 = bs!.find((b) => b.numero_bloco === 2)!.id as string;
    log(`massa: contrato ${ids.contrato} · aluguel 3000/mês · bloco 1 (6000, ativo) · bloco 2 (6000, pendente_aceite) · sem caução`);
  });
  test.afterAll(async () => {
    if (ids.contrato) {
      await adm().from("documentos_fiscais").delete().eq("contrato_id", ids.contrato);
      await adm().from("pagamentos_bloco").delete().eq("contrato_id", ids.contrato);
      await adm().from("contrato_blocos").delete().eq("contrato_id", ids.contrato);
      await adm().from("contratos").delete().eq("id", ids.contrato);
    }
    await apagarContas([ids.dono!, ids.mor!].filter(Boolean));
  });

  test("A–B. o formulário do bloco e o registo do bloco 1 com Contas 450", async ({ browser }) => {
    const p = await abrir(browser, dono.email);
    await contratos(p);
    log(`botões de registo na tela: ${await p.getByTestId("registrar-recebimento").count()} de bloco, ${await p.getByTestId("registrar-caucao").count()} de caução`);
    await p.getByTestId("registrar-recebimento").first().click();
    const form = formulario(p);
    await expect(form).toBeVisible();
    const rotulos = (await form.locator("label").allInnerTexts()).map((t) => t.split("\n")[0].trim());
    log(`campos do formulário: ${JSON.stringify(rotulos)}`);
    log(`algum campo de limpeza: ${rotulos.some((r) => /limpeza/i.test(r))}`);
    log(`texto do formulário: ${(await form.innerText()).replace(/\s+/g, " ")}`);
    await form.screenshot({ path: `${SAIDA}/e1072-a-formulario-bloco1.png` });
    log(`valor sugerido: ${await (await campo(p, "Valor do bloco")).inputValue()}`);
    await (await campo(p, "Contas (opcional)")).fill("450");
    await form.screenshot({ path: `${SAIDA}/e1072-b-formulario-preenchido.png` });
    await p.getByTestId("confirmar-recebimento").click();
    await expect.poll(async () => (await linhas(ids.b1)).length, { timeout: 20_000 }).toBe(1);
    log(`gravado bloco 1: ${JSON.stringify(await linhas(ids.b1))}`);

    await contratos(p);
    const card1 = p.locator("div.rounded-xl", { hasText: "Bloco 1" }).filter({ hasText: "Valor do bloco" }).last();
    log(`cartão do bloco 1 depois: ${(await card1.innerText()).replace(/\s+/g, " ")}`);
    await card1.screenshot({ path: `${SAIDA}/e1072-b-bloco1-depois.png` });
    await p.context().close();
  });

  test("C. bloco 2: registo parcial sem contas, e as contas declaradas depois", async ({ browser }) => {
    const p = await abrir(browser, dono.email);
    await contratos(p);
    await p.getByTestId("registrar-recebimento").first().click();
    await (await campo(p, "Valor do bloco")).fill("3000");
    await p.getByTestId("confirmar-recebimento").click();
    await expect.poll(async () => (await linhas(ids.b2)).length, { timeout: 20_000 }).toBe(1);
    log(`gravado bloco 2 (1.º envio): ${JSON.stringify(await linhas(ids.b2))}`);

    await contratos(p);
    const card2 = p.locator("div.rounded-xl", { hasText: "Bloco 2" }).filter({ hasText: "Valor do bloco" }).last();
    log(`cartão do bloco 2 depois do parcial: ${(await card2.innerText()).replace(/\s+/g, " ")}`);
    const botao = card2.getByTestId("registrar-recebimento");
    log(`o botão de registo continua no bloco 2: ${await botao.count()}`);
    if (await botao.count()) {
      await botao.click();
      log(`valor sugerido no 2.º envio: ${await (await campo(p, "Valor do bloco")).inputValue()}`);
      await (await campo(p, "Valor do bloco")).fill("0");
      await (await campo(p, "Contas (opcional)")).fill("450");
      await p.getByTestId("confirmar-recebimento").click();
      const resposta = p.getByTestId("recebimento-registrado").or(formulario(p).locator("p.text-red-600"));
      await expect(resposta.first()).toBeVisible({ timeout: 20_000 });
      log(`resposta da tela ao declarar as contas depois: ${(await resposta.first().innerText()).replace(/\s+/g, " ")}`);
      await card2.screenshot({ path: `${SAIDA}/e1072-c-contas-depois.png` });
    }
    log(`gravado bloco 2 (depois do 2.º envio): ${JSON.stringify(await linhas(ids.b2))}`);
    await p.context().close();
  });

  test("D. o morador confirma; o recibo e o pacote de provas", async ({ browser }) => {
    const m = await abrir(browser, mor.email);
    await m.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
    const confirmar = m.getByTestId("confirmar-pagamentos");
    await expect(confirmar).toBeVisible({ timeout: 20_000 });
    log(`o que o morador vê para confirmar: ${(await confirmar.innerText()).replace(/\s+/g, " ")}`);
    await confirmar.screenshot({ path: `${SAIDA}/e1072-d-morador-confirma.png` });
    const n = await confirmar.getByRole("button", { name: /Confirmar/ }).count();
    for (let i = 0; i < n; i++) {
      await confirmar.getByRole("button", { name: /Confirmar/ }).first().click();
      await expect(confirmar.getByRole("button", { name: /Confirmar/ })).toHaveCount(n - 1 - i, { timeout: 20_000 });
    }
    await expect.poll(async () => (await linhas()).every((l) => l.confirmado_pelo_inquilino), { timeout: 20_000 }).toBe(true);
    await m.context().close();

    let docs: Record<string, unknown>[] = [];
    await expect
      .poll(async () => {
        docs = (await adm().from("documentos_fiscais").select("id, tipo, numero, valor, encargos, pagamento_id").eq("contrato_id", ids.contrato!)).data ?? [];
        return docs.length;
      }, { timeout: 60_000, message: "os recibos saem depois da confirmação" })
      .toBeGreaterThanOrEqual(2);
    log(`documentos emitidos: ${JSON.stringify(docs)}`);

    const p = await abrir(browser, dono.email);
    for (const d of docs) {
      const r = await p.request.get(`/api/documentos/${d.id}`);
      const corpo = await r.body();
      writeFileSync(`${SAIDA}/e1072-d-${d.numero}.pdf`, corpo);
      log(`recibo ${d.numero} (status ${r.status()}): ${textoDoPdf(corpo).replace(/\s+/g, " ")}`);
    }
    const pac = await p.request.get(`/api/contrato/${ids.contrato}/provas`);
    const corpo = await pac.body();
    writeFileSync(`${SAIDA}/e1072-d-pacote-de-provas.pdf`, corpo);
    const texto = textoDoPdf(corpo);
    const pagamentos = texto.slice(texto.indexOf("PAGAMENTOS"), texto.indexOf("CONFERÊNCIAS") > 0 ? texto.indexOf("CONFERÊNCIAS") : undefined);
    log(`pacote de provas (status ${pac.status()}), secção PAGAMENTOS: ${pagamentos.replace(/\s+/g, " ")}`);
    log(`o pacote menciona "Contas": ${/Contas/.test(texto)} · "limpeza": ${/limpeza/i.test(texto)} · "450": ${/450/.test(texto)}`);
    await contratos(p);
    await p.screenshot({ path: `${SAIDA}/e1072-d-contratos-dono-final.png`, fullPage: true });
    await p.context().close();
  });
});
