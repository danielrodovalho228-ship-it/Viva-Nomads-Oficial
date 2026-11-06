import { test, expect, type Browser, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, criarImovelPronto, criarLead, entrar, lerSaida, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T712 — E267 (#1600): os transacionais de ESTADIA e de SERVIÇO nomeiam no corpo a pessoa ("Olá <primeiro nome>"), o
  imóvel (título · bairro, cidade) e o fato. A t597 já cobre o aditivo aceito/assinado/remarcado e o circuito da
  limpeza automática; aqui, os que ficaram sem prova E2E, disparados pela tela de verdade (ou pelo cron, no F):
    A. aditivo RECUSADO: a moradora propõe (+1 mês) → a dona recebe "Bia propôs…" com o que muda e o prazo; a dona
       recusa → a moradora recebe "Dora recusou a sua proposta… Nada muda" com "Resposta: Recusada por Dora".
    B. convite de quem vai morar junto → o convidado (sem conta) recebe "Caio incluiu você como morador da estadia em
       <título · bairro, cidade>" — sem valor e sem o endereço exato (lido no LAB_OUTBOX: não há conta de teste).
    C. pedido de encerramento → a dona recebe "Caio pediu o encerramento do contrato de <título> (motivo: …)", com
       "Pedido por" e "Motivo".
    D. serviço de parceiro: o parceiro inicia e marca a entrega → a cliente recebe "<parceiro> marcou o serviço de
       limpeza completa em <título> como entregue" com serviço, imóvel, data, valor e código; a cliente conclui → as
       duas partes recebem "o serviço … com <a outra parte> foi concluído".
    E. o parceiro recusa um pedido com motivo → a cliente recebe o nome do parceiro, o motivo e o bloco do pedido.
    F. cron da estadia (2º servidor do mesmo build, porta 3172, CRON_SECRET só dele e AUTOMACOES_ATIVO=1, como a t597):
       saída em 4 dias sem limpeza fixa → a dona recebe "o morador sai de <título> em <data>"; a moradora recebe a
       sugestão de parceiros para a saída com a data; a moradora com entrada em 5 dias recebe a da entrada. Uma vez só.
  Contas do laboratório marcadas como de teste: os e-mails caem em emails_teste (o texto do e-mail), lido aqui. O
  endereço exato do imóvel (exact_address) nunca aparece no corpo.
*/
const SAIDA = "tests/laboratorio/saida";
const PORTA = 3172;
const SEGREDO = `lab-t712-${Math.random().toString(36).slice(2)}`;
const senha = novaSenha();
const sufixo = novoSufixo();
const RUA = "Rua dos Ipês, 702";
const ids: Record<string, string> = {};
const emails: Record<string, string> = {};
const contratos: string[] = [];
const convidado = `conv.t712.${sufixo}@lab.vivanomads.test`;
const PARCEIRO = `Lara Limpa ${sufixo}`;
let servidor: ChildProcess | null = null;

const hojeBRT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const emDias = (n: number) => new Date(Date.parse(hojeBRT()) + n * 86_400_000).toISOString().slice(0, 10);
const somar = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);
const dataBR = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const tituloDe = (letra: string) => `Studio E267 ${letra} t712 ${sufixo}`;
const imovelPorExtenso = (letra: string) => `${tituloDe(letra)} · Centro, Uberlândia`;
/** "05/12/2026 às 10:00" no horário de Brasília (a mesma montagem de quando(), src/lib/parceiros/email-pedido.ts). */
function quando(iso: string): string {
  const p = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const v = (k: string) => p.find((x) => x.type === k)?.value ?? "";
  return `${v("day")}/${v("month")}/${v("year")} às ${v("hour")}:${v("minute")}`;
}

/** A régua do E267: a pessoa, o imóvel por extenso e o fato; nunca o endereço exato nem "a outra parte". */
function regua(corpo: string, nome: string, letra: string, fatos: (string | RegExp)[]) {
  expect(corpo, "saudação com o nome").toContain(`Olá ${nome},`);
  expect(corpo, "o imóvel por extenso").toContain(imovelPorExtenso(letra));
  for (const f of fatos) {
    if (typeof f === "string") expect(corpo).toContain(f);
    else expect(corpo).toMatch(f);
  }
  expect(corpo, "sem o endereço exato").not.toContain(RUA);
  expect(corpo, 'sem "a outra parte"').not.toContain("a outra parte");
}

async function conta(quem: string, nome: string, role: "owner" | "tenant") {
  emails[quem] = `${quem}.t712.${sufixo}@lab.vivanomads.test`;
  const id = await criarConta({ email: emails[quem], nome, role }, senha);
  await adm().from("profiles").update({ is_teste: true }).eq("id", id);
  return id;
}

async function imovel(letra: string): Promise<string> {
  const id = await criarImovelPronto(ids.dono, tituloDe(letra), { ativo: true, preco: 3200 });
  await adm().from("properties").update({ exact_address: RUA, checkout_before: "11:00", checkin_after: "14:00" }).eq("id", id); // consistency-ignore: massa do laboratório
  ids[`imovel${letra}`] = id;
  return id;
}

/** Contrato ativo, assinado pelas duas partes, com um bloco de 2 meses de `inicio` a `inicio + 59`, já pago. */
async function contrato(letra: string, inquilino: string, inicio: string, ocupantes = 1): Promise<string> {
  const im = await imovel(letra);
  const lead = await criarLead(ids.dono, inquilino, im, true);
  const agora = new Date().toISOString();
  const { data: c, error } = await adm()
    .from("contratos")
    .insert({ property_id: im, tenant_id: inquilino, lead_id: lead, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: ocupantes, capacidade_snapshot: 3, status: "ativo", garantia: "caucao", assinado_proprietario_em: agora, assinado_inquilino_em: agora })
    .select("id")
    .single();
  if (error) throw error;
  contratos.push(c.id);
  const { data: b1, error: e1 } = await adm().from("contrato_blocos").insert({ contrato_id: c.id, numero_bloco: 1, inicio, fim: somar(inicio, 59), meses: 2, valor: 6400, caucao: 3200, status: "ativo", aceite_proprietario_em: agora, aceite_inquilino_em: agora }).select("id").single();
  if (e1) throw e1;
  await adm().from("pagamentos_bloco").insert({ bloco_id: b1.id, contrato_id: c.id, tipo: "aluguel", valor: 6400, data_pagamento: inicio < hojeBRT() ? inicio : hojeBRT(), marcado_por: ids.dono, confirmado_pelo_inquilino: true, confirmado_em: agora });
  return c.id as string;
}

const codigo = () => `VN-SV-${Array.from({ length: 8 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("")}`;

/** Pedido de serviço manual (o que a tela de "Solicitar orçamento" grava), já no status pedido. */
async function pedidoDeServico(status: "solicitado" | "agendado", horario: string): Promise<{ id: string; codigo: string }> {
  const cod = codigo();
  const { data, error } = await adm()
    .from("parceiro_pedidos")
    .insert({
      codigo: cod,
      parceiro_id: ids.parceiro,
      cliente_id: ids.dono,
      servico_id: ids.servico,
      property_id: ids.imovelS,
      categoria: "limpeza",
      descricao: "Limpeza completa do studio antes da próxima estadia.",
      horarios_propostos: [horario],
      status,
      ...(status === "agendado" ? { horario_confirmado: horario, valor_combinado: 250, taxa_percent: 0.1, valor_taxa: 25, valor_parceiro: 225 } : {}),
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id as string, codigo: cod };
}

async function caixa(usuarioId: string, evento: string): Promise<{ assunto: string; corpo: string }[]> {
  const { data } = await adm().from("emails_teste").select("assunto, corpo").eq("usuario_id", usuarioId).eq("evento", evento).order("criado_em");
  return (data ?? []).map((d) => ({ assunto: String(d.assunto ?? ""), corpo: String(d.corpo ?? "") }));
}

/** O e-mail do evento que fala do imóvel `letra` (espera até 30 s). */
async function emailDo(usuarioId: string, evento: string, letra: string): Promise<{ assunto: string; corpo: string }> {
  await expect.poll(async () => (await caixa(usuarioId, evento)).filter((m) => m.corpo.includes(tituloDe(letra))).length, { timeout: 30_000, message: `${evento} sobre ${tituloDe(letra)}` }).toBeGreaterThanOrEqual(1);
  return (await caixa(usuarioId, evento)).filter((m) => m.corpo.includes(tituloDe(letra))).at(-1)!;
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

async function rodarCron() {
  const r = await fetch(`http://localhost:${PORTA}/api/cron/automacoes`, { headers: { authorization: `Bearer ${SEGREDO}` } });
  const corpo = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  expect(r.status, JSON.stringify(corpo)).toBe(200);
  expect(corpo.simulado).toBe(false);
}

test.describe("T712 — E267: transacionais de estadia e de serviço nomeiam a pessoa, o imóvel e o fato", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    ids.dono = await conta("dono", "Dora Transacional", "owner");
    ids.lara = await conta("lara", "Lara Transacional", "owner");
    for (const [k, nome] of [["bia", "Bia Transacional"], ["caio", "Caio Transacional"], ["duda", "Duda Transacional"], ["eva", "Eva Transacional"]] as const) ids[k] = await conta(k, nome, "tenant");
    const { data: parc, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.lara, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: PARCEIRO, slug: `lara-t712-${sufixo}`, categorias: ["limpeza"], cidades: ["Uberlândia"], descricao_curta: "Parceiro de laboratório.", status: "publicado", publicado_em: new Date().toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    ids.parceiro = parc.id as string;
    const { data: sv, error: es } = await adm().from("parceiro_servicos").insert({ parceiro_id: ids.parceiro, categoria: "limpeza", titulo: "Limpeza completa", preco_base: 250, unidade: "por serviço", ativo: true }).select("id").single();
    if (es) throw es;
    ids.servico = sv.id as string;
    // A: aditivo (começou há 29 dias, sai em 30). B/C: convite e encerramento (2 ocupantes). F1: sai em 4 dias, sem
    // limpeza fixa. F2: entra em 5 dias. S: o imóvel dos pedidos de serviço (sem contrato).
    ids.A = await contrato("A", ids.bia, emDias(-29));
    ids.B = await contrato("B", ids.caio, emDias(-29), 2);
    ids.F1 = await contrato("F1", ids.duda, emDias(-55));
    ids.F2 = await contrato("F2", ids.eva, emDias(5));
    await imovel("S");
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    if (ids.parceiro) {
      await adm().from("parceiro_pedidos").delete().eq("parceiro_id", ids.parceiro);
      await adm().from("parceiro_servicos").delete().eq("parceiro_id", ids.parceiro);
      await adm().from("parceiros").delete().eq("id", ids.parceiro);
    }
    if (contratos.length) {
      for (const t of ["estadia_convidados", "contrato_encerramento_pedidos", "contrato_aditivos", "pagamentos_bloco", "contrato_eventos", "contrato_blocos"]) await adm().from(t).delete().in("contrato_id", contratos);
      await adm().from("contratos").delete().in("id", contratos);
    }
    const pessoas = ["dono", "lara", "bia", "caio", "duda", "eva"].map((k) => ids[k]).filter(Boolean);
    await adm().from("automacoes_envios").delete().in("usuario_id", pessoas);
    await adm().from("emails_teste").delete().in("usuario_id", pessoas);
    if (ids.dono) await adm().from("leads").delete().eq("owner_id", ids.dono);
    await apagarContas(pessoas);
  });

  test("A: aditivo proposto e recusado — quem propôs, o que muda, o prazo e a recusa, com o imóvel", async ({ browser }) => {
    const inicio = emDias(-29);
    const periodo = `Período: ${dataBR(inicio)} a ${dataBR(somar(inicio, 59))}`;
    const m = await abrir(browser, "bia", `/dashboard/estadia/${ids.A}/alteracao`);
    await m.getByTestId("alteracao-meses").selectOption("3");
    await m.getByTestId("alteracao-enviar").click();
    await expect(m).toHaveURL(new RegExp(`/dashboard/estadia/${ids.A}$`), { timeout: 30_000 });
    await expect(m.getByTestId("aditivo-resumo")).toHaveText("Meses: de 2 para 3");
    await m.context().close();

    const proposto = await emailDo(ids.dono, "estadia_aditivo_proposto", "A");
    regua(proposto.corpo, "Dora", "A", [
      `Bia propôs uma alteração no contrato de ${tituloDe("A")}: Meses: de 2 para 3.`,
      /Aceite ou recuse até \d{2}\/\d{2}\/\d{4} pela página da estadia\./,
      "Aditivo: 1",
      "O que muda: Meses: de 2 para 3",
      /Responder até: \d{2}\/\d{2}\/\d{4}/,
      periodo,
    ]);

    const d = await abrir(browser, "dono", `/dashboard/estadia/${ids.A}`);
    await d.getByTestId("aditivo-recusar").click();
    await d.getByTestId("aditivo-recusar-confirmar").click();
    await expect.poll(async () => (await adm().from("contrato_aditivos").select("status").eq("contrato_id", ids.A).single()).data?.status, { timeout: 30_000 }).toBe("recusado");
    await d.context().close();

    const recusa = await emailDo(ids.bia, "estadia_aditivo_respondido", "A");
    regua(recusa.corpo, "Bia", "A", [
      `Dora recusou a sua proposta de alteração do contrato de ${tituloDe("A")}. Nada muda no contrato.`,
      "Resposta: Recusada por Dora",
      "O que muda: Meses: de 2 para 3",
      periodo,
    ]);
    // A dona não recebe a resposta dela mesma.
    expect((await caixa(ids.dono, "estadia_aditivo_respondido")).filter((x) => x.corpo.includes(tituloDe("A")))).toHaveLength(0);
  });

  test("B: convite de quem vai morar junto — quem convidou e o imóvel por extenso, sem valor nem endereço exato", async ({ browser }) => {
    const m = await abrir(browser, "caio", `/dashboard/estadia/${ids.B}`);
    const bloco = m.getByTestId("convidar-ocupante");
    await expect(bloco).toBeVisible({ timeout: 20_000 });
    await bloco.getByTestId("convidado-email").fill(convidado);
    await bloco.getByTestId("convidado-enviar").click();
    await expect(bloco.getByTestId("estadia-ok")).toHaveText("Convite enviado por e-mail.", { timeout: 20_000 });
    await m.context().close();

    const doConvidado = async () => (await lerSaida()).filter((l) => l.servico === "email" && l.para === convidado).map((l) => ({ assunto: String(l.assunto ?? ""), corpo: String(l.corpo ?? "") }));
    await expect.poll(async () => (await doConvidado()).length, { timeout: 30_000 }).toBe(1);
    const [convite] = await doConvidado();
    expect(convite.assunto).toContain("Você foi incluído em uma estadia na Viva");
    expect(convite.corpo).toContain(`Caio incluiu você como morador da estadia em ${imovelPorExtenso("B")}.`);
    expect(convite.corpo).not.toContain("um imóvel da Viva");
    expect(convite.corpo).not.toContain(RUA);
    expect(convite.corpo).not.toMatch(/R\$|3\.200/);
  });

  test("C: pedido de encerramento — quem pediu, o motivo e o imóvel", async ({ browser }) => {
    const m = await abrir(browser, "caio", `/dashboard/estadia/${ids.B}/encerrar`);
    await m.getByTestId("encerrar-motivo-mudanca_planos_morador").check();
    await m.getByTestId("encerrar-continuar").click();
    await m.getByTestId("encerrar-confirmar").click();
    await m.getByTestId("encerrar-confirmar-confirmar").click();
    await expect(m).toHaveURL(new RegExp(`/dashboard/estadia/${ids.B}$`), { timeout: 30_000 });
    await m.context().close();

    const inicio = emDias(-29);
    const enc = await emailDo(ids.dono, "estadia_encerramento_pedido", "B");
    regua(enc.corpo, "Dora", "B", [
      `Caio pediu o encerramento do contrato de ${tituloDe("B")} (motivo: mudança de planos do morador).`,
      "Pedido por: Caio",
      "Motivo: Mudança de planos do morador",
      `Período: ${dataBR(inicio)} a ${dataBR(somar(inicio, 59))}`,
    ]);
    // Quem pediu não recebe o próprio pedido.
    expect(await caixa(ids.caio, "estadia_encerramento_pedido")).toHaveLength(0);
  });

  test("D: serviço entregue e concluído — o parceiro, o serviço, o imóvel, a data e o valor para cada parte", async ({ browser }) => {
    // Amanhã às 10h de Brasília.
    const horario = new Date(`${emDias(1)}T10:00:00-03:00`).toISOString();
    const p = await pedidoDeServico("agendado", horario);
    const bloco = ["Serviço: Limpeza completa", `Imóvel: ${imovelPorExtenso("S")}`, `Data: ${quando(horario)}`, "Valor: R$ 250", `Pedido: ${p.codigo}`];

    const l = await abrir(browser, "lara", `/dashboard/servicos/pedidos/${p.id}`);
    await l.getByTestId("pedido-iniciar").click();
    await expect(l.getByTestId("pedido-parceiro")).toHaveAttribute("data-status", "em_execucao", { timeout: 20_000 });
    await l.getByTestId("pedido-marcar-entregue").click();
    await expect(l.getByTestId("pedido-parceiro")).toHaveAttribute("data-status", "entregue", { timeout: 20_000 });

    const entregue = await emailDo(ids.dono, "parceiro_entrega_feita", "S");
    regua(entregue.corpo, "Dora", "S", [`${PARCEIRO} marcou o serviço de limpeza completa em ${tituloDe("S")} como entregue.`, ...bloco]);

    const d = await abrir(browser, "dono", `/dashboard/servicos/pedidos/${p.id}`);
    await expect(async () => {
      if ((await d.getByTestId("pedido-parceiro").getAttribute("data-status")) === "concluido") return;
      if (!(await d.getByTestId("pedido-concluir-confirmacao").isVisible())) await d.getByTestId("pedido-concluir").click();
      await d.getByTestId("pedido-concluir-confirmar").click({ timeout: 3_000 });
      await expect(d.getByTestId("pedido-parceiro")).toHaveAttribute("data-status", "concluido", { timeout: 5_000 });
    }).toPass({ timeout: 40_000 });
    await d.context().close();
    await l.context().close();

    // Avaliação: cada parte lê o nome da OUTRA (o nome público do parceiro; o primeiro nome da cliente).
    const paraDona = await emailDo(ids.dono, "parceiro_avaliacao", "S");
    regua(paraDona.corpo, "Dora", "S", [`o serviço de limpeza completa em ${tituloDe("S")} com ${PARCEIRO} foi concluído.`, ...bloco]);
    const paraParceiro = await emailDo(ids.lara, "parceiro_avaliacao", "S");
    regua(paraParceiro.corpo, "Lara", "S", [`o serviço de limpeza completa em ${tituloDe("S")} com Dora foi concluído.`, ...bloco]);
    expect(paraParceiro.corpo).not.toContain("Transacional");
  });

  test("E: o parceiro recusa com motivo — o nome dele, o motivo e o bloco do pedido", async ({ browser }) => {
    const horario = new Date(`${emDias(3)}T09:00:00-03:00`).toISOString();
    const p = await pedidoDeServico("solicitado", horario);
    const l = await abrir(browser, "lara", `/dashboard/servicos/pedidos/${p.id}`);
    await l.locator("#pedido-motivo").fill("Agenda cheia nesta semana");
    await l.getByTestId("pedido-recusar").click();
    await l.getByTestId("pedido-recusar-confirmar").click();
    await expect(l.getByTestId("pedido-parceiro")).toHaveAttribute("data-status", "recusado", { timeout: 20_000 });
    await l.context().close();

    const recusa = await emailDo(ids.dono, "parceiro_pedido_recusado", "S");
    regua(recusa.corpo, "Dora", "S", [
      `${PARCEIRO} recusou o seu pedido. Motivo: Agenda cheia nesta semana. Você pode pedir a outro parceiro.`,
      "Serviço: Limpeza completa",
      `Data sugerida: ${quando(horario)}`,
      `Pedido: ${p.codigo}`,
    ]);
  });

  test("F: cron da estadia — saída sem limpeza (dona) e sugestões de saída e de entrada (moradoras), com o imóvel e a data", async () => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    const log = createWriteStream(`${SAIDA}/t712-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, AUTOMACOES_ATIVO: "1", PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/automacoes`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);

    const saida = somar(emDias(-55), 59); // = emDias(4)
    const entrada = emDias(5);
    await rodarCron();

    const semLimpeza = await emailDo(ids.dono, "saida_sem_parceiro", "F1");
    regua(semLimpeza.corpo, "Dora", "F1", [`o morador sai de ${tituloDe("F1")} em ${dataBR(saida)} e o imóvel não tem limpeza fixa.`, `Saída: ${dataBR(saida)}`]);
    const sugSaida = await emailDo(ids.duda, "sugestao_parceiros_morador", "F1");
    regua(sugSaida.corpo, "Duda", "F1", [`separamos parceiros da cidade para a sua saída de ${tituloDe("F1")} em ${dataBR(saida)}.`, `Saída: ${dataBR(saida)}`]);
    const sugEntrada = await emailDo(ids.eva, "sugestao_parceiros_morador", "F2");
    regua(sugEntrada.corpo, "Eva", "F2", [`separamos parceiros da cidade para a sua entrada em ${tituloDe("F2")} em ${dataBR(entrada)}.`, `Entrada: ${dataBR(entrada)}`]);

    // Uma vez por chave: rodar de novo não repete nenhum dos três.
    await rodarCron();
    await new Promise((r) => setTimeout(r, 3_000));
    expect((await caixa(ids.dono, "saida_sem_parceiro")).filter((m) => m.corpo.includes(tituloDe("F1")))).toHaveLength(1);
    expect(await caixa(ids.duda, "sugestao_parceiros_morador")).toHaveLength(1);
    expect(await caixa(ids.eva, "sugestao_parceiros_morador")).toHaveLength(1);
  });
});
