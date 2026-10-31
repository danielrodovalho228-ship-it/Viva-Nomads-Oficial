import { test, expect, type Browser, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, definirPlano, entrar, lerSaida, novaSenha, novoSufixo, tornarContratoVigente } from "../fixtures/laboratorio";

/*
  T749 — E267 residual (#1646): os últimos e-mails a clientes que saíam com o corpo genérico do modelo passam a dizer a
  pessoa ("Olá <primeiro nome>"), o imóvel e o fato, com o bloco de dados "Imóvel · …" no HTML. Pista C, bloco 82.
  Pelas telas e rotas de verdade, com contas de teste (is_teste: o texto do e-mail cai em emails_teste):
    M1. o dono inicia o atendimento    → morador: manutencao_atualizada "mudou a manutenção de hidráulica em <T> para
                                          "<situação>"", bloco Imóvel / Manutenção / Aberta em / Situação agora;
    M2. o morador escreve na ordem      → dono: manutencao_mensagem "o morador escreveu na manutenção de hidráulica em <T>";
    M3. o dono marca a provisória       → morador: "marcou a solução provisória na manutenção de elétrica em <T>";
    M4. o morador confirma a solução    → dono: "confirmou a solução da manutenção em <T>" (categoria "outros" não entra
                                          na frase nem no bloco);
    P.  o morador exclui o pedido       → dono que respondeu: pedido_encerrado "em Uberlândia que você respondeu com <T>",
                                          assunto "Pedido de moradia em Uberlândia encerrado";
    N.  "Fotografar pelo celular"       → dono: nivel_prova_celular com o item ("2 jogos de roupa de cama"), o imóvel e
                                          até quando o link vale;
    I1. o morador mede na entrada abaixo da metade da medida do dono (POST /api/internet/medicoes) → dono:
        internet_abaixo_medida com os dois números;
    I2. medição do dono com ~170 dias → cron de automações num 2º servidor (porta 3176, CRON_SECRET só dele, como a
        t728) → dono: internet_remedir com o dia em que vence; rodar de novo não repete.
  Fora daqui (registrado no PR): o manutencao_atrasada sai do cron de atendimento, que varre as ordens de todos os specs
  (um 2º servidor mandaria o aviso aos donos dos outros specs); o lembrete do interessado sai de uma ferramenta da Viva
  no chat. Os dois têm a ligação provada no teste unitário do #1646.
  L-81 (achado deste bloco): o e-mail da manutenção chama a situação de "Em andamento" (statusHumano), a tela de
  "Em atendimento" (SO_STATUS_META, critério 4 do Daniel). Caso M1-situação em test.fail.
  L-80 (achado deste bloco): o assunto do internet_abaixo_medida nunca leva o imóvel — o prefixo tem 47 caracteres, a
  régua de assuntos.ts deixa 8 para o título e exige 10, então volta sempre ao assunto do modelo. Caso I1-assunto em
  test.fail; o resto do e-mail (corpo e bloco) está certo e é cobrado no I1.
*/
const SAIDA = "tests/laboratorio/saida";
const PORTA = 3176;
const SEGREDO = `lab-t749-${Math.random().toString(36).slice(2)}`;
const MARCA = " · Viva Nomads";
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: Record<string, string> = {};
const emails: Record<string, string> = {};
let servidor: ChildProcess | null = null;
const H = 3_600_000;
const DIA = 24 * H;

// Títulos curtos: cabem inteiros em todos os assuntos com título (a régua só encolhe acima de 70 caracteres).
const T = `Lar M ${sufixo}`;
const NET = `Net ${sufixo}`;
const porExtenso = (t: string) => `${t} · Centro, Uberlândia`;
const IMOVEL = { lat: -18.9186, lng: -48.2772 };
const PERTO = { lat: -18.9178, lng: -48.2772 }; // ~90 m
const MSG_MORADOR = `A pia continua pingando de noite (${sufixo}).`;

/** "05/11/2026 às 10:00" no horário de Brasília, como corpo-e267-residual.ts monta. */
function quando(iso: string): string {
  const p = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const v = (k: string) => p.find((x) => x.type === k)?.value ?? "";
  return `${v("day")}/${v("month")}/${v("year")} às ${v("hour")}:${v("minute")}`;
}
/** O dia da data ISO (UTC), como dia() do construtor. */
const diaIso = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

