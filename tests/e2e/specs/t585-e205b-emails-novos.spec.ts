import { test, expect, type Browser, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T585 — E205-B: os e-mails novos (desenho do coordenador, msg 65 de 28/10), lidos na caixa de QA (emails_teste) das
  contas de teste:
  a. boas-vindas UMA vez na primeira entrada (tela de intenção), pelo perfil, com a linha do dinheiro;
  b. aceite: DOIS e-mails — ao dono ("Proposta aceita: Inês quer morar…", "Preparar o contrato", taxa) e ao morador
     ("Você garantiu o seu próximo lar", linha do tempo com os prazos do sistema; sem taxa);
  c. recusa pelo morador → ao dono "Inês recusou a proposta" com o motivo e "Ajustar e enviar nova versão"; recusa pelo
     dono → ao morador "Dona recusou a proposta" e "Ver outros imóveis parecidos";
  d. visita: expirada (todos os horários passaram → "cancelado" com motivo "expirou", e-mail aos dois, cartão
     "Expirada"); cancelada (quem, motivo, horário; ao morador "Pedir outro horário"); véspera na hora quando a
     confirmação vem com menos de 24 h (morador: endereço exato + Abrir no mapa; dono: primeiro nome, sem endereço).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: string[] = [];
const ENDERECO = "Rua das Palmeiras, 77";

async function conta(papel: "owner" | "tenant", nome: string): Promise<{ id: string; email: string }> {
  const email = `${papel}.${randomBytes(3).toString("hex")}.${sufixo}@lab.vivanomads.test`;
  const id = await criarConta({ email, nome, role: papel }, senha);
  ids.push(id);
  const { error } = await adm().from("profiles").update({ is_teste: true }).eq("id", id);
  if (error) throw error;
  return { id, email };
}

/** O último e-mail do evento na caixa de QA (com espera: os avisos saem depois da resposta). */
async function emailDe(usuarioId: string, evento: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const { data } = await adm().from("emails_teste").select("corpo").eq("usuario_id", usuarioId).eq("evento", evento).order("criado_em", { ascending: false }).limit(1);
    const corpo = String(data?.[0]?.corpo ?? "");
    if (corpo) return corpo;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`sem e-mail ${evento} na caixa de teste`);
}

async function contar(usuarioId: string, evento: string): Promise<number> {
  const { count } = await adm().from("emails_teste").select("id", { count: "exact", head: true }).eq("usuario_id", usuarioId).eq("evento", evento);
  return count ?? 0;
}

const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

async function cenario(nome: string) {
  const dono = await conta("owner", `Dona ${nome} Sobrenome`);
  const inq = await conta("tenant", `Inês ${nome} Sobrenome`);
  const imovel = await criarImovelPronto(dono.id, `Studio E205 ${nome} ${sufixo}`, { ativo: true, preco: 3200 });
  await adm().from("properties").update({ exact_address: ENDERECO, city: "Uberlândia" }).eq("id", imovel);
  const lead = await criarLead(dono.id, inq.id, imovel);
  return { dono, inq, imovel, lead };
}

async function propostaNoBanco(c: Awaited<ReturnType<typeof cenario>>, autor: "owner" | "tenant", entrada = emDias(20)) {
  const { data: numero } = await adm().rpc("next_document_number", { p_type: "orcamento", p_year: new Date().getFullYear() });
  const { data: p, error } = await adm()
    .from("propostas")
    .insert({ numero, lead_id: c.lead, property_id: c.imovel, owner_id: c.dono.id, tenant_id: c.inq.id, status: "enviada", versao_atual: 1, validade_dias: 7, valida_ate: emDias(7) + "T23:00:00Z" })
    .select("id")
    .single();
  if (error) throw error;
  await adm().from("proposta_versoes").insert({ proposta_id: p.id, versao: 1, autor, valor_base: 3200, valor_mensal: 3200, meses: 4, data_entrada: entrada, total_mensal: 3200, total_contrato: 12800 });
  return p.id as string;
}

async function abrir(browser: Browser, email: string, caminho: string, largura = 390): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: 900 });
  await page.goto(caminho, { waitUntil: "domcontentloaded" });
  return page;
}

const ddmmaaaa = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

