import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2137 — E759 @E759: a confirmação da estadia confirmada, o D-7 e as datas de uma fonte só (os blocos).
  Regra decidida (E759; unitário src/lib/estadia/e759-jornada-quatro-momentos.test.ts):
    1. confirmação: a estadia CONFIRMADA (assinada pelas duas partes + 1º pagamento) que ainda não começou recebe
       "Seu contrato está assinado. Entrada em DD/MM/AAAA, saída em DD/MM/AAAA.", mesmo assinada há semanas. Sem o 1º
       pagamento (e fora da janela da assinatura), não recebe. Estadia que já começou, também não;
    2. D-7: 7 dias antes da entrada, com o 1º pagamento → "Falta uma semana para a entrada (DD/MM/AAAA, a partir das HH:MM).";
    3. fonte única: as datas saem dos BLOCOS da estadia. Com dois blocos, a saída da confirmação é a do último —
       E1089 (coordenador): a SAÍDA é o dia seguinte ao fim gravado (a última noite).
  O cron das automações sobe num 2º servidor do mesmo build (porta 3133), com um CRON_SECRET só dele e
  AUTOMACOES_ATIVO=1 (padrão do t597 e do t2130). Leitura na caixa de testes. Datas e textos esperados escritos aqui.
  O t2136 cobre a chegada, a semana da saída e o meio (E663). Esta spec não os repete.
*/
const PORTA = 3133;
const SEGREDO = `lab-t2137-${Math.random().toString(36).slice(2)}`;
const SAIDA_LOG = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: Record<string, string> = {};
const contratos: string[] = [];
const datas: Record<string, { entrada: string; fim: string }> = {};
let servidor: ChildProcess | null = null;
const hojeBRT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const somar = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);
const dataBR = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

async function conta(quem: string, nome: string, role: "owner" | "tenant") {
  const id = await criarConta({ email: `${quem}.t2137.${sufixo}@lab.vivanomads.test`, nome, role }, senha);
  await adm().from("profiles").update({ is_teste: true }).eq("id", id);
  return id;
}

/** Contrato assinado há 40 dias; blocos [inicio, fim, status][]; com ou sem o 1º pagamento confirmado. */
async function estadia(letra: string, inquilino: string, blocos: [string, string, string][], pago: boolean) {
  const imovel = await criarImovelPronto(ids.dono, `Casa Confirma ${letra} ${sufixo}`, { ativo: true, preco: 3200 });
  await adm().from("properties").update({ address: "Centro", city: "Uberlândia", checkin_after: "14:00", checkout_before: "11:00" }).eq("id", imovel);
  const lead = await criarLead(ids.dono, inquilino, imovel, true);
  const assinado = new Date(Date.now() - 40 * 86_400_000).toISOString();
  const { data: c, error } = await adm()
    .from("contratos")
    .insert({ property_id: imovel, tenant_id: inquilino, lead_id: lead, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 90, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1, capacidade_snapshot: 2, status: "ativo", garantia: "caucao", assinado_proprietario_em: assinado, assinado_inquilino_em: assinado })
    .select("id")
    .single();
  if (error) throw error;
  contratos.push(c.id as string);
  let primeiro: string | null = null;
  for (const [i, [inicio, fim, status]] of blocos.entries()) {
    const { data: b, error: eb } = await adm().from("contrato_blocos").insert({ contrato_id: c.id, numero_bloco: i + 1, inicio, fim, meses: 2, valor: 6400, caucao: i === 0 ? 3200 : 0, status, aceite_proprietario_em: assinado, aceite_inquilino_em: assinado }).select("id").single();
    if (eb) throw eb;
    if (i === 0) primeiro = b.id as string;
  }
  if (pago) await adm().from("pagamentos_bloco").insert({ bloco_id: primeiro, contrato_id: c.id, tipo: "aluguel", valor: 6400, data_pagamento: blocos[0][0], marcado_por: ids.dono, confirmado_pelo_inquilino: true, confirmado_em: assinado });
  datas[letra] = { entrada: blocos[0][0], fim: blocos.map((b) => b[1]).sort().at(-1)! };
  return c.id as string;
}

