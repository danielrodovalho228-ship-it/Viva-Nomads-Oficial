import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { campoBrasiliaParaIso, instanteParaCampoBrasilia } from "../../../src/lib/visitas-video";

/*
  T2210 — E1055 (linha Mensagens; ORDEM-DUET-321). A cobertura E2E da mensagem de confirmação da visita do lado do DONO:
  até aqui o E1039 só tinha travas unitárias (e1039-trava-mensagem-confirmacao.test.ts) e a t211 lia a cópia do morador.
  O caminho do E1039, todo pela tela: visita PRESENCIAL pedida → o dono propõe outro horário → o morador aceita → o dono
  recebe "visita confirmada" (caixa de QA, evento visita_confirmada) com:
    - quem confirmou e com quem é a visita: o PRIMEIRO nome do morador (E328: nunca o sobrenome);
    - o horário aceite (o que o dono propôs, em horário de Brasília);
    - o imóvel (título);
    - a linha de que o visitante foi orientado a levar documento com foto (E1039, #4047);
    - NUNCA o endereço nem "Abrir no mapa" (o dono não recebe o endereço do próprio imóvel na confirmação).
  O pedido da visita é gravado pelo laboratório (simulação declarada; o pedido pela tela tem trava na t168/t2207).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2210.${sufixo}@lab.vivanomads.test`, nome: "Dora Confirmada", role: "owner" as const };
const mor = { email: `mor.t2210.${sufixo}@lab.vivanomads.test`, nome: "Iara Sobrenomeoculto", role: "tenant" as const };
const ids: { dono?: string; mor?: string; imovel?: string; visita?: string } = {};
const TITULO = `Studio da confirmação ${sufixo}`;
const ORIENTADO = "O visitante foi orientado a levar um documento com foto.";

async function abrir(browser: Browser, email: string, largura = 1280): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  return page;
}

async function visita() {
  return (await adm().from("visitas_video").select("status, horario_confirmado").eq("id", ids.visita!).single()).data;
}

/** O último e-mail do evento na caixa de QA de uma conta (com espera: o aviso sai depois da resposta). */
async function emailDe(usuarioId: string, evento: string): Promise<{ assunto: string; corpo: string }> {
  for (let i = 0; i < 40; i++) {
    const { data } = await adm().from("emails_teste").select("assunto, corpo").eq("usuario_id", usuarioId).eq("evento", evento).order("criado_em", { ascending: false }).limit(1);
    if (data?.[0]?.corpo) return { assunto: String(data[0].assunto ?? ""), corpo: String(data[0].corpo) };
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`sem e-mail ${evento} na caixa de QA`);
}

test.describe("T2210 — E1055: a confirmação da visita presencial chega ao DONO com quem, quando e sem endereço @E1055 @E1039", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.mor = await criarConta(mor, senha);
    // Contas de teste: os e-mails ficam na caixa de QA de cada uma.
    const { error } = await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.mor]);
    if (error) throw error;
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true });
    const pedido = new Date(Date.now() + 2 * 24 * 3600_000);
    pedido.setUTCMinutes(0, 0, 0);
    const { data, error: ev } = await adm()
      .from("visitas_video")
      .insert({ property_id: ids.imovel, owner_id: ids.dono, tenant_id: ids.mor, horarios: [pedido.toISOString()], modalidade: "presencial" })
      .select("id")
      .single();
    if (ev) throw ev;
    ids.visita = data.id as string;
  });
  test.afterAll(async () => {
    if (ids.imovel) await adm().from("visitas_video").delete().eq("property_id", ids.imovel);
    await apagarContas([ids.dono!, ids.mor!].filter(Boolean));
  });

  test("o dono propõe outro horário, o morador aceita, e a confirmação do dono traz quem, quando e nada do endereço", async ({ browser }) => {
    test.info().annotations.push({ type: "simulação", description: "o pedido da visita presencial é gravado pelo laboratório (o pedido pela tela tem trava na t168/t2207)" });
    const novo = instanteParaCampoBrasilia(new Date(Date.now() + 3 * 24 * 3600_000)).slice(0, 10) + "T10:30";

    // 1. o dono propõe outro horário, pela tela
    const d = await abrir(browser, dono.email);
    await d.goto("/dashboard/visitas?de=dono", { waitUntil: "domcontentloaded" });
    const cartao = d.locator(`#visita-${ids.visita}`);
    await expect(cartao.getByTestId("visita-outro-horario")).toBeVisible({ timeout: 25_000 });
    await cartao.getByTestId("visita-outro-horario").fill(novo);
    await cartao.getByTestId("visita-propor").click();
    await expect.poll(async () => (await visita())?.status, { timeout: 25_000, message: "a proposta do dono grava" }).toBe("remarcar");
    await d.context().close();

    // 2. o morador aceita o horário proposto, pela tela
    const m = await abrir(browser, mor.email, 390);
    await m.goto("/dashboard/visitas", { waitUntil: "domcontentloaded" });
    await expect(m.getByTestId("visita-horario-proposto").first()).toContainText("10:30", { timeout: 25_000 });
    await m.getByTestId("visita-aceitar-remarcacao").first().click();
    await expect.poll(async () => (await visita())?.status, { timeout: 25_000, message: "o aceite do morador grava" }).toBe("confirmado");
    expect(new Date((await visita())!.horario_confirmado as string).toISOString(), "o horário confirmado é o que o dono propôs").toBe(campoBrasiliaParaIso(novo));
    await m.context().close();

    // 3. a confirmação que o DONO recebe
    const { assunto, corpo } = await emailDe(ids.dono!, "visita_confirmada");
    const tudo = `${assunto}\n${corpo}`;
    expect(tudo, "o imóvel da visita").toContain(TITULO);
    expect(corpo, "com quem é a visita: o primeiro nome do morador").toContain("Iara");
    expect(tudo, "E328: nunca o sobrenome").not.toContain("Sobrenomeoculto");
    expect(corpo, "o horário aceite, em Brasília").toContain("10:30");
    expect(corpo, "E1039: o visitante foi orientado a levar documento com foto").toContain(ORIENTADO);
    expect(tudo, "o dono não recebe o endereço").not.toMatch(/Endereço:|Abrir no mapa/);
    expect(tudo, "nem o e-mail do morador").not.toContain(mor.email);
  });
});
