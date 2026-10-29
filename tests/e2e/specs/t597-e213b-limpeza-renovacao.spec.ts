import { test, expect, type Browser } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T597 — E213-B: limpeza automática da saída (Prompt 38) × renovação dentro da janela do D-5. A remarcação vem do
  aditivo assinado pelas duas partes, pela tela de verdade (como a t595); o cron sobe num 2º servidor do mesmo build
  (porta 3128) com um CRON_SECRET só dele e AUTOMACOES_ATIVO=1, como a t592.
    B. sem aceite, a nova saída fica LONGE (> 5 dias): o pedido é cancelado, a chave ganha ":remarcado:<ts>" e o
       parceiro recebe "a saída mudou; o pedido volta a ser feito perto da nova data"; quando a nova saída chega ao
       D-5, o cron refaz o pedido com a chave ORIGINAL. Item 4: a sugestão ao morador sai de novo para a nova saída
       (a chave de "uma vez" leva a data) e o lembrete de saída também leva a data na chave.
    A. sem aceite, a nova saída fica PERTO (≤ 5 dias): o mesmo pedido, a mesma chave, a janela nova.
    C. já aceito (agendado): vira reagendamento — volta a "aceito" com os horários da janela nova, o valor igual; o
       parceiro confirma o novo horário pelo fluxo de horário que já existe → "agendado".
    D. já aceito, o parceiro RECUSA a nova data e ela está longe → cancelado com o sufixo (o cron refaz no D-5).
    E. já aceito, o parceiro RECUSA a nova data e ela está perto → volta a "solicitado" na janela nova, sem os valores.
*/
const SAIDA = "tests/laboratorio/saida";
const PORTA = 3128;
const SEGREDO = `lab-t597-${Math.random().toString(36).slice(2)}`;
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: Record<string, string> = {};
const contratos: string[] = [];
const imoveis: Record<string, string> = {};
const emails: Record<string, string> = {};
const hojeBRT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const emDias = (n: number) => new Date(Date.parse(hojeBRT()) + n * 86_400_000).toISOString().slice(0, 10);
const somar = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);
const inicioDaJanela = (saida: string) => new Date(`${saida}T13:00:00-03:00`).toISOString();
let servidor: ChildProcess | null = null;

type Pedido = { id: string; status: string; chave_automacao: string; janela_inicio: string | null; janela_fim: string | null; horario_confirmado: string | null; horarios_propostos: string[]; valor_combinado: number | string | null };

async function conta(quem: string, nome: string, role: "owner" | "tenant") {
  emails[quem] = `${quem}.t597.${sufixo}@lab.vivanomads.test`;
  const id = await criarConta({ email: emails[quem], nome, role }, senha);
  await adm().from("profiles").update({ is_teste: true }).eq("id", id);
  return id;
}

/**
 * Contrato ativo, assinado, com o bloco 1 (2 meses, já começou, pago) terminando em `fimEm` dias e, se `bloco2`, um
 * bloco 2 de 1 mês já aceito pelas duas partes logo depois. Imóvel com a limpeza fixa ATIVA (automático).
 */