async function caixa(usuarioId: string, evento: string): Promise<string[]> {
  const { data } = await adm().from("emails_teste").select("corpo").eq("usuario_id", usuarioId).eq("evento", evento);
  return (data ?? []).map((d) => String(d.corpo ?? ""));
}

test.describe("T2137 — E759: confirmação só da estadia confirmada que não começou, o D-7, e as datas dos blocos @E759", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  test.beforeAll(async () => {
    test.setTimeout(180_000);
    ids.dono = await conta("dono", "Dirce Confirma", "owner");
    for (const k of ["conf", "sempag", "comecou", "dsete"]) ids[k] = await conta(k, `${k[0].toUpperCase()}${k.slice(1)} Morador`, "tenant");
    const hoje = hojeBRT();
    // 1 + 3: confirmada e paga, entra daqui a 10 dias, DOIS blocos (a saída é o fim do 2º)
    await estadia("conf", ids.conf, [[somar(hoje, 10), somar(hoje, 69), "ativo"], [somar(hoje, 70), somar(hoje, 99), "agendado"]], true);
    // controles da confirmação: sem pagamento; já começou
    await estadia("sempag", ids.sempag, [[somar(hoje, 10), somar(hoje, 69), "ativo"]], false);
    await estadia("comecou", ids.comecou, [[somar(hoje, -5), somar(hoje, 54), "ativo"]], true);
    // 2: D-7
    await estadia("dsete", ids.dsete, [[somar(hoje, 7), somar(hoje, 66), "ativo"]], true);
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    if (contratos.length) {
      await adm().from("pagamentos_bloco").delete().in("contrato_id", contratos);
      await adm().from("contrato_eventos").delete().in("contrato_id", contratos);
      await adm().from("contrato_blocos").delete().in("contrato_id", contratos);
      await adm().from("contratos").delete().in("id", contratos);
    }
    const pessoas = ["dono", "conf", "sempag", "comecou", "dsete"].map((k) => ids[k]).filter(Boolean);
    await adm().from("automacoes_envios").delete().in("usuario_id", pessoas);
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas(pessoas);
  });

  test("confirmação com a saída do último bloco; sem pagamento ou já começada, nada; o D-7 na data", async () => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    const log = createWriteStream(`${SAIDA_LOG}/t2137-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, AUTOMACOES_ATIVO: "1", PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/automacoes`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);
    const r = await fetch(`http://localhost:${PORTA}/api/cron/automacoes`, { headers: { authorization: `Bearer ${SEGREDO}` } });
    const corpo = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    expect(r.status, JSON.stringify(corpo)).toBe(200);
    expect(corpo.simulado).toBe(false);

    // 1 + 3: confirmação, com a saída do ÚLTIMO bloco
    const frase = `Seu contrato está assinado. Entrada em ${dataBR(datas.conf.entrada)}, saída em ${dataBR(somar(datas.conf.fim, 1))}.`;
    await expect.poll(async () => (await caixa(ids.conf, "jornada_confirmacao")).some((t) => t.includes(frase)), { timeout: 30_000, message: `confirmação: "${frase}"` }).toBe(true);
    expect((await caixa(ids.conf, "jornada_confirmacao")).join("\n"), "documentos pela plataforma, sem canal de fora").toMatch(/envie seus documentos pela plataforma/);

    // 2: D-7
    const d7 = `Falta uma semana para a entrada (${dataBR(datas.dsete.entrada)}, a partir das 14:00).`;
    await expect.poll(async () => (await caixa(ids.dsete, "jornada_d7")).some((t) => t.includes(d7)), { timeout: 30_000, message: `D-7: "${d7}"` }).toBe(true);

    // controles: sem pagamento e já começada não recebem a confirmação
    expect(await caixa(ids.sempag, "jornada_confirmacao"), "sem o 1º pagamento (assinado há 40 dias): sem confirmação").toHaveLength(0);
    expect(await caixa(ids.comecou, "jornada_confirmacao"), "estadia já começada: sem confirmação atrasada").toHaveLength(0);
  });
});
