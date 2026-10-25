import { test, expect, type Browser, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T299 — Prompt 39-B1, "Recibos e notas" nos três papéis (390 e 1280 px). Só no laboratório.
  Os documentos são semeados direto (o caminho da emissão já tem specs próprios: t220, t223, t227, t230):
  dono com 2 imóveis, 2 moradores, recibos em 2 meses + um comprovante de Caução; parceiro com um serviço
  concluído sem a nota dele.
   1. 1280 — dono filtra por imóvel e mês, o resumo do mês confere com a soma dos recibos, baixa o PDF do recibo,
      o resumo (PDF), o informe (CSV) e o ano (ZIP);
   2. 390 — no celular, o bloco "Recibos e notas" fica na aba Ganhos e leva à tela; sem rolagem lateral;
   3. 390 — morador baixa o resumo para reembolso da estadia dele; a estadia de outro morador dá 404;
   4. 1280 — parceiro vê "Falta a nota do serviço X" e não vê o comprovante do gateway (pagamento desligado).
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t299.${sufixo}@lab.vivanomads.test`, nome: "Helena Recibos Prado", role: "owner" as const };
const inqA = { email: `inqa.t299.${sufixo}@lab.vivanomads.test`, nome: "Ana Recibos Lima", role: "tenant" as const };
const inqB = { email: `inqb.t299.${sufixo}@lab.vivanomads.test`, nome: "Bruno Recibos Costa", role: "tenant" as const };
const parc = { email: `parc.t299.${sufixo}@lab.vivanomads.test`, nome: "Paula Limpeza Reis", role: "tenant" as const };
const ids: Record<string, string> = {};
const CPF_A = "52998224725";
const CPF_B = "11144477735";

/** yyyy-mm-dd em Brasília, deslocado em meses (dia 05 para não cair em virada de mês). */
function diaDoMes(deslocamento: number): string {
  const agora = new Date(Date.now() - 3 * 3_600_000);
  const d = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + deslocamento, 5));
  return d.toISOString().slice(0, 10);
}
const MES = diaDoMes(0).slice(0, 7);
const MES_ANTERIOR = diaDoMes(-1).slice(0, 7);
const PDF_MINIMO = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

async function abrir(browser: Browser, email: string, largura: number): Promise<Page> {
  const p = await entrar(browser, email, senha);
  await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  return p;
}

async function contrato(imovel: string, inquilino: string): Promise<{ contrato: string; bloco1: string; bloco2: string }> {
  const agora = new Date().toISOString();
  const { data, error } = await adm()
    .from("contratos")
    .insert({
      property_id: imovel, tenant_id: inquilino, owner_plan: "free", faixa: "temporada", prazo_total_dias: 120, aluguel_mensal: 3200,
      tamanho_bloco_meses: 1, comissao_percent: 0.12, comissao_valor: 768, qtd_ocupantes: 1, status: "ativo", garantia: "caucao",
      assinado_proprietario_em: agora, assinado_inquilino_em: agora,
    })
    .select("id")
    .single();
  if (error) throw error;
  const { data: bl, error: eB } = await adm()
    .from("contrato_blocos")
    .insert([
      { contrato_id: data.id, numero_bloco: 1, inicio: diaDoMes(-1), fim: diaDoMes(0), meses: 1, valor: 3200, caucao: 3200, status: "ativo" },
      { contrato_id: data.id, numero_bloco: 2, inicio: diaDoMes(0), fim: diaDoMes(1), meses: 1, valor: 3200, caucao: 0, status: "ativo", aceite_proprietario_em: agora, aceite_inquilino_em: agora },
    ])
    .select("id, numero_bloco");
  if (eB) throw eB;
  return { contrato: data.id as string, bloco1: bl!.find((b) => b.numero_bloco === 1)!.id as string, bloco2: bl!.find((b) => b.numero_bloco === 2)!.id as string };
}

let seq = 0;
/** Pagamento confirmado + o documento dele (o mesmo retrato que a emissão grava), com o PDF no depósito. */
async function documento(o: {
  tipo: "recibo_aluguel" | "comprovante_caucao";
  contrato: string;
  bloco: string | null;
  inquilino: string;
  nomeInq: string;
  cpfInq: string;
  valor: number;
  data: string;
}): Promise<string> {
  const { data: pg, error: ePg } = await adm()
    .from("pagamentos_bloco")
    .insert({
      contrato_id: o.contrato, bloco_id: o.bloco, tipo: o.tipo === "recibo_aluguel" ? "aluguel" : "caucao", valor: o.valor, forma: "pix",
      data_pagamento: o.data, marcado_por: ids.dono, confirmado_pelo_inquilino: true, confirmado_em: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (ePg) throw ePg;
  const prefixo = o.tipo === "recibo_aluguel" ? "REC" : "CAU";
  const numero = `${prefixo}-${o.data.slice(0, 4)}-T299${sufixo.toUpperCase()}${++seq}`;
  const path = `lab/t299/${sufixo}-${seq}.pdf`;
  const up = await adm().storage.from("documentos").upload(path, PDF_MINIMO, { contentType: "application/pdf", upsert: true });
  if (up.error) throw up.error;
  const { data: doc, error } = await adm()
    .from("documentos_fiscais")
    .insert({
      tipo: o.tipo, numero, ano: Number(o.data.slice(0, 4)), contrato_id: o.contrato, pagamento_id: pg.id, owner_id: ids.dono, tenant_id: o.inquilino,
      locador_nome: dono.nome, locador_doc: "39053344705", locatario_nome: o.nomeInq, locatario_doc: o.cpfInq, imovel_endereco: "Rua do Laboratório, 99 — Uberlândia/MG",
      contrato_ref: `VN-CT-${o.contrato.slice(0, 8).toUpperCase()}`, periodo_inicio: o.data, periodo_fim: o.data, valor: o.valor,
      hash: randomBytes(32).toString("hex"), pdf_path: path,
    })
    .select("id")
    .single();
  if (error) throw error;
  return doc.id as string;
}

test.describe("T299 — Recibos e notas (39-B1)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    test.setTimeout(180_000);
    ids.dono = await criarConta(dono, senha);
    ids.inqA = await criarConta(inqA, senha);
    ids.inqB = await criarConta(inqB, senha);
    ids.parc = await criarConta(parc, senha);
    ids.imovel1 = await criarImovelPronto(ids.dono, `Studio Recibos ${sufixo}`, { ativo: true, preco: 3200 });
    ids.imovel2 = await criarImovelPronto(ids.dono, `Apto Recibos ${sufixo}`, { ativo: true, preco: 2800 });
    const a = await contrato(ids.imovel1, ids.inqA);
    const b = await contrato(ids.imovel2, ids.inqB);
    ids.contratoA = a.contrato;
    ids.contratoB = b.contrato;
    // Mês atual: recibo do imóvel 1 (3.200) + recibo do imóvel 2 (2.800) + Caução do imóvel 1 (3.200, fora do resumo).
    ids.recA = await documento({ tipo: "recibo_aluguel", contrato: a.contrato, bloco: a.bloco2, inquilino: ids.inqA, nomeInq: inqA.nome, cpfInq: CPF_A, valor: 3200, data: diaDoMes(0) });
    ids.recB = await documento({ tipo: "recibo_aluguel", contrato: b.contrato, bloco: b.bloco2, inquilino: ids.inqB, nomeInq: inqB.nome, cpfInq: CPF_B, valor: 2800, data: diaDoMes(0) });
    ids.cauA = await documento({ tipo: "comprovante_caucao", contrato: a.contrato, bloco: null, inquilino: ids.inqA, nomeInq: inqA.nome, cpfInq: CPF_A, valor: 3200, data: diaDoMes(0) });
    // Mês anterior: recibo do imóvel 1.
    ids.recA0 = await documento({ tipo: "recibo_aluguel", contrato: a.contrato, bloco: a.bloco1, inquilino: ids.inqA, nomeInq: inqA.nome, cpfInq: CPF_A, valor: 3200, data: diaDoMes(-1) });
    // Parceiro com um serviço concluído SEM a nota dele.
    const { data: p, error: eP } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.parc, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: parc.nome, slug: `limpeza-t299-${sufixo}`, categorias: ["limpeza"], cidades: ["Uberlândia"], descricao_curta: "Parceiro de laboratório.", status: "publicado", publicado_em: new Date().toISOString() })
      .select("id")
      .single();
    if (eP) throw eP;
    ids.codigo = `VN-SV-T299${sufixo.slice(0, 4).toUpperCase()}`;
    const { error: ePed } = await adm().from("parceiro_pedidos").insert({
      codigo: ids.codigo, parceiro_id: p.id, cliente_id: ids.inqA, categoria: "limpeza", descricao: "Limpeza de laboratório", status: "concluido",
      valor_combinado: 300, taxa_percent: 0.1, valor_taxa: 30, valor_parceiro: 270, concluido_em: new Date().toISOString(),
    });
    if (ePed) throw ePed;
  });

  test.afterAll(async () => {
    await apagarContas([ids.parc, ids.inqA, ids.inqB, ids.dono]);
  });

  test("1. 1280 — dono com 2 imóveis filtra por imóvel e mês, o resumo confere com a soma dos recibos e os arquivos baixam", async ({ browser }) => {
    test.setTimeout(150_000);
    const d = await abrir(browser, dono.email, 1280);
    await d.goto("/dashboard/recibos", { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("recibos-aviso")).toHaveText("Estes valores vêm dos recibos da Viva. A declaração é sua ou do seu contador.");
    await expect(d.getByRole("heading", { name: "Recibos e notas" })).toBeVisible();
    expect((await d.locator("h1, h2, h3").allInnerTexts()).join(" ")).not.toMatch(/impostos/i);

    // Todos os imóveis, mês atual: 2 recibos + a Caução; o resumo soma só os recibos (3.200 + 2.800).
    await d.getByTestId("recibos-filtro-mes").selectOption(MES);
    await d.getByTestId("recibos-filtrar").click();
    await expect(d).toHaveURL(new RegExp(`mes=${MES}`));
    await expect(d.getByTestId("recibo-item")).toHaveCount(3);
    const valores = await d.locator('[data-testid="recibo-item"][data-tipo="recibo_aluguel"]').evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-valor"))));
    const soma = valores.reduce((s, v) => s + v, 0);
    expect(soma).toBe(6000);
    await expect(d.getByTestId("recibos-resumo-total")).toHaveAttribute("data-total", String(soma));
    await expect(d.getByTestId("recibos-por-pagador")).toContainText(inqA.nome);
    await expect(d.getByTestId("recibos-por-pagador")).toContainText("529.982.247-25");
    await expect(d.getByTestId("recibos-por-pagador")).toContainText(inqB.nome);
    await expect(d.getByTestId("recibos-formula")).toContainText("soma dos recibos confirmados no mês");
    // O CPF nunca vai para a URL.
    expect(d.url()).not.toMatch(/529|111\.444|cpf/i);

    // Filtro por imóvel: só o Studio (recibo + Caução).
    await d.getByTestId("recibos-filtro-imovel").selectOption(ids.imovel1);
    await d.getByTestId("recibos-filtrar").click();
    await expect(d).toHaveURL(new RegExp(`imovel=${ids.imovel1}`));
    await expect(d.getByTestId("recibo-item")).toHaveCount(2);
    await expect(d.getByTestId("recibos-resumo-total")).toHaveAttribute("data-total", "3200");

    // Mês anterior do mesmo imóvel: 1 recibo.
    await d.getByTestId("recibos-filtro-mes").selectOption(MES_ANTERIOR);
    await d.getByTestId("recibos-filtrar").click();
    await expect(d.getByTestId("recibo-item")).toHaveCount(1);
    await d.screenshot({ path: `${SAIDA}/t299-recibos-dono-1280.png`, fullPage: true });

    // Downloads: o PDF do recibo (pelo RLS), o resumo, o informe em CSV e o ZIP do ano.
    const pdfRecibo = await d.request.get(`/api/documentos/${ids.recA0}`);
    expect(pdfRecibo.status()).toBe(200);
    expect((await pdfRecibo.body()).subarray(0, 5).toString()).toBe("%PDF-");
    const resumo = await d.request.get(`/api/recibos/resumo?mes=${MES}&imovel=${ids.imovel1}`);
    expect(resumo.status()).toBe(200);
    expect(resumo.headers()["content-type"]).toContain("application/pdf");
    expect((await resumo.body()).subarray(0, 5).toString()).toBe("%PDF-");
    const ano = MES.slice(0, 4);
    const csv = await d.request.get(`/api/recibos/informe?ano=${ano}&formato=csv`);
    expect(csv.status()).toBe(200);
    const textoCsv = await csv.text();
    expect(textoCsv).toContain(inqA.nome);
    expect(textoCsv).toContain("soma dos recibos confirmados no ano");
    const zip = await d.request.get(`/api/recibos/ano?ano=${ano}`);
    expect(zip.status()).toBe(200);
    expect((await zip.body()).subarray(0, 2).toString()).toBe("PK");
    await d.context().close();
  });

  test("2. 390 — no celular o bloco fica na aba Ganhos e leva à tela de Recibos e notas", async ({ browser }) => {
    test.setTimeout(90_000);
    const d = await abrir(browser, dono.email, 390);
    await d.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    const bloco = d.getByTestId("bloco-recibos-dono");
    await expect(bloco).toBeVisible();
    await bloco.getByTestId("bloco-recibos-dono-abrir").click();
    await expect(d).toHaveURL(/\/dashboard\/recibos/);
    await expect(d.getByTestId("recibos-resumo")).toBeVisible();
    expect(await d.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await d.screenshot({ path: `${SAIDA}/t299-recibos-dono-390.png`, fullPage: true });
    await d.context().close();
  });

  test("3. 390 — morador baixa o resumo para reembolso da estadia dele; a de outro morador dá 404", async ({ browser }) => {
    test.setTimeout(90_000);
    const m = await abrir(browser, inqA.email, 390);
    await m.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
    const bloco = m.getByTestId("bloco-recibos-morador");
    await expect(bloco).toBeVisible();
    await expect(bloco.getByTestId("recibo-morador-item")).toHaveCount(3); // 2 recibos + a Caução, só da estadia dele
    await expect(bloco).not.toContainText(inqB.nome);
    const reembolso = await m.request.get(`/api/recibos/reembolso?contrato=${ids.contratoA}`);
    expect(reembolso.status()).toBe(200);
    expect((await reembolso.body()).subarray(0, 5).toString()).toBe("%PDF-");
    const alheio = await m.request.get(`/api/recibos/reembolso?contrato=${ids.contratoB}`);
    expect(alheio.status()).toBe(404);
    const anual = await m.request.get(`/api/recibos/informe?ano=${MES.slice(0, 4)}&papel=morador`);
    expect(anual.status()).toBe(200);
    expect(await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await bloco.screenshot({ path: `${SAIDA}/t299-recibos-morador-390.png` });
    await m.context().close();
  });

  test("4. 1280 — parceiro vê 'Falta a nota do serviço' e não vê o comprovante do gateway", async ({ browser }) => {
    test.setTimeout(90_000);
    const p = await abrir(browser, parc.email, 1280);
    await p.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
    const bloco = p.getByTestId("bloco-recibos-parceiro");
    await expect(bloco).toBeVisible();
    await expect(bloco.getByTestId("parceiro-pendencia-nota")).toHaveText(`Falta a nota do serviço ${ids.codigo}`);
    await expect(bloco.getByTestId("parceiro-servico-concluido")).toHaveCount(1);
    await expect(p.getByTestId("parceiro-comprovante-gateway")).toHaveCount(0);
    const resumo = await p.request.get(`/api/recibos/parceiro?ano=${new Date().getUTCFullYear()}`);
    expect(resumo.status()).toBe(200);
    await bloco.screenshot({ path: `${SAIDA}/t299-recibos-parceiro-1280.png` });
    await p.context().close();
  });
});
