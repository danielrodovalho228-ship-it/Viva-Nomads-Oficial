import { test, expect, type Browser, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, criarImovelPronto, criarLead, entrar, lerSaida, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T728 — E289 (#1639): os e-mails do cron de automações e os da avaliação de imóvel saem com os FATOS do caso no
  assunto, no corpo e no bloco de dados: a pessoa ("Olá <primeiro nome>"), o imóvel (título · bairro, cidade) e o fato
  (a data da saída com o horário do imóvel, o fim do período, o número e o prazo da proposta, a data da entrada, a data
  e a hora da visita, o avaliador). Espelha com dados descartáveis os 5 e-mails que a massa 0268 prova em produção
  (docs/qa-prova-e289-cron.md):
    S. contrato com saída em D+3                         → saida_lembrete (dono e moradora), "(até as 11:00)";
    A. contrato que terminou em D-1                       → avaliacao_pedido (dono e morador), "terminou em …";
    I. contrato com entrada em D+10, sem instruções       → estadia_instrucoes_pendentes (só o dono), com o dia em que
                                                            o morador recebe as instruções (D+3) e "a partir das 14:00";
    R. bloco terminando em D+15                           → renovacao_aviso (dono e moradora), o fim do período;
    P. proposta da moradora vencendo em 12 h              → proposta_vencendo (só o dono), com o número ORC-… no corpo
                                                            (nunca no assunto) e o prazo "(horário de Brasília)".
  O cron roda num 2º servidor do mesmo build (porta 3175, CRON_SECRET só dele e AUTOMACOES_ATIVO=1, como a t712 F);
  rodar de novo não repete nenhum. Avaliação de imóvel (V), pela tela de verdade no servidor do laboratório: o
  avaliador aceita a designação → o dono recebe "O avaliador de <título> foi designado" com o nome público do
  avaliador; o avaliador agenda a visita → dono e avaliador recebem "Visita de avaliação: <título>, DD/MM às 10:00".
  O pedido e a designação são semeados direto (a cidade do credenciamento é só deste spec: o rodízio dos outros
  specs de avaliação não o enxerga), então o cron de vistoria não é chamado aqui (ele mexe nos pedidos de todos).
  Leitura: o texto puro de cada e-mail em emails_teste (contas is_teste) — assunto, saudação, a frase com o fato e a
  linha de detalhe — e o bloco de dados (só no HTML) no LAB_OUTBOX, via lerSaida(). O endereço exato (exact_address)
  nunca aparece; a frase de abertura não fala em "comissão" nem "aluguel".
*/
const SAIDA = "tests/laboratorio/saida";
const PORTA = 3175;
const SEGREDO = `lab-t728-${Math.random().toString(36).slice(2)}`;
const MARCA = " · Viva Nomads";
const senha = novaSenha();
const sufixo = novoSufixo();
const RUA = "Rua das Paineiras, 289";
const CIDADE_AVALIADOR = "Araguari";
const ids: Record<string, string> = {};
const emails: Record<string, string> = {};
const contratos: string[] = [];
let servidor: ChildProcess | null = null;
let cronRodou = false;

const hojeBRT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const emDias = (n: number) => new Date(Date.parse(hojeBRT()) + n * 86_400_000).toISOString().slice(0, 10);
const dataBR = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const diaMes = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
/** Título curto: cabe inteiro no assunto (a régua encolhe o título só quando o assunto passaria de 70 caracteres). */
const tituloDe = (letra: string) => `Lar E289 ${letra} ${sufixo}`;
const imovelPorExtenso = (letra: string) => `${tituloDe(letra)} · Centro, Uberlândia`;
const NOME_AVALIADOR = `Vera Vistorias ${sufixo}`;

/** Data e hora no horário de Brasília, como src/lib/datas-brasilia.ts e src/lib/notifications/assuntos.ts montam. */
function brt(iso: string): { dia: string; diaMes: string; hora: string } {
  const p = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const v = (k: string) => p.find((x) => x.type === k)?.value ?? "";
  return { dia: `${v("day")}/${v("month")}/${v("year")}`, diaMes: `${v("day")}/${v("month")}`, hora: `${v("hour")}:${v("minute")}` };
}

async function conta(quem: string, nome: string, role: "owner" | "tenant") {
  emails[quem] = `${quem}.t728.${sufixo}@lab.vivanomads.test`;
  const id = await criarConta({ email: emails[quem], nome, role }, senha);
  await adm().from("profiles").update({ is_teste: true }).eq("id", id);
  ids[quem] = id;
  return id;
}

async function imovel(letra: string): Promise<string> {
  const id = await criarImovelPronto(ids.dono, tituloDe(letra), { ativo: true, preco: 3200 });
  await adm().from("properties").update({ exact_address: RUA, checkout_before: "11:00", checkin_after: "14:00" }).eq("id", id); // consistency-ignore: massa do laboratório
  ids[`imovel${letra}`] = id;
  return id;
}

/** Contrato assinado pelas duas partes, com um bloco de `inicio` a `fim` (status do bloco como a 0268 grava). */
async function contrato(letra: string, inquilino: string, inicio: string, fim: string, statusBloco: "ativo" | "encerrado" | "agendado"): Promise<string> {
  const im = await imovel(letra);
  const lead = await criarLead(ids.dono, inquilino, im, true);
  ids[`lead${letra}`] = lead;
  const agora = new Date().toISOString();
  const dias = Math.round((Date.parse(fim) - Date.parse(inicio)) / 86_400_000) + 1;
  const { data: c, error } = await adm()
    .from("contratos")
    .insert({ property_id: im, tenant_id: inquilino, lead_id: lead, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: dias, aluguel_mensal: 3200, tamanho_bloco_meses: 1, comissao_percent: 0.08, comissao_valor: 256, qtd_ocupantes: 1, capacidade_snapshot: 3, status: "ativo", garantia: "caucao", assinado_proprietario_em: agora, assinado_inquilino_em: agora })
    .select("id")
    .single();
  if (error) throw error;
  contratos.push(c.id as string);
  const { error: eb } = await adm().from("contrato_blocos").insert({ contrato_id: c.id, numero_bloco: 1, inicio, fim, meses: 1, valor: 3200, caucao: 3200, status: statusBloco, aceite_proprietario_em: agora, aceite_inquilino_em: agora });
  if (eb) throw eb;
  return c.id as string;
}

type Email = { assunto: string; corpo: string };

async function caixa(usuarioId: string, evento: string): Promise<Email[]> {
  const { data } = await adm().from("emails_teste").select("assunto, corpo").eq("usuario_id", usuarioId).eq("evento", evento).order("criado_em");
  return (data ?? []).map((d) => ({ assunto: String(d.assunto ?? ""), corpo: String(d.corpo ?? "") }));
}

const doImovel = async (usuarioId: string, evento: string, letra: string) => (await caixa(usuarioId, evento)).filter((m) => m.corpo.includes(tituloDe(letra)));

/** O e-mail do evento que fala do imóvel `letra` (espera até 30 s). */
async function emailDo(usuarioId: string, evento: string, letra: string): Promise<Email> {
  await expect.poll(async () => (await doImovel(usuarioId, evento, letra)).length, { timeout: 30_000, message: `${evento} sobre ${tituloDe(letra)}` }).toBeGreaterThanOrEqual(1);
  return (await doImovel(usuarioId, evento, letra)).at(-1)!;
}

/** O mesmo e-mail no LAB_OUTBOX (HTML sem tags): é onde aparece o bloco de dados. */
async function saidaDo(quem: string, assunto: string): Promise<string> {
  const achar = async () => (await lerSaida()).filter((l) => l.servico === "email" && l.para === emails[quem] && l.assunto === assunto).map((l) => String(l.corpo ?? ""));
  await expect.poll(async () => (await achar()).length, { timeout: 30_000, message: `LAB_OUTBOX: "${assunto}" para ${quem}` }).toBeGreaterThanOrEqual(1);
  return (await achar()).at(-1)!;
}

/**
 * A régua do E289 num e-mail: assunto exato (com a marca), o título no topo do texto, a abertura com o nome e o fato,
 * a linha de detalhe e, no HTML, o bloco "Imóvel · <fato>". Nunca o endereço exato.
 */
async function regua(quem: string, m: Email, o: { assunto: string; abertura: string; detalhe?: string; bloco: string[] }) {
  expect(m.assunto, "assunto com o fato e o imóvel").toBe(`${o.assunto}${MARCA}`);
  expect(m.assunto.length, "o assunto cabe em 70 caracteres").toBeLessThanOrEqual(70);
  // O texto guardado começa com o cabeçalho da caixa de QA ("Remetente: …"); o título do e-mail vem logo depois.
  expect(m.corpo.split("\n").map((l) => l.trim()), "o título do e-mail é o assunto").toContain(o.assunto);
  expect(m.corpo, "a abertura com o nome e o fato").toContain(o.abertura);
  if (o.detalhe) expect(m.corpo, "a linha de detalhe").toContain(o.detalhe);
  expect(m.corpo, "sem o endereço exato").not.toContain(RUA);
  const abertura = m.corpo.split("\n").find((l) => l.startsWith("Olá")) ?? "";
  expect(abertura, 'sem "comissão" nem "aluguel"').not.toMatch(/comiss[aã]o|aluguel/i);
  const html = await saidaDo(quem, m.assunto);
  for (const b of o.bloco) expect(html, `bloco de dados: ${b}`).toContain(b);
  expect(html, "sem o endereço exato (HTML)").not.toContain(RUA);
}

async function rodarCron() {
  const r = await fetch(`http://localhost:${PORTA}/api/cron/automacoes`, { headers: { authorization: `Bearer ${SEGREDO}` } });
  const corpo = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  expect(r.status, JSON.stringify(corpo)).toBe(200);
  expect(corpo.simulado).toBe(false);
}

async function abrir(browser: Browser, quem: string, caminho: string): Promise<Page> {
  const page = await entrar(browser, emails[quem], senha);
  await page.setViewportSize({ width: 1280, height: 900 });
  page.on("dialog", (d) => {
    throw new Error(`diálogo do navegador não permitido: ${d.type()} ${d.message()}`);
  });
  await page.goto(caminho, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  return page;
}

test.describe("T728 — E289: e-mails do cron de automações e da avaliação de imóvel com os fatos do caso", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    await conta("dono", "Dora Automação", "owner");
    for (const [k, nome] of [["bia", "Bia Automação"], ["caio", "Caio Automação"], ["duda", "Duda Automação"], ["eva", "Eva Automação"], ["vera", "Vera Avaliadora"]] as const) await conta(k, nome, "tenant");
    ids.S = await contrato("S", ids.bia, emDias(-27), emDias(3), "ativo");
    ids.A = await contrato("A", ids.caio, emDias(-31), emDias(-1), "encerrado");
    ids.I = await contrato("I", ids.eva, emDias(10), emDias(40), "agendado");
    ids.R = await contrato("R", ids.duda, emDias(-14), emDias(15), "ativo");

    // P: a proposta da Duda no imóvel R (a última versão é dela: a vez é da dona), vencendo daqui a 12 h.
    const { data: numero } = await adm().rpc("next_document_number", { p_type: "orcamento", p_year: new Date().getFullYear() });
    const vence = new Date(Math.floor((Date.now() + 12 * 3_600_000) / 60_000) * 60_000).toISOString();
    const { data: p, error: ep } = await adm()
      .from("propostas")
      .insert({ numero, lead_id: ids.leadR, property_id: ids.imovelR, owner_id: ids.dono, tenant_id: ids.duda, status: "enviada", versao_atual: 1, validade_dias: 3, valida_ate: vence })
      .select("id, numero, valida_ate")
      .single();
    if (ep) throw ep;
    ids.proposta = p.id as string;
    ids.numero = p.numero as string;
    ids.venceEm = p.valida_ate as string;
    const { error: ev } = await adm().from("proposta_versoes").insert({ proposta_id: p.id, versao: 1, autor: "tenant", valor_base: 3200, valor_mensal: 3200, meses: 2, data_entrada: emDias(20), total_mensal: 3200, total_contrato: 6400 });
    if (ev) throw ev;

    // V: a avaliadora credenciada (cidade só deste spec), o pedido do imóvel V já designado a ela, sem resposta.
    const { data: parc, error: epa } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.vera, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: NOME_AVALIADOR, slug: `vera-t728-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE_AVALIADOR] })
      .select("id")
      .single();
    if (epa) throw epa;
    ids.parceiro = parc.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: cred, error: ec } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: ids.parceiro, cidade: CIDADE_AVALIADOR, numero_credenciado: n, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t728", conduta_versao: "2026-10-23", ativado_em: new Date().toISOString(), ultima_designacao_em: new Date().toISOString() })
      .select("id")
      .single();
    if (ec) throw ec;
    ids.cred = cred.id as string;
    await imovel("V");
    const agora = new Date().toISOString();
    const { data: ped, error: epd } = await adm()
      .from("vistoria_pedidos")
      .insert({ property_id: ids.imovelV, owner_id: ids.dono, cidade: CIDADE_AVALIADOR, tipo: "inicial", porte: "q1_2", valor_tabela: 350, status: "designado", avaliador_id: ids.cred, designado_em: agora, ocupado: false })
      .select("id")
      .single();
    if (epd) throw epd;
    ids.pedido = ped.id as string;
    const { error: ed } = await adm().from("vistoria_designacoes").insert({ pedido_id: ids.pedido, avaliador_id: ids.cred, designado_em: agora });
    if (ed) throw ed;
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    if (ids.pedido) await adm().from("vistoria_pedidos").delete().eq("id", ids.pedido);
    if (ids.cred) {
      await adm().from("vistoria_designacoes").delete().eq("avaliador_id", ids.cred);
      await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    }
    if (ids.parceiro) await adm().from("parceiros").delete().eq("id", ids.parceiro);
    if (ids.proposta) {
      await adm().from("proposta_versoes").delete().eq("proposta_id", ids.proposta);
      await adm().from("propostas").delete().eq("id", ids.proposta);
    }
    if (contratos.length) {
      for (const t of ["pagamentos_bloco", "contrato_eventos", "contrato_blocos"]) await adm().from(t).delete().in("contrato_id", contratos);
      await adm().from("contratos").delete().in("id", contratos);
    }
    const pessoas = ["dono", "bia", "caio", "duda", "eva", "vera"].map((k) => ids[k]).filter(Boolean);
    await adm().from("automacoes_envios").delete().in("usuario_id", pessoas);
    await adm().from("emails_teste").delete().in("usuario_id", pessoas);
    if (ids.dono) await adm().from("leads").delete().eq("owner_id", ids.dono);
    await apagarContas(pessoas);
  });

  test("cron: o 2º servidor (AUTOMACOES_ATIVO=1) roda as automações de verdade", async () => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    const log = createWriteStream(`${SAIDA}/t728-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, AUTOMACOES_ATIVO: "1", PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/automacoes`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);
    await rodarCron();
    cronRodou = true;
  });

  test("S: saida_lembrete — a data da saída com o ano e o horário do imóvel, para a dona e a moradora", async () => {
    test.skip(!cronRodou, "O cron não rodou (sem build).");
    const saida = emDias(3);
    const assunto = `Saída de ${tituloDe("S")} em ${diaMes(saida)}`;
    for (const [quem, nome] of [["dono", "Dora"], ["bia", "Bia"]] as const) {
      const m = await emailDo(ids[quem], "saida_lembrete", "S");
      await regua(quem, m, {
        assunto,
        abertura: `Olá ${nome}, a saída de ${tituloDe("S")} é em ${dataBR(saida)} (até as 11:00). Combine a conferência de saída pela plataforma.`,
        detalhe: `Imóvel: ${imovelPorExtenso("S")}. Saída em ${dataBR(saida)}.`,
        bloco: [`Imóvel ${imovelPorExtenso("S")}`, `Saída ${dataBR(saida)}, até as 11:00`],
      });
    }
  });

  test("A: avaliacao_pedido — a estadia terminou ontem, com o imóvel, para a dona e o morador", async () => {
    test.skip(!cronRodou, "O cron não rodou (sem build).");
    const fim = emDias(-1);
    for (const [quem, nome] of [["dono", "Dora"], ["caio", "Caio"]] as const) {
      const m = await emailDo(ids[quem], "avaliacao_pedido", "A");
      await regua(quem, m, {
        assunto: `Como foi a estadia em ${tituloDe("A")}?`,
        abertura: `Olá ${nome}, a estadia em ${tituloDe("A")} terminou em ${dataBR(fim)}. Sua avaliação leva 2 minutos e ajuda os próximos moradores e proprietários.`,
        detalhe: `Imóvel: ${imovelPorExtenso("A")}. A estadia terminou em ${dataBR(fim)}.`,
        bloco: [`Imóvel ${imovelPorExtenso("A")}`, `Saída ${dataBR(fim)}`],
      });
    }
  });

  test("I: estadia_instrucoes_pendentes — a entrada em D+10 e o dia em que o morador recebe as instruções, só para a dona", async () => {
    test.skip(!cronRodou, "O cron não rodou (sem build).");
    const entrada = emDias(10);
    const libera = emDias(3);
    const m = await emailDo(ids.dono, "estadia_instrucoes_pendentes", "I");
    await regua("dono", m, {
      assunto: `Instruções de chegada: ${tituloDe("I")}, entrada ${diaMes(entrada)}`,
      abertura: `Olá Dora, a entrada do morador em ${tituloDe("I")} é em ${dataBR(entrada)}. Preencha as instruções de chegada: o morador as recebe em ${dataBR(libera)}.`,
      detalhe: `Imóvel: ${imovelPorExtenso("I")}. Entrada do morador em ${dataBR(entrada)}.`,
      bloco: [`Imóvel ${imovelPorExtenso("I")}`, `Entrada do morador ${dataBR(entrada)}, a partir das 14:00`, `O morador recebe as instruções em ${dataBR(libera)}`],
    });
    expect(await caixa(ids.eva, "estadia_instrucoes_pendentes"), "o morador não recebe o lembrete do dono").toHaveLength(0);
  });

  test("R: renovacao_aviso — o fim do período com o ano, para a dona e a moradora", async () => {
    test.skip(!cronRodou, "O cron não rodou (sem build).");
    const fim = emDias(15);
    for (const [quem, nome] of [["dono", "Dora"], ["duda", "Duda"]] as const) {
      const m = await emailDo(ids[quem], "renovacao_aviso", "R");
      await regua(quem, m, {
        assunto: `Renovar ${tituloDe("R")}? O período termina em ${diaMes(fim)}`,
        abertura: `Olá ${nome}, o período atual do contrato de ${tituloDe("R")} termina em ${dataBR(fim)}. Se quiserem seguir, combinem a renovação pela plataforma: o aditivo de prorrogação já vem preenchido.`,
        detalhe: `Imóvel: ${imovelPorExtenso("R")}. O bloco termina em ${dataBR(fim)}.`,
        bloco: [`Imóvel ${imovelPorExtenso("R")}`, `Fim do período ${dataBR(fim)}`],
      });
    }
  });

  test("P: proposta_vencendo — o número e o prazo no corpo (o número nunca no assunto), só para quem responde", async () => {
    test.skip(!cronRodou, "O cron não rodou (sem build).");
    const v = brt(ids.venceEm);
    const m = await emailDo(ids.dono, "proposta_vencendo", "R");
    await regua("dono", m, {
      assunto: `Proposta de ${tituloDe("R")} vence em ${v.diaMes} às ${v.hora}`,
      abertura: `Olá Dora, a proposta ${ids.numero} de ${tituloDe("R")} aguarda a sua resposta e vence em ${v.dia} ${v.hora} (horário de Brasília). Aceite, contraproponha ou recuse pela plataforma.`,
      detalhe: `Imóvel: ${tituloDe("R")}. A proposta ${ids.numero} vence em menos de 24 horas.`,
      bloco: [`Imóvel ${imovelPorExtenso("R")}`, `Proposta ${ids.numero}`, `Vence em ${v.dia} ${v.hora} (horário de Brasília)`],
    });
    expect(m.assunto, "o número da proposta fica fora do assunto").not.toContain(ids.numero);
    expect(await caixa(ids.duda, "proposta_vencendo"), "quem mandou a última versão não é avisado").toHaveLength(0);
  });

  test("2ª rodada do cron: nenhum dos 8 e-mails se repete", async () => {
    test.skip(!cronRodou, "O cron não rodou (sem build).");
    await rodarCron();
    await new Promise((r) => setTimeout(r, 3_000));
    const esperado: [string, string, string][] = [
      ["dono", "saida_lembrete", "S"],
      ["bia", "saida_lembrete", "S"],
      ["dono", "avaliacao_pedido", "A"],
      ["caio", "avaliacao_pedido", "A"],
      ["dono", "estadia_instrucoes_pendentes", "I"],
      ["dono", "renovacao_aviso", "R"],
      ["duda", "renovacao_aviso", "R"],
      ["dono", "proposta_vencendo", "R"],
    ];
    for (const [quem, evento, letra] of esperado) expect(await doImovel(ids[quem], evento, letra), `${evento} para ${quem}`).toHaveLength(1);
    const { data: bloco } = await adm().from("contrato_blocos").select("renovacao_notificada_em").eq("contrato_id", ids.R).single();
    expect(bloco?.renovacao_notificada_em, "o bloco fica marcado depois do aviso de renovação").not.toBeNull();
  });

  test("V: avaliação de imóvel — designação aceita (o avaliador nomeado) e visita agendada (a data e a hora)", async ({ browser }) => {
    const p = await abrir(browser, "vera", "/dashboard/parceiro/avaliacao");
    const item = p.locator(`[data-testid="avaliacao-designada"][data-pedido="${ids.pedido}"]`);
    await item.getByTestId("designacao-aceitar").click();
    await expect(item.getByTestId("agendar-visita")).toBeVisible({ timeout: 20_000 });

    const designado = await emailDo(ids.dono, "vistoria_designado_dono", "V");
    await regua("dono", designado, {
      assunto: `O avaliador de ${tituloDe("V")} foi designado`,
      abertura: `Olá Dora, a Viva designou ${NOME_AVALIADOR}, avaliador credenciado, para a avaliação de ${tituloDe("V")}. Combine a data da visita pelas mensagens da Viva.`,
      bloco: [`Imóvel ${imovelPorExtenso("V")}`, `Avaliador ${NOME_AVALIADOR}`],
    });

    // Daqui a 2 dias às 10:00 de Brasília (o campo datetime-local é lido como horário de Brasília).
    const dia = emDias(2);
    await item.getByTestId("agendar-visita").getByLabel("Data e hora da visita").fill(`${dia}T10:00`);
    await item.getByTestId("agendar-visita").getByRole("button", { name: "Agendar" }).click();
    await expect.poll(async () => (await adm().from("vistoria_pedidos").select("status").eq("id", ids.pedido).single()).data?.status, { timeout: 20_000 }).toBe("agendado");
    await p.context().close();

    const visita = `${dataBR(dia)} às 10:00`;
    for (const [quem, nome] of [["dono", "Dora"], ["vera", "Vera"]] as const) {
      const m = await emailDo(ids[quem], "vistoria_agendada", "V");
      await regua(quem, m, {
        assunto: `Visita de avaliação: ${tituloDe("V")}, ${diaMes(dia)} às 10:00`,
        abertura: `Olá ${nome}, a visita de avaliação de ${tituloDe("V")} está agendada para ${visita} (horário de Brasília). Reagendar sem custo: uma vez, com pelo menos 24 horas de aviso.`,
        bloco: [`Imóvel ${imovelPorExtenso("V")}`, `Visita ${visita} (horário de Brasília)`],
      });
    }
  });
});
