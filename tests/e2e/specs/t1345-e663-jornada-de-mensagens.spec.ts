import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, lerSaida, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1345 — E663 (draft #3089): a jornada de mensagens da estadia sai de verdade pela rotina diária (/api/cron/automacoes),
  só nas condições certas, e UMA vez. Como a t586, sobe um 2º servidor do mesmo build (porta 3125) com segredo próprio.
   A. entrada HOJE, assinado agora, 1º pagamento: o morador recebe "Contrato assinado: envie seus documentos" e
      "Hoje é o dia da entrada"; o dono recebe "Hoje é o dia da entrada" (e não a confirmação, que é do morador);
   B. entrada HOJE, assinado agora, SEM pagamento: o morador recebe só a confirmação — a chegada não sai, nem para o dono;
   C. saída daqui a 7 dias, assinado há 10 dias, pago: morador e dono recebem "A saída é daqui a uma semana"; ninguém
      recebe a confirmação (fora da janela);
   Rodar a rotina de novo não repete nada. Os e-mails não levam telefone nem endereço de e-mail de terceiros.
  Spec preparada sobre a branch do draft; só roda verde com o E663 presente.
*/
const SAIDA = "tests/laboratorio/saida";
const PORTA = 3125;
const SEGREDO = `lab-t1345-${Math.random().toString(36).slice(2)}`;
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = (quem: string, nome: string, role: "owner" | "tenant") => ({ email: `${quem}.t1345.${sufixo}@lab.vivanomads.test`, nome, role });
const dono = conta("dono", "Dora Jornada", "owner");
const ana = conta("ana", "Ana Chegada Paga", "tenant"); // A
const beto = conta("beto", "Beto Sem Pagamento", "tenant"); // B
const caio = conta("caio", "Caio Saida Semana", "tenant"); // C
const ids: Record<string, string> = {};
const hojeBRT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const emDias = (n: number) => new Date(Date.parse(hojeBRT()) + n * 86_400_000).toISOString().slice(0, 10);
const CONFIRMACAO = "Contrato assinado: envie seus documentos";
const CHEGADA = "Hoje é o dia da entrada";
const SEMANA = "A saída é daqui a uma semana";
let servidor: ChildProcess | null = null;

async function contrato(o: { letra: string; inquilino: string; inicio: string; fim: string; assinadoHaDias: number; pago: boolean }): Promise<string> {
  const imovel = await criarImovelPronto(ids.dono, `Studio jornada ${o.letra} t1345 ${sufixo}`, { ativo: true });
  const lead = await criarLead(ids.dono, o.inquilino, imovel, true);
  const quando = new Date(Date.now() - o.assinadoHaDias * 86_400_000).toISOString();
  const { data, error } = await adm()
    .from("contratos")
    .insert({ property_id: imovel, tenant_id: o.inquilino, lead_id: lead, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1, status: "ativo", garantia: "caucao", assinado_proprietario_em: quando, assinado_inquilino_em: quando })
    .select("id")
    .single();
  if (error) throw error;
  const { data: bloco, error: e2 } = await adm().from("contrato_blocos").insert({ contrato_id: data.id, numero_bloco: 1, inicio: o.inicio, fim: o.fim, meses: 2, valor: 6400, caucao: 3200, status: "ativo" }).select("id").single();
  if (e2) throw e2;
  if (o.pago) {
    const { error: e3 } = await adm().from("pagamentos_bloco").insert({ bloco_id: bloco.id, contrato_id: data.id, tipo: "aluguel", valor: 3200, data_pagamento: hojeBRT(), marcado_por: ids.dono, confirmado_pelo_inquilino: true, confirmado_em: new Date().toISOString() });
    if (e3) throw e3;
  }
  return data.id as string;
}
async function rodar(): Promise<Record<string, unknown>> {
  const r = await fetch(`http://localhost:${PORTA}/api/cron/automacoes`, { headers: { authorization: `Bearer ${SEGREDO}` } });
  const corpo = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  expect(r.status, JSON.stringify(corpo)).toBe(200);
  return corpo;
}
const emails = async (para: string, assunto: string, contratoId: string) =>
  (await lerSaida()).filter((l) => l.servico === "email" && l.para === para && String(l.assunto ?? "").includes(assunto) && String(l.corpo ?? "").includes(`/dashboard/estadia/${contratoId}`));

test.describe("T1345 — E663: a jornada de mensagens da estadia", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.skip(!existsSync(".next/BUILD_ID") || !process.env.LAB_OUTBOX, "Precisa do build do laboratório (next start) e do LAB_OUTBOX.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    ids.dono = await criarConta(dono, senha);
    for (const [k, c] of Object.entries({ ana, beto, caio })) ids[k] = await criarConta(c, senha);
    ids.A = await contrato({ letra: "A", inquilino: ids.ana, inicio: emDias(0), fim: emDias(59), assinadoHaDias: 0, pago: true });
    ids.B = await contrato({ letra: "B", inquilino: ids.beto, inicio: emDias(0), fim: emDias(59), assinadoHaDias: 0, pago: false });
    ids.C = await contrato({ letra: "C", inquilino: ids.caio, inicio: emDias(-52), fim: emDias(7), assinadoHaDias: 10, pago: true });
    const log = createWriteStream(`${SAIDA}/t1345-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, AUTOMACOES_ATIVO: "1", PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/automacoes`).catch(() => null))?.status ?? 0, { timeout: 90_000, message: "o 2º servidor subir" }).toBe(401);
  });
  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    const contratos = [ids.A, ids.B, ids.C].filter(Boolean);
    if (contratos.length) {
      await adm().from("contrato_eventos").delete().in("contrato_id", contratos);
      await adm().from("pagamentos_bloco").delete().in("contrato_id", contratos);
      await adm().from("contrato_blocos").delete().in("contrato_id", contratos);
      await adm().from("contratos").delete().in("id", contratos);
    }
    await adm().from("automacoes_envios").delete().in("usuario_id", [ids.ana, ids.beto, ids.caio, ids.dono].filter(Boolean));
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.dono, ids.ana, ids.beto, ids.caio]);
  });

  test("1. a rotina roda de verdade (não simulada)", async () => {
    const r = await rodar();
    expect(r.simulado, "com AUTOMACOES_ATIVO=1 a rotina envia").toBe(false);
  });

  test("2. A (entrada hoje, pago): morador recebe confirmação e chegada; dono recebe a chegada", async () => {
    await expect.poll(async () => (await emails(ana.email, CHEGADA, ids.A)).length, { timeout: 30_000, message: "chegada da Ana" }).toBe(1);
    expect(await emails(ana.email, CONFIRMACAO, ids.A)).toHaveLength(1);
    expect(await emails(dono.email, CHEGADA, ids.A), "o dono recebe a chegada").toHaveLength(1);
    expect(await emails(dono.email, CONFIRMACAO, ids.A), "a confirmação é só do morador").toHaveLength(0);
    const [conf] = await emails(ana.email, CONFIRMACAO, ids.A);
    const corpo = String(conf.corpo ?? "");
    expect(corpo).toContain("plataforma");
    expect(corpo, "sem telefone").not.toMatch(/\(\d{2}\)\s?\d|\d{4,5}-\d{4}/);
    expect(corpo, "sem e-mail de terceiros").not.toContain(dono.email);
  });

  test("3. B (entrada hoje, SEM pagamento): só a confirmação; a chegada não sai", async () => {
    expect(await emails(beto.email, CONFIRMACAO, ids.B)).toHaveLength(1);
    expect(await emails(beto.email, CHEGADA, ids.B), "sem o 1º pagamento, sem chegada").toHaveLength(0);
    expect(await emails(dono.email, CHEGADA, ids.B), "nem para o dono").toHaveLength(0);
  });

  test("4. C (saída em 7 dias, assinado há 10, pago): semana da saída para os dois; sem confirmação", async () => {
    expect(await emails(caio.email, SEMANA, ids.C)).toHaveLength(1);
    expect(await emails(dono.email, SEMANA, ids.C)).toHaveLength(1);
    expect(await emails(caio.email, CONFIRMACAO, ids.C), "fora da janela da confirmação").toHaveLength(0);
  });

  test("5. rodar a rotina de novo não repete nenhum aviso", async () => {
    await rodar();
    expect(await emails(ana.email, CHEGADA, ids.A)).toHaveLength(1);
    expect(await emails(ana.email, CONFIRMACAO, ids.A)).toHaveLength(1);
    expect(await emails(caio.email, SEMANA, ids.C)).toHaveLength(1);
    expect(await emails(dono.email, SEMANA, ids.C)).toHaveLength(1);
  });
});
