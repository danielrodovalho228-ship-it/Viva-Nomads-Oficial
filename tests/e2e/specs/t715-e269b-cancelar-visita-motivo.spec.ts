import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { formatarHorarioBrasilia } from "../../../src/lib/visitas-video";

/*
  T715 — E269-B (#1609): cancelar a visita com motivo OPCIONAL (opções de um toque do lado de quem cancela + texto de
  até 140 caracteres), que chega à OUTRA parte — no e-mail e no cartão ("Cancelada · motivo"); quem cancelou recebe a
  cópia sem o motivo. A t585 (d2/d3) já cobre o dono com opção + texto e o morador sem nada / com HTML; aqui:
    A. a moradora cancela a visita CONFIRMADA por vídeo só com a opção "Já encontrei outro imóvel" → o e-mail do dono
       diz quem (primeiro nome, sem sobrenome), o imóvel, a modalidade, o horário confirmado (Brasília) e o motivo; a
       cópia da moradora não traz o motivo.
    B. o dono abre a folha e volta (nada muda); depois cancela a presencial confirmada com "Outro motivo" + texto → o
       motivo gravado é só o texto; o e-mail da moradora tem o nome do dono, o imóvel, o horário, o motivo e
       "Pedir outro horário".
    C. a moradora cancela um PEDIDO (dois horários) sem escolher nada → o e-mail do dono não tem a linha "Motivo:" e
       lista os dois horários; o cartão diz só "Cancelada".
    D. limite: o campo para em 140 caracteres (contador "140/140"); a opção + os 140 caracteres chegam inteiros ao
       dono; o cartão longo não passa da tela a 390.
  Em todos, o cartão mostra o cancelamento nos DOIS painéis (Visitas da moradora e ?de=dono), a 390 e a 1280, sem
  botão de cancelar. Contas de teste: os e-mails caem em emails_teste (o texto do e-mail), lido aqui.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: string[] = [];

async function conta(quem: string, nome: string, role: "owner" | "tenant") {
  const email = `${quem}.t715.${sufixo}@lab.vivanomads.test`;
  const id = await criarConta({ email, nome, role }, senha);
  ids.push(id);
  const { error } = await adm().from("profiles").update({ is_teste: true }).eq("id", id);
  if (error) throw error;
  return { id, email };
}

const tituloDe = (letra: string) => `Studio E269 ${letra} t715 ${sufixo}`;

async function cenario(letra: string) {
  const dono = await conta(`dono${letra.toLowerCase()}`, "Dora Anfitria Sobrenome", "owner");
  const inq = await conta(`bia${letra.toLowerCase()}`, "Bia Visitante Sobrenome", "tenant");
  const imovel = await criarImovelPronto(dono.id, tituloDe(letra), { ativo: true, preco: 3200 });
  await criarLead(dono.id, inq.id, imovel);
  return { dono, inq, imovel };
}

/** Um horário cheio daqui a `horas` horas (no futuro: o cartão não vira "Horário passou"). */
function daqui(horas: number): string {
  const t = new Date(Date.now() + horas * 3600_000);
  t.setUTCMinutes(0, 0, 0);
  return t.toISOString();
}