test.describe("T585 — E205-B: e-mails novos", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas de teste).");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  test("a. boas-vindas: uma vez, na primeira entrada, pelo perfil (proprietário)", async ({ browser }) => {
    const c = await conta("owner", "Olga Boasvindas Sobrenome");
    const p = await abrir(browser, c.email, "/auth/intencao");
    const tela = p.getByTestId("tela-intencao");
    await expect(tela).toBeVisible({ timeout: 20_000 });
    await tela.getByTestId("intencao-anunciar").click();
    await tela.getByTestId("intencao-continuar").click();
    const corpo = await emailDe(c.id, "boas_vindas");
    expect(corpo).toContain("Boas-vindas: como anunciar o seu imóvel");
    expect(corpo).toContain("Como anunciar");
    expect(corpo).toMatch(/1\. Qualificação[\s\S]*2\. Cadastro[\s\S]*3\. Publicar/);
    expect(corpo).toContain("A Viva não recebe nem guarda dinheiro: o pagamento é direto entre vocês.");
    expect(corpo).toContain("Anunciar meu imóvel");
    // Responder a intenção de novo (Conta) não manda outra.
    await p.goto("/auth/intencao", { waitUntil: "domcontentloaded" });
    if (await p.getByTestId("tela-intencao").isVisible().catch(() => false)) {
      await p.getByTestId("intencao-agora-nao").click().catch(() => null);
    }
    await new Promise((r) => setTimeout(r, 4000));
    expect(await contar(c.id, "boas_vindas")).toBe(1);
    await p.context().close();
  });

  test("b. aceite pelo morador: dois e-mails (dono com a taxa e 'Preparar o contrato'; morador com a linha do tempo)", async ({ browser }) => {
    const c = await cenario("Aceite");
    const entrada = emDias(20);
    const id = await propostaNoBanco(c, "owner", entrada);
    const inq = await abrir(browser, c.inq.email, `/dashboard/propostas/${id}`);
    await inq.getByTestId("proposta-aceitar").click();
    await expect.poll(async () => (await adm().from("propostas").select("status").eq("id", id).single()).data?.status, { timeout: 25_000 }).toBe("aceita");
    const aoDono = await emailDe(c.dono.id, "proposta_aceita");
    expect(aoDono).toContain("Proposta aceita: Inês quer morar no seu imóvel");
    expect(aoDono).not.toContain("Inês Aceite Sobrenome");
    expect(aoDono).toContain("Preparar o contrato");
    expect(aoDono).toContain(`/dashboard/fechamento?c=${c.lead}`);
    expect(aoDono).toMatch(/taxa de serviço/i);
    expect(aoDono).toContain("R$ 3.200");
    const aoMorador = await emailDe(c.inq.id, "proposta_aceita");
    expect(aoMorador).toContain("Você garantiu o seu próximo lar");
    expect(aoMorador).toMatch(/1\. Contrato para assinar\n2\. Caução[^\n]*: até a entrada, em /);
    expect(aoMorador).toContain(`até a entrada, em ${ddmmaaaa(entrada)}`);
    const d7 = new Date(Date.parse(`${entrada}T12:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10);
    expect(aoMorador).toContain(`Instruções de chegada: 7 dias antes da entrada, em ${ddmmaaaa(d7)}`);
    expect(aoMorador).toContain("Ver os próximos passos");
    expect(aoMorador).not.toMatch(/taxa de serviço|comiss/i);
    await inq.context().close();
  });

  test("c. recusa: pelo morador (ao dono, com motivo) e pelo dono (ao morador, imóveis parecidos)", async ({ browser }) => {
    const c = await cenario("Recusa");
    const id = await propostaNoBanco(c, "owner");
    const inq = await abrir(browser, c.inq.email, `/dashboard/propostas/${id}`);
    await inq.getByTestId("proposta-recusar").click();
    await inq.getByTestId("form-recusa").getByText("Datas", { exact: true }).click();
    await inq.getByTestId("confirmar-recusa").click();
    await expect(inq.getByTestId("proposta-status")).toHaveText("Recusada", { timeout: 15_000 });
    await inq.context().close();
    const aoDono = await emailDe(c.dono.id, "proposta_recusada");
    expect(aoDono).toContain("Inês recusou a proposta");
    expect(aoDono).toContain("Motivo: Datas.");
    expect(aoDono).toContain("Ajustar e enviar nova versão");

    const c2 = await cenario("RecusaDono");
    const id2 = await propostaNoBanco(c2, "tenant");
    const dono = await abrir(browser, c2.dono.email, `/dashboard/propostas/${id2}`);
    await dono.getByTestId("proposta-recusar").click();
    await dono.getByTestId("form-recusa").getByText("Valor", { exact: true }).click();
    await dono.getByTestId("confirmar-recusa").click();
    await expect(dono.getByTestId("proposta-status")).toHaveText("Recusada", { timeout: 15_000 });
    await dono.context().close();
    const aoMorador = await emailDe(c2.inq.id, "proposta_recusada");
    expect(aoMorador).toContain("Dona recusou a proposta");
    expect(aoMorador).toContain("Ver outros imóveis parecidos");
    expect(aoMorador).toContain("/buscar?cidade=Uberl%C3%A2ndia");
  });

  test("d1. visita expirada: abrir as visitas aplica a regra — cancelado/expirou, e-mail aos dois, cartão Expirada", async ({ browser }) => {
    const c = await cenario("Expira");
    const passados = [new Date(Date.now() - 2 * 86_400_000).toISOString(), new Date(Date.now() - 86_400_000).toISOString()];
    const { data: v, error } = await adm().from("visitas_video").insert({ property_id: c.imovel, owner_id: c.dono.id, tenant_id: c.inq.id, horarios: passados, modalidade: "presencial" }).select("id").single();
    if (error) throw error;
    const inq = await abrir(browser, c.inq.email, "/dashboard/visitas");
    await expect
      .poll(async () => (await adm().from("visitas_video").select("status, motivo_recusa").eq("id", v.id).single()).data, { timeout: 30_000 })
      .toEqual({ status: "cancelado", motivo_recusa: "expirou" });
    expect(await emailDe(c.inq.id, "visita_expirada")).toContain("o pedido expirou sem resposta. Peça outros horários.");
    expect(await emailDe(c.dono.id, "visita_expirada")).toContain("um pedido de visita expirou sem resposta. Responder rápido aumenta as suas chances.");
    await inq.reload({ waitUntil: "domcontentloaded" });
    const cartao = inq.locator(`#visita-${v.id}`);
    await expect(cartao.getByTestId("visita-status")).toHaveText("Expirada", { timeout: 20_000 });
    await expect(cartao.getByTestId("visita-motivo-recusa-texto")).toHaveCount(0);
    // Rodar de novo não repete o aviso.
    await inq.reload({ waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 3000));
    expect(await contar(c.inq.id, "visita_expirada")).toBe(1);
    await inq.context().close();
  });

  test("d2. véspera na hora (confirmada com < 24 h) e cancelada com quem/motivo/horário", async ({ browser }) => {
    const c = await cenario("Vespera");
    const daqui3h = new Date(Date.now() + 3 * 3600_000);
    daqui3h.setUTCMinutes(0, 0, 0);
    const { data: v, error } = await adm().from("visitas_video").insert({ property_id: c.imovel, owner_id: c.dono.id, tenant_id: c.inq.id, horarios: [daqui3h.toISOString()], modalidade: "presencial" }).select("id").single();
    if (error) throw error;
    const dono = await abrir(browser, c.dono.email, "/dashboard/visitas?de=dono", 1280);
    const cartao = dono.locator(`#visita-${v.id}`);
    await cartao.getByTestId("visita-confirmar").first().click();
    await expect.poll(async () => (await adm().from("visitas_video").select("status").eq("id", v.id).single()).data?.status, { timeout: 25_000 }).toBe("confirmado");
    const aoMorador = await emailDe(c.inq.id, "visita_vespera");
    expect(aoMorador).toContain(`Endereço: ${ENDERECO}`);
    expect(aoMorador).toMatch(/Abrir no mapa: https:\/\//);
    expect(aoMorador).toContain("horário de Brasília");
    const aoDono = await emailDe(c.dono.id, "visita_vespera");
    expect(aoDono).toContain("Morador: Inês");
    expect(aoDono).not.toContain(ENDERECO);
    expect(aoDono).not.toContain("Inês Vespera Sobrenome");

    // O dono cancela com motivo: o morador recebe quem, o motivo, o horário e "Pedir outro horário".
    await dono.reload({ waitUntil: "domcontentloaded" });
    await cartao.getByTestId("visita-cancelar").click();
    const motivo = cartao.getByTestId("visita-motivo-recusa");
    if (await motivo.isVisible().catch(() => false)) {
      await motivo.fill("Surgiu um imprevisto no imóvel");
      await cartao.getByTestId("visita-recusar-enviar").click();
    }
    await expect.poll(async () => (await adm().from("visitas_video").select("status").eq("id", v.id).single()).data?.status, { timeout: 25_000 }).toBe("cancelado");
    const cancelada = await emailDe(c.inq.id, "visita_cancelada");
    expect(cancelada).toContain("Dona cancelou a visita presencial");
    expect(cancelada).toContain("Cancelada por: Dona");
    expect(cancelada).toMatch(/Horário: .*horário de Brasília/);
    expect(cancelada).toContain("Pedir outro horário");
    await dono.context().close();
  });
});
