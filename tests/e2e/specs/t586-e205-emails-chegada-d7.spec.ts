import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, lerSaida, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T586 — E205 (parte que JÁ EXISTE), guarda permanente da Pista C: os e-mails de chegada saem de verdade, pela rotina
  diária, só nas condições certas.
   - "As instruções de chegada estão liberadas" (estadia_instrucoes_liberadas, /api/cron/automacoes) no D-7:
       A. assinado pelas duas partes + 1º pagamento registrado + entrada daqui a 7 dias → o morador recebe, UMA vez;
       B. assinado, SEM o 1º pagamento → ninguém recebe;
       C. 1º pagamento registrado, SEM a assinatura do morador → ninguém recebe;
     o e-mail traz o imóvel, a data e as instruções de chegada no corpo (E209, #1454) e o link para #instrucoes.
   - "Lembrete: a entrada no imóvel está chegando" (checkin_lembrete, /api/cron/checkin-lembretes) no D-2:
       D. assinado + pago + entrada daqui a 2 dias → dono e morador recebem, com o imóvel e a data, UMA vez; as
          instruções só no e-mail do morador;
       E. assinado, SEM o 1º pagamento, entrada daqui a 2 dias → ninguém recebe (E209).
  O laboratório não tem CRON_SECRET (nem AUTOMACOES_ATIVO): o teste sobe um 2º servidor do MESMO build, na porta 3124,
  com um segredo só dele e as automações ligadas — mesmo banco local, mesmas integrações simuladas, mesmo LAB_OUTBOX.
  Os textos completos dos e-mails vão para tests/laboratorio/saida/t586-emails.json e para o log.
*/
const SAIDA = "tests/laboratorio/saida";
const PORTA = 3124;
const SEGREDO = `lab-t586-${Math.random().toString(36).slice(2)}`;
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = (quem: string, nome: string, role: "owner" | "tenant") => ({ email: `${quem}.t586.${sufixo}@lab.vivanomads.test`, nome, role });
const dono = conta("dono", "Dora Chegada", "owner");
const ana = conta("ana", "Ana Completa", "tenant"); // A
const beto = conta("beto", "Beto Sem Pagamento", "tenant"); // B
const caio = conta("caio", "Caio Sem Assinatura", "tenant"); // C
const duda = conta("duda", "Duda Dois Dias", "tenant"); // D
const eva = conta("eva", "Eva Dois Dias Sem Pagamento", "tenant"); // E
const ids: Record<string, string> = {};
const titulo = (l: string) => `Studio chegada ${l} t586 ${sufixo}`;
/** Instruções do dono nos imóveis A e D (E209: vão no corpo do e-mail do morador). */
const INSTRUCOES = { como_entrar: "Chave na portaria, apto 12.", wifi_rede: "CasaViva", wifi_senha: "nomade2026" };

/** Hoje no calendário de Brasília (AAAA-MM-DD) e daqui a n dias. */
const hojeBRT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const emDias = (n: number) => new Date(Date.parse(hojeBRT()) + n * 86_400_000).toISOString().slice(0, 10);
const br = (d: string) => d.split("-").reverse().join("/");

let servidor: ChildProcess | null = null;
let respostaAutomacoes: Record<string, unknown> = {};
let respostaCheckin: Record<string, unknown> = {};

async function contrato(o: { letra: string; inquilino: string; entraEm: number; assinado: "duas" | "so_dono"; pago: boolean }): Promise<string> {
  const imovel = await criarImovelPronto(ids.dono, titulo(o.letra), { ativo: true });
  if (o.letra === "A" || o.letra === "D") {
    const { error: ei } = await adm().from("imovel_instrucoes_chegada").insert({ property_id: imovel, ...INSTRUCOES });
    if (ei) throw ei;
  }
  const lead = await criarLead(ids.dono, o.inquilino, imovel, true);
  const agora = new Date().toISOString();
  const { data, error } = await adm()
    .from("contratos")
    .insert({ property_id: imovel, tenant_id: o.inquilino, lead_id: lead, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1, status: "ativo", garantia: "caucao", assinado_proprietario_em: agora, assinado_inquilino_em: o.assinado === "duas" ? agora : null })
    .select("id")
    .single();
  if (error) throw error;
  const inicio = emDias(o.entraEm);
  const fim = new Date(Date.parse(inicio) + 59 * 86_400_000).toISOString().slice(0, 10);
  const { data: bloco, error: e2 } = await adm().from("contrato_blocos").insert({ contrato_id: data.id, numero_bloco: 1, inicio, fim, meses: 2, valor: 6400, caucao: 3200, status: "ativo" }).select("id").single();
  if (e2) throw e2;
  if (o.pago) {
    const { error: e3 } = await adm().from("pagamentos_bloco").insert({ bloco_id: bloco.id, contrato_id: data.id, tipo: "aluguel", valor: 3200, data_pagamento: hojeBRT(), marcado_por: ids.dono, confirmado_pelo_inquilino: true, confirmado_em: agora });
    if (e3) throw e3;
  }
  return data.id as string;
}

async function rodar(rota: string): Promise<Record<string, unknown>> {
  const r = await fetch(`http://localhost:${PORTA}${rota}`, { headers: { authorization: `Bearer ${SEGREDO}` } });
  const corpo = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  expect(r.status, `${rota}: ${JSON.stringify(corpo)}`).toBe(200);
  return corpo;
}

const emails = async (para: string) => (await lerSaida()).filter((l) => l.servico === "email" && l.para === para);
const comAssunto = async (para: string, trecho: string) => (await emails(para)).filter((l) => String(l.assunto ?? "").includes(trecho));
const LIBERADAS = "As instruções de chegada estão liberadas";
const LEMBRETE = "Lembrete: a entrada no imóvel está chegando";

test.describe("T586 — E205: os e-mails de chegada (D-7 e D-2) saem só nas condições certas", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.skip(!existsSync(".next/BUILD_ID") || !process.env.LAB_OUTBOX, "Precisa do build do laboratório (next start) e do LAB_OUTBOX.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    ids.dono = await criarConta(dono, senha);
    for (const [k, c] of Object.entries({ ana, beto, caio, duda, eva })) ids[k] = await criarConta(c, senha);
    ids.A = await contrato({ letra: "A", inquilino: ids.ana, entraEm: 7, assinado: "duas", pago: true });
    ids.B = await contrato({ letra: "B", inquilino: ids.beto, entraEm: 7, assinado: "duas", pago: false });
    ids.C = await contrato({ letra: "C", inquilino: ids.caio, entraEm: 7, assinado: "so_dono", pago: true });
    ids.D = await contrato({ letra: "D", inquilino: ids.duda, entraEm: 2, assinado: "duas", pago: true });
    ids.E = await contrato({ letra: "E", inquilino: ids.eva, entraEm: 2, assinado: "duas", pago: false });

    // O 2º servidor: o mesmo build e o mesmo ambiente do laboratório, mais o segredo do cron e as automações ligadas.
    const log = createWriteStream(`${SAIDA}/t586-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, AUTOMACOES_ATIVO: "1", PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect
      .poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/automacoes`).catch(() => null))?.status ?? 0, { timeout: 90_000, message: "o 2º servidor subir" })
      .toBe(401);
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    const contratos = [ids.A, ids.B, ids.C, ids.D, ids.E].filter(Boolean);
    if (contratos.length) {
      await adm().from("contrato_eventos").delete().in("contrato_id", contratos);
      await adm().from("contratos_checkin").delete().in("contrato_id", contratos);
      await adm().from("pagamentos_bloco").delete().in("contrato_id", contratos);
      await adm().from("contrato_blocos").delete().in("contrato_id", contratos);
      await adm().from("contratos").delete().in("id", contratos);
    }
    await adm().from("automacoes_envios").delete().in("usuario_id", [ids.ana, ids.beto, ids.caio, ids.duda, ids.eva, ids.dono].filter(Boolean));
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.dono, ids.ana, ids.beto, ids.caio, ids.duda, ids.eva]);
  });

  test("1. a rotina diária roda de verdade (não simulada) e a de check-in também", async () => {
    respostaAutomacoes = await rodar("/api/cron/automacoes");
    console.log(`t586 automacoes: ${JSON.stringify(respostaAutomacoes.enviados)} simulado=${respostaAutomacoes.simulado}`);
    expect(respostaAutomacoes.simulado, "com AUTOMACOES_ATIVO=1 a rotina envia").toBe(false);
    respostaCheckin = await rodar("/api/cron/checkin-lembretes");
    console.log(`t586 checkin-lembretes: ${JSON.stringify(respostaCheckin)}`);
  });

  test("2. D-7 completo (assinado + pago): a Ana recebe 'instruções liberadas' com o caminho das instruções", async () => {
    await expect.poll(async () => (await comAssunto(ana.email, LIBERADAS)).length, { timeout: 30_000, message: "e-mail da Ana" }).toBe(1);
    const [e] = await comAssunto(ana.email, LIBERADAS);
    const corpo = String(e.corpo ?? "");
    console.log(`t586 E-MAIL estadia_instrucoes_liberadas\n  para: ${e.para}\n  de: ${e.de}\n  assunto: ${e.assunto}\n  corpo: ${corpo}`);
    expect(String(e.assunto)).toContain(LIBERADAS);
    expect(corpo, "saudação pelo primeiro nome").toContain("Olá Ana");
    expect(corpo).toContain("Como entrar, o Wi-Fi e as regras do prédio já estão na página da estadia.");
    expect(corpo, "o botão leva às instruções da estadia").toContain(`/dashboard/estadia/${ids.A}#instrucoes`);
    // Só o morador: o dono não recebe este aviso.
    expect(await comAssunto(dono.email, LIBERADAS), "o dono não recebe o aviso do morador").toHaveLength(0);
    // O evento da liberação fica no histórico do contrato.
    const { data: ev } = await adm().from("contrato_eventos").select("tipo, dados").eq("contrato_id", ids.A).eq("tipo", "instrucoes_liberadas");
    expect(ev, "contrato_eventos.instrucoes_liberadas").toHaveLength(1);
  });

  test("2b. o e-mail do D-7 traz o imóvel, a data e as instruções de chegada no corpo (E209)", async () => {
    const [e] = await comAssunto(ana.email, LIBERADAS);
    const corpo = String(e?.corpo ?? "");
    expect(corpo, "o imóvel").toContain(titulo("A"));
    expect(corpo, "a data da entrada").toContain(`Entrada em ${br(emDias(7))}.`);
    expect(corpo).toContain("Instruções de chegada");
    expect(corpo, "como entrar").toContain(INSTRUCOES.como_entrar);
    expect(corpo, "Wi-Fi").toContain(INSTRUCOES.wifi_rede);
    expect(corpo, "senha do Wi-Fi").toContain(INSTRUCOES.wifi_senha);
  });

  test("3. D-7 sem o 1º pagamento (B) e sem a assinatura do morador (C): ninguém recebe", async () => {
    expect(await comAssunto(beto.email, LIBERADAS), "B: sem o 1º pagamento").toHaveLength(0);
    expect(await comAssunto(caio.email, LIBERADAS), "C: sem a assinatura do morador").toHaveLength(0);
    const { data: ev } = await adm().from("contrato_eventos").select("contrato_id").in("contrato_id", [ids.B, ids.C]).eq("tipo", "instrucoes_liberadas");
    expect(ev ?? []).toHaveLength(0);
  });

  test("4. D-2 assinado e pago (D): dono e morador recebem o lembrete da entrada com a data", async () => {
    await expect.poll(async () => (await comAssunto(duda.email, LEMBRETE)).length, { timeout: 30_000, message: "lembrete da Duda" }).toBe(1);
    const [m] = await comAssunto(duda.email, LEMBRETE);
    const doDono = (await comAssunto(dono.email, LEMBRETE)).filter((l) => String(l.corpo ?? "").includes(`/dashboard/contratos/${ids.D}`));
    for (const [quem, e] of [["morador", m], ["dono", doDono[0]]] as const) {
      if (e) console.log(`t586 E-MAIL checkin_lembrete (${quem})\n  para: ${e.para}\n  de: ${e.de}\n  assunto: ${e.assunto}\n  corpo: ${e.corpo}`);
    }
    expect(doDono, "o dono recebe o lembrete do contrato D").toHaveLength(1);
    for (const e of [m, doDono[0]]) {
      const corpo = String(e.corpo ?? "");
      expect(corpo).toContain("a entrada no imóvel do seu contrato está chegando");
      expect(corpo, "o botão leva ao contrato").toContain(`/dashboard/contratos/${ids.D}`);
    }
    const { data: ck } = await adm().from("contratos_checkin").select("lembrete_48h_em").eq("contrato_id", ids.D).single();
    expect(ck?.lembrete_48h_em, "contratos_checkin.lembrete_48h_em marcado").toBeTruthy();
  });

  test("4b. o lembrete do D-2 traz o imóvel e a data; as instruções só no e-mail do morador (E209)", async () => {
    const [m] = await comAssunto(duda.email, LEMBRETE);
    const [d] = (await comAssunto(dono.email, LEMBRETE)).filter((l) => String(l.corpo ?? "").includes(`/dashboard/contratos/${ids.D}`));
    for (const e of [m, d]) {
      const corpo = String(e?.corpo ?? "");
      expect(corpo, "o imóvel").toContain(titulo("D"));
      expect(corpo, "a data da entrada").toContain(`A entrada no imóvel é em ${br(emDias(2))}.`);
    }
    expect(String(m?.corpo ?? ""), "morador: as instruções").toContain(INSTRUCOES.como_entrar);
    expect(String(d?.corpo ?? ""), "dono: sem as instruções").not.toContain(INSTRUCOES.wifi_senha);
  });

  test("5. D-2 assinado SEM o 1º pagamento (E): o lembrete de entrada não sai (E209)", async () => {
    const daEva = await comAssunto(eva.email, LEMBRETE);
    if (daEva[0]) console.log(`t586 E-MAIL checkin_lembrete SEM pagamento (contrato E)\n  para: ${daEva[0].para}\n  assunto: ${daEva[0].assunto}\n  corpo: ${daEva[0].corpo}`);
    expect(daEva, "contrato sem o 1º pagamento").toHaveLength(0);
    expect((await comAssunto(dono.email, LEMBRETE)).filter((l) => String(l.corpo ?? "").includes(`/dashboard/contratos/${ids.E}`)), "nem o dono").toHaveLength(0);
  });

  test("6. rodar de novo não repete nenhum e-mail (uma vez por pessoa)", async () => {
    await rodar("/api/cron/automacoes");
    await rodar("/api/cron/checkin-lembretes");
    const linhas = [
      ...(await comAssunto(ana.email, LIBERADAS)),
      ...(await comAssunto(duda.email, LEMBRETE)),
      ...(await comAssunto(beto.email, LIBERADAS)),
      ...(await comAssunto(caio.email, LIBERADAS)),
    ];
    expect(linhas.filter((l) => l.para === ana.email), "Ana: 1 só").toHaveLength(1);
    expect(linhas.filter((l) => l.para === duda.email), "Duda: 1 só").toHaveLength(1);
    expect(linhas.filter((l) => l.para === beto.email || l.para === caio.email), "B e C seguem sem e-mail").toHaveLength(0);
    // Transcrição completa para o relatório.
    const todos = (await lerSaida()).filter((l) => l.servico === "email" && [dono, ana, beto, caio, duda, eva].some((c) => c.email === l.para));
    await writeFile(`${SAIDA}/t586-emails.json`, JSON.stringify({ hoje: hojeBRT(), contratos: { A: ids.A, B: ids.B, C: ids.C, D: ids.D, E: ids.E }, automacoes: respostaAutomacoes, checkin: respostaCheckin, emails: todos }, null, 2));
    console.log(`t586 TODOS OS E-MAILS DO CENÁRIO (${todos.length}):\n${todos.map((l) => JSON.stringify(l)).join("\n")}`);
  });
});