async function conta(quem: string, nome: string, role: "owner" | "tenant") {
  emails[quem] = `${quem}.t749.${sufixo}@lab.vivanomads.test`;
  const id = await criarConta({ email: emails[quem], nome, role }, senha);
  await adm().from("profiles").update({ is_teste: true }).eq("id", id);
  ids[quem] = id;
}

type Email = { assunto: string; corpo: string };

async function caixa(usuarioId: string, evento: string): Promise<Email[]> {
  const { data } = await adm().from("emails_teste").select("assunto, corpo").eq("usuario_id", usuarioId).eq("evento", evento).order("criado_em");
  return (data ?? []).map((d) => ({ assunto: String(d.assunto ?? ""), corpo: String(d.corpo ?? "") }));
}

/** O e-mail do evento cujo texto tem `trecho` (espera até 30 s). */
async function emailCom(usuarioId: string, evento: string, trecho: string): Promise<Email> {
  const achar = async () => (await caixa(usuarioId, evento)).filter((m) => m.corpo.includes(trecho));
  await expect.poll(async () => (await achar()).length, { timeout: 30_000, message: `${evento} com "${trecho}"` }).toBeGreaterThanOrEqual(1);
  return (await achar()).at(-1)!;
}

/** O mesmo e-mail no LAB_OUTBOX (HTML sem tags): é onde aparece o bloco de dados. */
async function saidaDo(quem: string, assunto: string): Promise<string> {
  const achar = async () => (await lerSaida()).filter((l) => l.servico === "email" && l.para === emails[quem] && l.assunto === assunto).map((l) => String(l.corpo ?? ""));
  await expect.poll(async () => (await achar()).length, { timeout: 30_000, message: `LAB_OUTBOX: "${assunto}" para ${quem}` }).toBeGreaterThanOrEqual(1);
  return (await achar()).at(-1)!;
}

/** A régua do E267 num e-mail: assunto exato com a marca, a abertura com o primeiro nome e o fato, e o bloco no HTML. */
async function regua(quem: string, m: Email, o: { assunto: string; abertura: string; bloco: string[]; semBloco?: string[] }) {
  expect(m.assunto, "assunto com o fato").toBe(`${o.assunto}${MARCA}`);
  expect(m.assunto.length, "o assunto cabe em 70 caracteres").toBeLessThanOrEqual(70);
  expect(m.corpo, "a abertura com o nome e o fato").toContain(o.abertura);
  const abertura = m.corpo.split("\n").find((l) => l.startsWith("Olá")) ?? "";
  expect(abertura, 'sem "comissão" nem "aluguel"').not.toMatch(/comiss[aã]o|aluguel/i);
  const html = await saidaDo(quem, m.assunto);
  for (const b of o.bloco) expect(html, `bloco de dados: ${b}`).toContain(b);
  for (const b of o.semBloco ?? []) expect(html, `fora do bloco: ${b}`).not.toContain(b);
}