async function visita(c: Awaited<ReturnType<typeof cenario>>, v: { modalidade: "video" | "presencial"; horarios: string[]; confirmado?: string }): Promise<string> {
  const { data, error } = await adm()
    .from("visitas_video")
    .insert({
      property_id: c.imovel,
      owner_id: c.dono.id,
      tenant_id: c.inq.id,
      horarios: v.horarios,
      modalidade: v.modalidade,
      ...(v.confirmado ? { status: "confirmado", horario_confirmado: v.confirmado } : {}),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function gravada(id: string) {
  const { data } = await adm().from("visitas_video").select("status, motivo_recusa").eq("id", id).single();
  return data as { status: string; motivo_recusa: string | null };
}

/** Os e-mails "visita_cancelada" da pessoa (com espera: o aviso sai depois da resposta). */
async function cancelamentos(usuarioId: string, n = 1): Promise<{ assunto: string; corpo: string }[]> {
  const ler = async () => ((await adm().from("emails_teste").select("assunto, corpo").eq("usuario_id", usuarioId).eq("evento", "visita_cancelada")).data ?? []) as { assunto: string; corpo: string }[];
  await expect.poll(async () => (await ler()).length, { timeout: 30_000, message: `${n} e-mail(s) visita_cancelada` }).toBe(n);
  return ler();
}

async function abrir(browser: Browser, email: string, caminho: string, largura: number): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  await page.goto(caminho, { waitUntil: "domcontentloaded" });
  return page;
}

/** O cartão cancelado nos DOIS painéis, a 390 e 1280: o status (com o motivo, quando houver) e nenhum botão de cancelar. */
async function canceladaNosDoisPaineis(browser: Browser, c: Awaited<ReturnType<typeof cenario>>, visitaId: string, status: string) {
  for (const [email, caminho] of [
    [c.inq.email, "/dashboard/visitas"],
    [c.dono.email, "/dashboard/visitas?de=dono"],
  ] as const) {
    const page = await entrar(browser, email, senha);
    for (const largura of [390, 1280]) {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(caminho, { waitUntil: "domcontentloaded" });
      const cartao = page.locator(`#visita-${visitaId}`);
      await expect(cartao.getByTestId("visita-status"), `${caminho} a ${largura}`).toHaveText(status, { timeout: 25_000 });
      await expect(cartao).toHaveAttribute("data-status", "cancelado");
      await expect(cartao.getByTestId("visita-cancelar")).toHaveCount(0);
      await expect(cartao.getByTestId("visita-cancelar-morador")).toHaveCount(0);
      await expect(cartao.getByTestId("visita-folha-cancelar")).toHaveCount(0);
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(sobra, `${caminho} a ${largura}: sem rolagem lateral`).toBeLessThanOrEqual(1);
    }
    await page.context().close();
  }
}

test.describe("T715 — E269-B: cancelar a visita com motivo opcional, que chega à outra parte", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas de teste).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.afterAll(async () => {
    if (ids.length) await adm().from("emails_teste").delete().in("usuario_id", ids);
    await apagarContas(ids);
  });

  test("A. a moradora cancela a confirmada por vídeo com a opção: o dono recebe quem, o imóvel, o horário e o motivo", async ({ browser }) => {
    const c = await cenario("A");
    const hora = daqui(50);
    const id = await visita(c, { modalidade: "video", horarios: [hora], confirmado: hora });
    const inq = await abrir(browser, c.inq.email, "/dashboard/visitas", 390);
    const cartao = inq.locator(`#visita-${id}`);
    await cartao.getByTestId("visita-cancelar-morador").click();
    const folha = cartao.getByTestId("visita-folha-cancelar");
    await expect(folha).toBeVisible();
    // As opções do lado da moradora (a "indisponível" é só do dono); nenhuma vem marcada.
    await expect(folha.getByTestId("visita-cancelar-opcao-indisponivel")).toHaveCount(0);
    for (const o of ["imprevisto", "horario", "outro_imovel", "outro"]) await expect(folha.getByTestId(`visita-cancelar-opcao-${o}`)).toHaveAttribute("aria-checked", "false");
    await folha.getByTestId("visita-cancelar-opcao-outro_imovel").click();
    await expect(folha.getByTestId("visita-cancelar-opcao-outro_imovel")).toHaveAttribute("aria-checked", "true");
    await folha.getByTestId("visita-cancelar-confirmar").click();
    await expect.poll(() => gravada(id), { timeout: 25_000 }).toEqual({ status: "cancelado", motivo_recusa: "Já encontrei outro imóvel" });
    await inq.context().close();

    const [aoDono] = await cancelamentos(c.dono.id);
    expect(aoDono.corpo, "saudação do dono + quem cancelou").toContain("Olá Dora, Bia cancelou a visita por vídeo.");
    expect(aoDono.corpo).toContain(`Imóvel: ${tituloDe("A")}`);
    expect(aoDono.corpo).toContain("Visita: por vídeo");
    expect(aoDono.corpo).toContain(`Horário: ${formatarHorarioBrasilia(hora)}`);
    expect(aoDono.corpo).toContain("Cancelada por: Bia");
    expect(aoDono.corpo).toContain("Motivo: Já encontrei outro imóvel");
    expect(aoDono.corpo).toContain("Ver as visitas");
    expect(aoDono.corpo, "só o primeiro nome da moradora").not.toContain("Bia Visitante Sobrenome");
    // A cópia de quem cancelou: "você cancelou", sem o motivo de volta.
    const [copia] = await cancelamentos(c.inq.id);
    expect(copia.assunto).toBe("Você cancelou a visita · Viva Nomads");
    expect(copia.corpo).toContain(`Olá Bia, você cancelou a visita por vídeo em ${tituloDe("A")}. O proprietário já recebeu o aviso.`);
    expect(copia.corpo).toContain(`Horário: ${formatarHorarioBrasilia(hora)}`);
    expect(copia.corpo).not.toContain("Motivo:");
    expect(copia.corpo).not.toContain("Já encontrei outro imóvel");

    await canceladaNosDoisPaineis(browser, c, id, "Cancelada · Já encontrei outro imóvel");
  });

  test("B. o dono volta sem cancelar; depois cancela a presencial com 'Outro motivo' + texto: a moradora recebe o texto", async ({ browser }) => {
    const c = await cenario("B");
    const hora = daqui(74);
    const id = await visita(c, { modalidade: "presencial", horarios: [hora], confirmado: hora });
    const dono = await abrir(browser, c.dono.email, "/dashboard/visitas?de=dono", 1280);
    const cartao = dono.locator(`#visita-${id}`);
    // "Voltar" fecha a folha e nada muda.
    await cartao.getByTestId("visita-cancelar").click();
    await expect(cartao.getByTestId("visita-folha-cancelar")).toBeVisible();
    await expect(cartao.getByTestId("visita-cancelar-opcao-outro_imovel")).toHaveCount(0); // opção só da moradora
    await cartao.getByTestId("visita-cancelar-voltar").click();
    await expect(cartao.getByTestId("visita-folha-cancelar")).toHaveCount(0);
    await expect(cartao.getByTestId("visita-cancelar")).toBeVisible();
    await dono.waitForTimeout(1_500);
    expect((await gravada(id)).status).toBe("confirmado");

    const texto = "Preciso viajar a trabalho nessa semana";
    await cartao.getByTestId("visita-cancelar").click();
    await cartao.getByTestId("visita-cancelar-opcao-outro").click();
    await cartao.getByTestId("visita-cancelar-texto").fill(texto);
    await expect(cartao.getByTestId("visita-folha-cancelar")).toContainText(`${texto.length}/140`);
    await cartao.getByTestId("visita-cancelar-confirmar").click();
    // "Outro motivo" com texto vira só o texto.
    await expect.poll(() => gravada(id), { timeout: 25_000 }).toEqual({ status: "cancelado", motivo_recusa: texto });
    await dono.context().close();

    const [aMoradora] = await cancelamentos(c.inq.id);
    expect(aMoradora.corpo).toContain("Olá Bia, Dora cancelou a visita presencial. Se ainda quiser conhecer o imóvel, peça outro horário.");
    expect(aMoradora.corpo).toContain(`Imóvel: ${tituloDe("B")}`);
    expect(aMoradora.corpo).toContain(`Horário: ${formatarHorarioBrasilia(hora)}`);
    expect(aMoradora.corpo).toContain("Cancelada por: Dora");
    expect(aMoradora.corpo).toContain(`Motivo: ${texto}`);
    expect(aMoradora.corpo).not.toContain("Outro motivo");
    expect(aMoradora.corpo).toContain("Pedir outro horário");
    expect(aMoradora.corpo).not.toContain("Dora Anfitria Sobrenome");
    const [copia] = await cancelamentos(c.dono.id);
    expect(copia.corpo).toContain(`você cancelou a visita presencial em ${tituloDe("B")}. O morador já recebeu o aviso.`);
    expect(copia.corpo).not.toContain(texto);

    await canceladaNosDoisPaineis(browser, c, id, `Cancelada · ${texto}`);
  });

  test("C. a moradora cancela um pedido sem motivo: nenhuma linha 'Motivo:' no e-mail do dono; o cartão diz só 'Cancelada'", async ({ browser }) => {
    const c = await cenario("C");
    const h1 = daqui(30);
    const h2 = daqui(54);
    const id = await visita(c, { modalidade: "video", horarios: [h1, h2] });
    const inq = await abrir(browser, c.inq.email, "/dashboard/visitas", 1280);
    const cartao = inq.locator(`#visita-${id}`);
    await cartao.getByTestId("visita-cancelar-morador").click();
    await cartao.getByTestId("visita-cancelar-confirmar").click();
    await expect.poll(() => gravada(id), { timeout: 25_000 }).toEqual({ status: "cancelado", motivo_recusa: null });
    await inq.context().close();

    const [aoDono] = await cancelamentos(c.dono.id);
    expect(aoDono.corpo).toContain("Olá Dora, Bia cancelou a visita por vídeo.");
    expect(aoDono.corpo).toContain(`Imóvel: ${tituloDe("C")}`);
    expect(aoDono.corpo, "os horários propostos, no horário de Brasília").toContain(`Horário: ${formatarHorarioBrasilia(h1)}; ${formatarHorarioBrasilia(h2)}`);
    expect(aoDono.corpo).toContain("Cancelada por: Bia");
    expect(aoDono.corpo, "sem linha de motivo (nem vazia)").not.toContain("Motivo:");

    await canceladaNosDoisPaineis(browser, c, id, "Cancelada");
  });

  test("D. limite de 140: o campo para no limite e a opção + o texto inteiro chegam ao dono; o cartão longo cabe a 390", async ({ browser }) => {
    const c = await cenario("D");
    const hora = daqui(98);
    const id = await visita(c, { modalidade: "video", horarios: [hora], confirmado: hora });
    const inq = await abrir(browser, c.inq.email, "/dashboard/visitas", 390);
    const cartao = inq.locator(`#visita-${id}`);
    await cartao.getByTestId("visita-cancelar-morador").click();
    await cartao.getByTestId("visita-cancelar-opcao-imprevisto").click();
    const campo = cartao.getByTestId("visita-cancelar-texto");
    await expect(campo).toHaveAttribute("maxlength", "140");
    // Digitado (não colado por fill): o navegador para no 140º caractere.
    const longo = "Meu voo foi remarcado e chego so depois da data ".repeat(4); // 192 caracteres
    await campo.pressSequentially(longo);
    const noCampo = await campo.inputValue();
    expect(noCampo).toHaveLength(140);
    expect(noCampo).toBe(longo.slice(0, 140));
    await expect(cartao.getByTestId("visita-folha-cancelar")).toContainText("140/140");
    await cartao.getByTestId("visita-cancelar-confirmar").click();
    const esperado = `Surgiu um imprevisto: ${noCampo.replace(/\s+/g, " ").trim()}`;
    await expect.poll(() => gravada(id), { timeout: 25_000 }).toEqual({ status: "cancelado", motivo_recusa: esperado });
    await inq.context().close();

    const [aoDono] = await cancelamentos(c.dono.id);
    expect(aoDono.corpo).toContain("Olá Dora, Bia cancelou a visita por vídeo.");
    expect(aoDono.corpo).toContain(`Imóvel: ${tituloDe("D")}`);
    expect(aoDono.corpo).toContain(`Horário: ${formatarHorarioBrasilia(hora)}`);
    expect(aoDono.corpo, "o motivo inteiro, sem corte").toContain(`Motivo: ${esperado}`);

    await canceladaNosDoisPaineis(browser, c, id, `Cancelada · ${esperado}`);
  });
});