async function contrato(letra: string, inquilino: string, fimEm: number, bloco2 = false) {
  const imovel = await criarImovelPronto(ids.dono, `Studio renova ${letra} t597 ${sufixo}`, { ativo: true, preco: 3200 });
  imoveis[letra] = imovel;
  await adm().from("properties").update({ checkout_before: "11:00", checkin_after: "14:00" }).eq("id", imovel);
  const { error: ev } = await adm().from("imovel_parceiros").insert({ property_id: imovel, categoria: "limpeza", parceiro_id: ids.parceiro, servico_id: ids.servico, modo: "automatico", status: "ativo", respondido_em: new Date().toISOString() });
  if (ev) throw ev;
  const lead = await criarLead(ids.dono, inquilino, imovel, true);
  const agora = new Date().toISOString();
  const { data: c, error } = await adm()
    .from("contratos")
    .insert({ property_id: imovel, tenant_id: inquilino, lead_id: lead, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: bloco2 ? 90 : 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1, capacidade_snapshot: 2, status: "ativo", garantia: "caucao", assinado_proprietario_em: agora, assinado_inquilino_em: agora })
    .select("id")
    .single();
  if (error) throw error;
  contratos.push(c.id);
  const fim = emDias(fimEm);
  const inicio = somar(fim, -59);
  const { data: b1, error: e1 } = await adm().from("contrato_blocos").insert({ contrato_id: c.id, numero_bloco: 1, inicio, fim, meses: 2, valor: 6400, caucao: 3200, status: "ativo", aceite_proprietario_em: agora, aceite_inquilino_em: agora }).select("id").single();
  if (e1) throw e1;
  await adm().from("pagamentos_bloco").insert({ bloco_id: b1.id, contrato_id: c.id, tipo: "aluguel", valor: 6400, data_pagamento: inicio, marcado_por: ids.dono, confirmado_pelo_inquilino: true, confirmado_em: agora });
  if (bloco2) {
    const { error: e2 } = await adm().from("contrato_blocos").insert({ contrato_id: c.id, numero_bloco: 2, inicio: somar(fim, 1), fim: somar(fim, 30), meses: 1, valor: 3200, caucao: 0, status: "agendado", aceite_proprietario_em: agora, aceite_inquilino_em: agora });
    if (e2) throw e2;
  }
  return c.id as string;
}

const base = (letra: string, contratoId: string) => `${imoveis[letra]}:limpeza:${contratoId}:saida`;
const codigo = () => `VN-SV-${Array.from({ length: 8 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("")}`;