async function abrir(browser: Browser, quem: string, caminho: string): Promise<Page> {
  const page = await entrar(browser, emails[quem], senha);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(caminho, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  return page;
}

async function ordem(page: Page, descricao: string) {
  const o = page.getByTestId("ordem-manutencao").filter({ hasText: descricao });
  await expect(o).toBeVisible({ timeout: 20_000 });
  await o.getByTestId("solicitacao-cartao").click();
  await expect(o.getByTestId("solicitacao-detalhe")).toBeVisible({ timeout: 20_000 });
  return o;
}

async function novaOrdem(campos: Record<string, unknown>): Promise<{ id: string; abertaEm: string }> {
  const { data, error } = await adm()
    .from("service_orders")
    .insert({ property_id: ids.imovel, tenant_id: ids.morador, owner_id: ids.dono, ...campos })
    .select("id, opened_at")
    .single();
  if (error) throw error;
  return { id: data.id as string, abertaEm: data.opened_at as string };
}

async function medicaoDoDono(imovel: string, o: { download: number; upload: number; medidoEm: string; validoAte: string }) {
  const { error } = await adm()
    .from("internet_medicoes")
    .insert({ property_id: imovel, user_id: ids.dono, papel: "dono", download_mbps: o.download, upload_mbps: o.upload, latencia_ms: 12, distancia_m: 40, validada: true, origem: "edicao", medido_em: o.medidoEm, valido_ate: o.validoAte });
  if (error) throw error;
}

test.describe("T749 — E267 residual: manutenção, pedido encerrado, foto pelo celular e internet com o imóvel e o fato", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    test.setTimeout(180_000);
    await conta("dono", "Dalva Residual", "owner");
    await conta("morador", "Ivo Residual", "tenant");
    await conta("pedinte", "Pia Residual", "tenant");
    await definirPlano(ids.dono, "pro");
    ids.imovel = await criarImovelPronto(ids.dono, T, { ativo: true });
    ids.net = await criarImovelPronto(ids.dono, NET, { ativo: true });
    await adm().from("properties").update({ lat: IMOVEL.lat, lng: IMOVEL.lng, lat_exata: IMOVEL.lat, lng_exata: IMOVEL.lng }).eq("id", ids.imovel); // consistency-ignore: massa do laboratório
    ids.lead = await criarLead(ids.dono, ids.morador, ids.imovel, true);
    const { data, error } = await adm()
      .from("contratos")
      .insert({ property_id: ids.imovel, tenant_id: ids.morador, lead_id: ids.lead, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1, status: "ativo", garantia: "caucao" })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    await tornarContratoVigente(ids.contrato, ids.dono, 3200);
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    const pessoas = ["dono", "morador", "pedinte"].map((k) => ids[k]).filter(Boolean);
    if (ids.imovel) {
      await adm().from("service_orders").delete().eq("property_id", ids.imovel);
      await adm().from("prova_links_celular").delete().eq("property_id", ids.imovel);
    }
    for (const im of [ids.imovel, ids.net].filter(Boolean)) await adm().from("internet_medicoes").delete().eq("property_id", im);
    if (ids.pedido) await adm().from("pedidos_moradia").delete().eq("id", ids.pedido);
    if (ids.contrato) {
      for (const t of ["pagamentos_bloco", "contrato_eventos", "contrato_blocos"]) await adm().from(t).delete().eq("contrato_id", ids.contrato);
      await adm().from("contratos").delete().eq("id", ids.contrato);
    }
    await adm().from("automacoes_envios").delete().in("usuario_id", pessoas);
    await adm().from("emails_teste").delete().in("usuario_id", pessoas);
    if (ids.dono) await adm().from("leads").delete().eq("owner_id", ids.dono);
    await apagarContas(pessoas);
  });

  test("M1/M2. o dono inicia o atendimento e o morador escreve: cada lado recebe o imóvel, a categoria e o fato", async ({ browser }) => {
    const desc = `Vazamento embaixo da pia (${sufixo}).`;
    const o = await novaOrdem({ category: "hidraulica", priority: "media", description: desc, status: "aberto", opened_at: new Date(Date.now() - 2 * H).toISOString() });
    const dono = await abrir(browser, "dono", "/dashboard/solicitacoes");
    await (await ordem(dono, desc)).getByRole("button", { name: "Iniciar atendimento" }).click();
    await expect(dono.getByTestId("ordem-manutencao").filter({ hasText: desc }).getByTestId("status-ordem")).toHaveText("Em atendimento", { timeout: 20_000 });
    await dono.context().close();

    // O nome da situação é cobrado à parte (L-81, caso M1-situação); aqui, o resto da frase e o bloco.
    const m1 = await emailCom(ids.morador, "manutencao_atualizada", `mudou a manutenção de hidráulica em ${T} para "`);
    await regua("morador", m1, {
      assunto: `Manutenção atualizada: ${T}`,
      abertura: `Olá Ivo, o proprietário mudou a manutenção de hidráulica em ${T} para "`,
      bloco: [`Imóvel ${porExtenso(T)}`, "Manutenção Hidráulica", `Aberta em ${quando(o.abertaEm)} (horário de Brasília)`, "Situação agora"],
    });
    expect(m1.corpo).toContain('". Veja o histórico pela plataforma.');

    const morador = await abrir(browser, "morador", "/dashboard/solicitacoes");
    const om = await ordem(morador, desc);
    await om.getByLabel("Sua mensagem").fill(MSG_MORADOR);
    await om.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(om.getByTestId("mensagens-ordem")).toContainText(MSG_MORADOR, { timeout: 20_000 });
    await morador.context().close();

    const m2 = await emailCom(ids.dono, "manutencao_mensagem", `escreveu na manutenção de hidráulica em ${T}`);
    await regua("dono", m2, {
      assunto: `Nova mensagem na manutenção: ${T}`,
      abertura: `Olá Dalva, o morador escreveu na manutenção de hidráulica em ${T}. Responda pela plataforma.`,
      bloco: [`Imóvel ${porExtenso(T)}`, "Manutenção Hidráulica", `Aberta em ${quando(o.abertaEm)} (horário de Brasília)`],
    });
    // O texto da mensagem não vai no e-mail (só o fato de que há mensagem).
    expect(m2.corpo).not.toContain(MSG_MORADOR);
  });

  test("M1-situação. L-81: o e-mail chama a situação pelo nome da tela (\"Em atendimento\")", async () => {
    // L-81: a tela (SO_STATUS_META, critério 4 do Daniel: Aberta → Em atendimento → Resolvida) mostra "Em atendimento";
    // o e-mail usa statusHumano() e diz "Em andamento" — o morador lê uma situação que não existe na tela.
    test.fail(true, 'L-81: e-mail da manutenção diz "Em andamento"; a tela diz "Em atendimento"');
    const m1 = await emailCom(ids.morador, "manutencao_atualizada", `mudou a manutenção de hidráulica em ${T} para "`);
    expect(m1.corpo).toContain(`para "Em atendimento".`);
    expect(await saidaDo("morador", m1.assunto)).toContain("Situação agora Em atendimento");
  });

  test("M3. urgente: o dono marca a solução provisória → o morador recebe a provisória da elétrica no imóvel", async ({ browser }) => {
    const desc = `Tomada da cozinha soltando faísca (${sufixo}).`;
    const aberta = Date.now() - 3 * H;
    const o = await novaOrdem({ category: "eletrica", priority: "urgente", description: desc, status: "em_andamento", opened_at: new Date(aberta).toISOString(), first_response_at: new Date(aberta + H).toISOString() });
    const dono = await abrir(browser, "dono", "/dashboard/solicitacoes");
    const od = await ordem(dono, desc);
    await od.getByTestId("ordem-provisoria").click();
    await expect(od.getByTestId("ordem-provisoria")).toHaveCount(0, { timeout: 20_000 });
    await dono.context().close();

    const m = await emailCom(ids.morador, "manutencao_atualizada", "marcou a solução provisória");
    await regua("morador", m, {
      assunto: `Solução provisória na manutenção: ${T}`,
      abertura: `Olá Ivo, o proprietário marcou a solução provisória na manutenção de elétrica em ${T}. O prazo da solução definitiva continua valendo.`,
      bloco: [`Imóvel ${porExtenso(T)}`, "Manutenção Elétrica", `Aberta em ${quando(o.abertaEm)} (horário de Brasília)`],
    });
  });

  test("M4. categoria 'outros': o morador confirma a solução → o dono recebe 'a manutenção em <T>', sem categoria", async ({ browser }) => {
    const desc = `Porta do armário desalinhada (${sufixo}).`;
    const aberta = Date.now() - 30 * H;
    const o = await novaOrdem({
      category: "outros",
      priority: "baixa",
      description: desc,
      status: "resolvido",
      opened_at: new Date(aberta).toISOString(),
      first_response_at: new Date(aberta + H).toISOString(),
      resolved_at: new Date(Date.now() - H).toISOString(),
      solucao_marcada_em: new Date(Date.now() - H).toISOString(),
    });
    const morador = await abrir(browser, "morador", "/dashboard/solicitacoes");
    const om = await ordem(morador, desc);
    await om.getByTestId("ordem-confirmar-solucao").click();
    await expect(om.getByTestId("ordem-confirmar-solucao")).toHaveCount(0, { timeout: 20_000 });
    await morador.context().close();

    const m = await emailCom(ids.dono, "manutencao_atualizada", "confirmou a solução");
    await regua("dono", m, {
      assunto: `Solução confirmada: ${T}`,
      abertura: `Olá Dalva, o morador confirmou a solução da manutenção em ${T}. A ordem está concluída.`,
      bloco: [`Imóvel ${porExtenso(T)}`, `Aberta em ${quando(o.abertaEm)} (horário de Brasília)`],
      semBloco: ["Manutenção Outros"],
    });
  });

  test("P. o morador exclui o pedido de moradia → o dono que respondeu recebe a cidade e o imóvel da resposta", async ({ browser }) => {
    const entrada = new Date(Date.now() + 20 * DIA).toISOString().slice(0, 10);
    const { data: ped, error } = await adm()
      .from("pedidos_moradia")
      .insert({ inquilino_id: ids.pedinte, cidade: "Uberlândia", uf: "MG", data_inicio: entrada, prazo_meses: 3, orcamento_mensal: 3600, qtd_ocupantes: 1, motivo: "trabalho_remoto", bairros: ["Centro"], quartos_min: 1 })
      .select("id")
      .single();
    if (error) throw error;
    ids.pedido = ped.id as string;
    const { error: er } = await adm().from("respostas_pedido").insert({ pedido_id: ids.pedido, proprietario_id: ids.dono, imovel_id: ids.imovel, status: "enviada" });
    if (er) throw er;

    const page = await abrir(browser, "pedinte", "/dashboard/pedidos");
    const meu = page.locator(`[data-testid="meu-pedido"][data-pedido="${ids.pedido}"]`);
    await meu.getByTestId("pedido-excluir").click();
    await meu.getByTestId("pedido-excluir-confirmar").click();
    await expect.poll(async () => (await adm().from("pedidos_moradia").select("status").eq("id", ids.pedido).single()).data?.status, { timeout: 20_000 }).toBe("excluido");
    await page.context().close();

    const m = await emailCom(ids.dono, "pedido_encerrado", `que você respondeu com ${T}`);
    await regua("dono", m, {
      assunto: "Pedido de moradia em Uberlândia encerrado",
      abertura: `Olá Dalva, o morador encerrou o pedido de moradia em Uberlândia que você respondeu com ${T}. Ele não aparece mais na sua lista.`,
      bloco: ["Pedido em Uberlândia", `Você respondeu com ${porExtenso(T)}`],
    });
  });

  test("N. 'Fotografar pelo celular' → o e-mail diz o item, o imóvel e até quando o link vale", async ({ browser }) => {
    const item = "sono_dois_jogos";
    const pc = await abrir(browser, "dono", `/dashboard/imoveis/${ids.imovel}/nivel`);
    await expect(pc.getByTestId("nivel-itens")).toBeVisible({ timeout: 30_000 });
    const botao = pc.getByTestId(`nivel-foto-${item}-botao`);
    await expect(botao).toHaveText("Fotografar pelo celular");
    await botao.click();
    await expect(pc.getByTestId(`prova-celular-${item}`).getByTestId("prova-celular-email")).toBeVisible({ timeout: 20_000 });
    await pc.context().close();

    const { data: cap } = await adm().from("prova_links_celular").select("expira_em").eq("property_id", ids.imovel).eq("chave", item).order("expira_em", { ascending: false }).limit(1).single();
    const ate = quando(cap!.expira_em as string);
    const m = await emailCom(ids.dono, "nivel_prova_celular", "2 jogos de roupa de cama");
    await regua("dono", m, {
      assunto: `Fotografe pelo celular o item de ${T}`,
      abertura: `Olá Dalva, abra este e-mail no celular e toque no botão para fotografar "2 jogos de roupa de cama" de ${T} na hora, pela câmera. O link vale por 30 minutos e uma vez só.`,
      bloco: [`Imóvel ${porExtenso(T)}`, "Item 2 jogos de roupa de cama", `O link vale até ${ate} (horário de Brasília)`],
    });
  });

  test("I1. o morador mede na entrada abaixo da metade → o dono recebe o imóvel e os dois números", async ({ browser }) => {
    await medicaoDoDono(ids.imovel, { download: 800, upload: 200, medidoEm: new Date(Date.now() - DIA).toISOString(), validoAte: new Date(Date.now() + 170 * DIA).toISOString() });
    const page = await abrir(browser, "morador", "/dashboard");
    const r = await page.evaluate(
      async ({ imovel, local }) => {
        const res = await fetch("/api/internet/medicoes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ imovel, origem: "conferencia_entrada", rodadas: [{ downloadMbps: 38.4, uploadMbps: 9.6, latenciaMs: 20 }, { downloadMbps: 38.4, uploadMbps: 9.6, latenciaMs: 20 }], local, confirmouWifi: true }),
        });
        return { status: res.status, corpo: await res.json() };
      },
      { imovel: ids.imovel, local: PERTO }
    );
    await page.context().close();
    expect(r.status, JSON.stringify(r.corpo)).toBe(200);
    expect(r.corpo.validada, JSON.stringify(r.corpo)).toBe(true);

    const m = await emailCom(ids.dono, "internet_abaixo_medida", `o morador mediu a internet de ${T}`);
    expect(m.corpo).toContain(`Olá Dalva, o morador mediu a internet de ${T} na entrada: 38 Mbps de download e 10 Mbps de upload, abaixo da metade da sua última medição (800 Mbps e 200 Mbps). Vale conferir o roteador ou a operadora e medir de novo.`);
    expect(m.assunto.length).toBeLessThanOrEqual(70);
    const html = await saidaDo("dono", m.assunto);
    for (const b of [`Imóvel ${porExtenso(T)}`, "Medida do morador 38 Mbps de download e 10 Mbps de upload", "Sua última medição 800 Mbps e 200 Mbps (download e upload)"]) expect(html, `bloco de dados: ${b}`).toContain(b);
  });

  test("I1-assunto. L-80: o assunto do internet_abaixo_medida leva o imóvel", async () => {
    // L-80: "A internet medida pelo morador ficou abaixo em " tem 47 caracteres; com a marca sobram 8 para o título e
    // assuntoComTitulo exige 10 — o assunto com o imóvel é inalcançável e sai sempre o do modelo.
    test.fail(true, "L-80: assunto do internet_abaixo_medida sem o imóvel (prefixo longo demais para a régua)");
    const m = await emailCom(ids.dono, "internet_abaixo_medida", `o morador mediu a internet de ${T}`);
    expect(m.assunto).toContain(T);
  });

  test("I2. cron de automações (2º servidor): a medição do dono perto de vencer → internet_remedir com o dia, uma vez só", async () => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    // Vence daqui a 10 dias, ao meio-dia UTC (o dia do e-mail sai da data ISO).
    const vence = new Date(Date.now() + 10 * DIA);
    vence.setUTCHours(15, 0, 0, 0);
    await medicaoDoDono(ids.net, { download: 300, upload: 90, medidoEm: new Date(Date.now() - 170 * DIA).toISOString(), validoAte: vence.toISOString() });

    const log = createWriteStream(`${SAIDA}/t749-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, AUTOMACOES_ATIVO: "1", PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/automacoes`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);
    for (let i = 0; i < 2; i++) {
      const r = await fetch(`http://localhost:${PORTA}/api/cron/automacoes`, { headers: { authorization: `Bearer ${SEGREDO}` } });
      const corpo = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      expect(r.status, JSON.stringify(corpo)).toBe(200);
    }

    const venceIso = vence.toISOString();
    const m = await emailCom(ids.dono, "internet_remedir", NET);
    await regua("dono", m, {
      assunto: `Meça de novo a internet de ${NET} até ${venceIso.slice(8, 10)}/${venceIso.slice(5, 7)}`,
      abertura: `Olá Dalva, a medição da internet de ${NET} vence em ${diaIso(venceIso)}. Meça de novo, conectado ao Wi-Fi do imóvel, para o anúncio continuar mostrando o número.`,
      bloco: [`Imóvel ${porExtenso(NET)}`, `A medição vale até ${diaIso(venceIso)}`],
    });
    expect((await caixa(ids.dono, "internet_remedir")).filter((e) => e.corpo.includes(NET)), "rodar de novo não repete").toHaveLength(1);
  });
});