/** O pedido que o cron do D-5 teria criado para a saída `saida`, no status pedido (aceito/agendado com o valor congelado). */
async function semearPedido(letra: string, contratoId: string, saida: string, status: "solicitado" | "aceito" | "agendado") {
  const janelaInicio = inicioDaJanela(saida);
  const janelaFim = new Date(Date.parse(janelaInicio) + 46 * 3_600_000).toISOString();
  const horario = new Date(Date.parse(janelaInicio) + 2 * 3_600_000).toISOString();
  const { data: v } = await adm().from("imovel_parceiros").select("id").eq("property_id", imoveis[letra]).eq("categoria", "limpeza").single();
  const aceito = status !== "solicitado";
  const { data, error } = await adm()
    .from("parceiro_pedidos")
    .insert({
      codigo: codigo(),
      parceiro_id: ids.parceiro,
      cliente_id: ids.dono,
      servico_id: ids.servico,
      property_id: imoveis[letra],
      categoria: "limpeza",
      descricao: "Limpeza depois da saída do morador.",
      horarios_propostos: [horario],
      origem: "automatico",
      chave_automacao: base(letra, contratoId),
      gatilho: "saida_limpeza",
      vinculo_id: v!.id,
      contrato_id: contratoId,
      janela_inicio: janelaInicio,
      janela_fim: janelaFim,
      aguardando_dono: false,
      enviado_em: new Date().toISOString(),
      status,
      ...(aceito ? { valor_combinado: 250, taxa_percent: 0.1, valor_taxa: 25, valor_parceiro: 225 } : {}),
      ...(status === "agendado" ? { horario_confirmado: horario } : {}),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function pedidosDe(letra: string, contratoId: string): Promise<Pedido[]> {
  const { data } = await adm()
    .from("parceiro_pedidos")
    .select("id, status, chave_automacao, janela_inicio, janela_fim, horario_confirmado, horarios_propostos, valor_combinado")
    .like("chave_automacao", `${base(letra, contratoId)}%`)
    .order("criado_em");
  return (data ?? []) as Pedido[];
}

async function caixa(usuarioId: string, evento: string): Promise<{ assunto: string; corpo: string }[]> {
  const { data } = await adm().from("emails_teste").select("assunto, corpo").eq("usuario_id", usuarioId).eq("evento", evento);
  return (data ?? []).map((d) => ({ assunto: String(d.assunto ?? ""), corpo: String(d.corpo ?? "") }));
}

async function mensagensDo(pedidoId: string): Promise<string[]> {
  const { data } = await adm().from("messages").select("body").eq("parceiro_pedido_id", pedidoId).order("created_at");
  return (data ?? []).map((m) => String(m.body ?? ""));
}

async function eventosDo(pedidoId: string): Promise<string[]> {
  const { data } = await adm().from("parceiro_pedido_eventos").select("tipo").eq("pedido_id", pedidoId).order("criado_em");
  return (data ?? []).map((e) => String(e.tipo));
}

async function codigoDaCaixa(usuarioId: string, depoisDe: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const { data } = await adm().from("emails_teste").select("corpo").eq("usuario_id", usuarioId).eq("evento", "contract_signature_code").gt("criado_em", depoisDe).order("criado_em", { ascending: false }).limit(1);
    const m = /":\s*(\d{6})\s*$/m.exec(String(data?.[0]?.corpo ?? "").trim());
    if (m) return m[1];
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("O código do aditivo não chegou à caixa de testes em 30 s.");
}

/** Pela tela: o morador propõe a mudança de meses, o dono aceita, os dois assinam com o código. */
async function aditivo(browser: Browser, contratoId: string, morador: string, de: number, para: number) {
  const m = await entrar(browser, emails[morador], senha);
  await m.goto(`/dashboard/estadia/${contratoId}/alteracao`, { waitUntil: "domcontentloaded" });
  await m.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await m.getByTestId("alteracao-meses").selectOption(String(para));
  await m.getByTestId("alteracao-enviar").click();
  await expect(m).toHaveURL(new RegExp(`/dashboard/estadia/${contratoId}$`));
  await expect(m.getByTestId("aditivo-resumo")).toHaveText(`Meses: de ${de} para ${para}`);

  const d = await entrar(browser, emails.dono, senha);
  await d.goto(`/dashboard/estadia/${contratoId}`, { waitUntil: "domcontentloaded" });
  await d.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await d.getByTestId("aditivo-aceitar").click();
  await expect(d.getByTestId("estadia-aditivo")).toHaveAttribute("data-status", "aceito", { timeout: 30_000 });

  for (const [pagina, quem] of [[d, ids.dono], [m, ids[morador]]] as const) {
    await pagina.reload({ waitUntil: "domcontentloaded" });
    await pagina.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    const desde = new Date().toISOString();
    await pagina.getByTestId("aditivo-pedir-codigo").click();
    await expect(pagina.getByTestId("estadia-ok").or(pagina.getByTestId("estadia-erro"))).toHaveText("Código enviado para o seu e-mail.", { timeout: 30_000 });
    await pagina.getByTestId("aditivo-codigo").fill(await codigoDaCaixa(quem, desde));
    await pagina.getByTestId("aditivo-aceite").check();
    await pagina.getByTestId("aditivo-assinar").click();
    await expect(pagina.getByTestId("estadia-ok").or(pagina.getByTestId("estadia-erro"))).toHaveText("Assinatura registrada.", { timeout: 30_000 });
  }
  await d.context().close();
  await m.context().close();
  const { data: ev } = await adm().from("contrato_eventos").select("tipo").eq("contrato_id", contratoId).eq("tipo", "estadia_remarcada");
  expect(ev, "o aditivo foi aplicado").toHaveLength(1);
}

/** A saída do contrato agora (maior fim dos blocos válidos). */
async function saidaDo(contratoId: string): Promise<string> {
  const { data } = await adm().from("contrato_blocos").select("fim, status").eq("contrato_id", contratoId);
  return ((data ?? []) as { fim: string; status: string }[]).filter((b) => b.status !== "nao_aceito").map((b) => b.fim).sort().at(-1)!;
}

async function abrirPedidoComoParceiro(browser: Browser, pedidoId: string) {
  const p = await entrar(browser, emails.limpa, senha);
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.goto(`/dashboard/servicos/pedidos/${pedidoId}`, { waitUntil: "domcontentloaded" });
  await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  return p;
}

async function rodarCron() {
  const r = await fetch(`http://localhost:${PORTA}/api/cron/automacoes`, { headers: { authorization: `Bearer ${SEGREDO}` } });
  const corpo = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  expect(r.status, JSON.stringify(corpo)).toBe(200);
  expect(corpo.simulado).toBe(false);
  return corpo;
}

test.describe("T597 — E213-B: limpeza D-5 × renovação dentro da janela", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 300_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    ids.dono = await conta("dono", "Dora Renova", "owner");
    ids.limpa = await conta("limpa", "Lara Renova", "owner");
    for (const k of ["ana", "beto", "caio", "duda", "eva"]) ids[k] = await conta(k, `${k[0].toUpperCase()}${k.slice(1)} Renova`, "tenant");
    const { data: parc, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.limpa, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: `Lara Limpa ${sufixo}`, slug: `lara-t597-${sufixo}`, categorias: ["limpeza"], cidades: ["Uberlândia"], descricao_curta: "Parceiro de laboratório.", status: "publicado", publicado_em: new Date().toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    ids.parceiro = parc.id as string;
    const { data: sv } = await adm().from("parceiro_servicos").insert({ parceiro_id: ids.parceiro, categoria: "limpeza", titulo: "Limpeza completa", preco_base: 250, unidade: "por serviço", ativo: true }).select("id").single();
    ids.servico = sv!.id as string;
    // B: saída em 4 dias (o cron do D-5 cria o pedido); A e E: 3 meses, a saída longe (bloco 2) e o pedido já criado;
    // C e D: saída em 3 dias, o pedido já aceito (D) e agendado (C).
    ids.B = await contrato("B", ids.beto, 4);
    ids.A = await contrato("A", ids.ana, 2, true);
    ids.C = await contrato("C", ids.caio, 3);
    ids.D = await contrato("D", ids.duda, 3);
    ids.E = await contrato("E", ids.eva, 2, true);
    ids.pA = await semearPedido("A", ids.A, await saidaDo(ids.A), "solicitado");
    ids.pC = await semearPedido("C", ids.C, emDias(3), "agendado");
    ids.pD = await semearPedido("D", ids.D, emDias(3), "aceito");
    ids.pE = await semearPedido("E", ids.E, await saidaDo(ids.E), "aceito");
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    if (contratos.length) {
      await adm().from("parceiro_pedidos").delete().in("contrato_id", contratos);
      await adm().from("pagamentos_bloco").delete().in("contrato_id", contratos);
      await adm().from("contrato_eventos").delete().in("contrato_id", contratos);
      await adm().from("contrato_blocos").delete().in("contrato_id", contratos);
      await adm().from("contratos").delete().in("id", contratos);
    }
    if (ids.parceiro) {
      await adm().from("parceiro_pedidos").delete().eq("parceiro_id", ids.parceiro);
      await adm().from("imovel_parceiros").delete().eq("parceiro_id", ids.parceiro);
      await adm().from("parceiro_servicos").delete().eq("parceiro_id", ids.parceiro);
      await adm().from("parceiros").delete().eq("id", ids.parceiro);
    }
    const pessoas = ["dono", "limpa", "ana", "beto", "caio", "duda", "eva"].map((k) => ids[k]).filter(Boolean);
    await adm().from("automacoes_envios").delete().in("usuario_id", pessoas);
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas(pessoas);
  });

  test("B + item 4: sem aceite, a nova saída longe → cancelado com o sufixo; o cron refaz no D-5 com a chave original; a sugestão sai de novo", async ({ browser }) => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    const log = createWriteStream(`${SAIDA}/t597-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, AUTOMACOES_ATIVO: "1", PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/automacoes`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);

    // 1) D-4 da saída original: o cron cria a limpeza (chave original) e manda a sugestão ao morador — uma vez.
    const saidaOriginal = emDias(4);
    await rodarCron();
    await rodarCron();
    let ps = await pedidosDe("B", ids.B);
    expect(ps, "um pedido por saída, mesmo com 2 rodadas").toHaveLength(1);
    const original = ps[0];
    expect(original).toMatchObject({ status: "solicitado", chave_automacao: base("B", ids.B) });
    expect(new Date(original.janela_inicio!).toISOString()).toBe(inicioDaJanela(saidaOriginal));
    await expect.poll(async () => (await caixa(ids.beto, "sugestao_parceiros_morador")).length, { timeout: 30_000 }).toBe(1);
    const { data: env1 } = await adm().from("automacoes_envios").select("chave").eq("usuario_id", ids.beto).like("chave", "sugestao_parceiros_morador:%");
    expect((env1 ?? []).map((e) => e.chave)).toEqual([`sugestao_parceiros_morador:${ids.B}:${ids.beto}:saida:${saidaOriginal}`]);

    // 2) Renovação (+1 mês): a nova saída fica a ~34 dias → cancela com o sufixo e avisa o parceiro.
    await aditivo(browser, ids.B, "beto", 2, 3);
    const novaSaida = await saidaDo(ids.B);
    expect(novaSaida > emDias(5), novaSaida).toBe(true);
    ps = await pedidosDe("B", ids.B);
    expect(ps).toHaveLength(1);
    expect(ps[0].id).toBe(original.id);
    expect(ps[0].status).toBe("cancelado");
    expect(ps[0].chave_automacao).toMatch(new RegExp(`^${base("B", ids.B)}:remarcado:\\d+$`));
    expect(await mensagensDo(original.id)).toContain("A saída mudou; o pedido volta a ser feito perto da nova data.");
    expect(await eventosDo(original.id)).toContain("cancelar");
    await expect.poll(async () => (await caixa(ids.limpa, "pedido_auto_cancelado")).length, { timeout: 30_000 }).toBe(1);
    const [cancelado] = await caixa(ids.limpa, "pedido_auto_cancelado");
    expect(cancelado.assunto.startsWith("Pedido cancelado"), cancelado.assunto).toBe(true);
    expect(cancelado.corpo).toContain("O pedido volta a ser feito perto da nova data.");

    // 3) A data simulada: a nova saída chega a 3 dias (os blocos andam 31 dias para trás). O cron do D-5 refaz o
    //    pedido com a chave ORIGINAL; a sugestão sai de novo (a data entrou na chave) e o lembrete de saída leva a data.
    const { data: blocos } = await adm().from("contrato_blocos").select("id, numero_bloco, inicio, fim").eq("contrato_id", ids.B).order("numero_bloco");
    const b1 = blocos!.find((b) => b.numero_bloco === 1)!;
    const b2 = blocos!.find((b) => b.numero_bloco === 2)!;
    const simulada = emDias(3);
    await adm().from("contrato_blocos").update({ fim: somar(simulada, -30) }).eq("id", b1.id);
    await adm().from("contrato_blocos").update({ inicio: somar(simulada, -29), fim: simulada }).eq("id", b2.id);
    await rodarCron();
    ps = await pedidosDe("B", ids.B);
    expect(ps, "o cancelado + o refeito").toHaveLength(2);
    const refeito = ps.find((p) => p.id !== original.id)!;
    expect(refeito).toMatchObject({ status: "solicitado", chave_automacao: base("B", ids.B) });
    expect(new Date(refeito.janela_inicio!).toISOString()).toBe(inicioDaJanela(simulada));
    await expect.poll(async () => (await caixa(ids.beto, "sugestao_parceiros_morador")).length, { timeout: 30_000 }).toBe(2);
    const { data: env2 } = await adm().from("automacoes_envios").select("chave").eq("usuario_id", ids.beto).like("chave", "sugestao_parceiros_morador:%");
    expect((env2 ?? []).map((e) => e.chave).sort()).toEqual([`sugestao_parceiros_morador:${ids.B}:${ids.beto}:saida:${saidaOriginal}`, `sugestao_parceiros_morador:${ids.B}:${ids.beto}:saida:${simulada}`].sort());
    await expect.poll(async () => (await caixa(ids.beto, "saida_lembrete")).length, { timeout: 30_000 }).toBe(1);
    const { data: lembrete } = await adm().from("automacoes_envios").select("chave").eq("chave", `saida_lembrete:${ids.B}:${ids.beto}:${simulada}`);
    expect(lembrete, "o lembrete de saída leva a data na chave").toHaveLength(1);
    // De novo não repete.
    await rodarCron();
    await new Promise((r) => setTimeout(r, 3000));
    expect(await pedidosDe("B", ids.B)).toHaveLength(2);
    expect(await caixa(ids.beto, "sugestao_parceiros_morador")).toHaveLength(2);
    expect(await caixa(ids.beto, "saida_lembrete")).toHaveLength(1);
  });

  test("A: sem aceite, a nova saída perto (≤ 5 dias) → o mesmo pedido ganha a janela nova", async ({ browser }) => {
    const [antes] = await pedidosDe("A", ids.A);
    expect(antes.id).toBe(ids.pA);
    await aditivo(browser, ids.A, "ana", 3, 2);
    const novaSaida = await saidaDo(ids.A);
    expect(novaSaida).toBe(emDias(2));
    const ps = await pedidosDe("A", ids.A);
    expect(ps, "não cria outro nem cancela").toHaveLength(1);
    expect(ps[0]).toMatchObject({ id: ids.pA, status: "solicitado", chave_automacao: base("A", ids.A) });
    expect(new Date(ps[0].janela_inicio!).toISOString()).toBe(inicioDaJanela(novaSaida));
    expect(await eventosDo(ids.pA)).toContain("remarcado");
    expect((await mensagensDo(ids.pA)).some((m) => m.startsWith("A estadia foi remarcada. Nova janela: entre"))).toBe(true);
    await expect.poll(async () => (await caixa(ids.limpa, "pedido_auto_atualizado")).length, { timeout: 30_000 }).toBeGreaterThanOrEqual(1);
  });

  test("C: já aceito (agendado) → reagendamento; o parceiro confirma o novo horário; o valor fica igual", async ({ browser }) => {
    const antes = (await pedidosDe("C", ids.C))[0];
    expect(antes.status).toBe("agendado");
    const atualizados = (await caixa(ids.limpa, "pedido_auto_atualizado")).length;
    await aditivo(browser, ids.C, "caio", 2, 3);
    const novaSaida = await saidaDo(ids.C);
    let [p] = await pedidosDe("C", ids.C);
    expect(p).toMatchObject({ id: ids.pC, status: "aceito", chave_automacao: base("C", ids.C), horario_confirmado: null });
    expect(Number(p.valor_combinado), "sem orçamento novo: o valor fica").toBe(250);
    expect(new Date(p.janela_inicio!).toISOString()).toBe(inicioDaJanela(novaSaida));
    expect(p.horarios_propostos.length).toBeGreaterThan(0);
    expect(p.horarios_propostos.every((h) => Date.parse(h) >= Date.parse(p.janela_inicio!) && Date.parse(h) < Date.parse(p.janela_fim!))).toBe(true);
    expect(await eventosDo(ids.pC)).toContain("reagendamento");
    expect((await mensagensDo(ids.pC)).some((m) => m.includes("Confirme um dos novos horários ou recuse a nova data pelo pedido. O valor combinado continua o mesmo."))).toBe(true);
    await expect.poll(async () => (await caixa(ids.limpa, "pedido_auto_atualizado")).length, { timeout: 30_000 }).toBe(atualizados + 1);
    const aviso = (await caixa(ids.limpa, "pedido_auto_atualizado")).at(-1)!;
    expect(aviso.assunto.startsWith("O pedido mudou de data"), aviso.assunto).toBe(true);

    // O parceiro confirma pelo fluxo de horário que já existe.
    const pg = await abrirPedidoComoParceiro(browser, ids.pC);
    await expect(pg.getByTestId("pedido-reagendamento")).toContainText("O valor combinado continua o mesmo.");
    await expect(pg.getByTestId("pedido-valor")).toContainText("250");
    await pg.screenshot({ path: `${SAIDA}/t597-reagendamento-parceiro-1280.png`, fullPage: true });
    await pg.getByTestId("pedido-confirmar-horario").first().click();
    await expect(pg.getByTestId("pedido-parceiro")).toHaveAttribute("data-status", "agendado", { timeout: 30_000 });
    await expect(pg.getByTestId("pedido-reagendamento")).toHaveCount(0);
    await pg.context().close();
    [p] = await pedidosDe("C", ids.C);
    expect(p.status).toBe("agendado");
    expect(p.horarios_propostos.map((h) => new Date(h).toISOString())).toContain(new Date(p.horario_confirmado!).toISOString());
    expect(Date.parse(p.horario_confirmado!)).toBeGreaterThanOrEqual(Date.parse(p.janela_inicio!));
    expect(Number(p.valor_combinado)).toBe(250);
  });

  test("D: já aceito, o parceiro recusa a nova data (longe) → cancelado com o sufixo; o cron refaz no D-5", async ({ browser }) => {
    await aditivo(browser, ids.D, "duda", 2, 3);
    let [p] = await pedidosDe("D", ids.D);
    expect(p).toMatchObject({ id: ids.pD, status: "aceito" });
    const recusados = (await caixa(ids.dono, "parceiro_pedido_recusado")).length;
    const pg = await abrirPedidoComoParceiro(browser, ids.pD);
    await expect(pg.getByTestId("pedido-reagendamento")).toBeVisible();
    await pg.getByTestId("pedido-recusar-nova-data").click();
    await expect(pg.getByTestId("pedido-parceiro")).toHaveAttribute("data-status", "cancelado", { timeout: 30_000 });
    await pg.context().close();
    const ps = await pedidosDe("D", ids.D);
    expect(ps).toHaveLength(1);
    [p] = ps;
    expect(p.status).toBe("cancelado");
    expect(p.chave_automacao, "a chave original fica livre para o cron do D-5").toMatch(new RegExp(`^${base("D", ids.D)}:remarcado:\\d+$`));
    expect(await eventosDo(ids.pD)).toEqual(expect.arrayContaining(["reagendamento", "cancelar", "recusar_nova_data"]));
    const msgs = await mensagensDo(ids.pD);
    expect(msgs).toContain("O parceiro recusou a nova data.");
    expect(msgs).toContain("A saída mudou; o pedido volta a ser feito perto da nova data.");
    await expect.poll(async () => (await caixa(ids.dono, "parceiro_pedido_recusado")).length, { timeout: 30_000 }).toBe(recusados + 1);
    expect((await caixa(ids.dono, "parceiro_pedido_recusado")).at(-1)!.corpo).toContain("o parceiro recusou a nova data da limpeza. O pedido foi cancelado e volta a ser feito perto da nova saída.");
  });

  test("E: já aceito, o parceiro recusa a nova data (perto) → volta a 'solicitado' na janela nova, sem os valores do aceite", async ({ browser }) => {
    await aditivo(browser, ids.E, "eva", 3, 2);
    const novaSaida = await saidaDo(ids.E);
    expect(novaSaida).toBe(emDias(2));
    let [p] = await pedidosDe("E", ids.E);
    expect(p).toMatchObject({ id: ids.pE, status: "aceito" });
    expect(new Date(p.janela_inicio!).toISOString()).toBe(inicioDaJanela(novaSaida));
    const pg = await abrirPedidoComoParceiro(browser, ids.pE);
    await pg.getByTestId("pedido-recusar-nova-data").click();
    await expect(pg.getByTestId("pedido-parceiro")).toHaveAttribute("data-status", "solicitado", { timeout: 30_000 });
    await pg.context().close();
    const ps = await pedidosDe("E", ids.E);
    expect(ps, "o mesmo pedido, a mesma chave").toHaveLength(1);
    [p] = ps;
    expect(p).toMatchObject({ id: ids.pE, status: "solicitado", chave_automacao: base("E", ids.E), valor_combinado: null, horario_confirmado: null });
    expect(new Date(p.janela_inicio!).toISOString()).toBe(inicioDaJanela(novaSaida));
    expect(await eventosDo(ids.pE)).toContain("recusar_nova_data");
  });
});
