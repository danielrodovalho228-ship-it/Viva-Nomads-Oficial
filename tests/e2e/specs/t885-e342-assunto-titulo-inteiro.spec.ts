import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T885 — E342 (#1923, Pista B): no ASSUNTO REAL do aviso "proposta vencendo" mandado pelo cron, o nome do imóvel vai
  INTEIRO — nunca cortado no meio ("Automaçõ…"). Título de 29 caracteres: não cabe na forma normal ("Proposta de
  <título> vence em dd/mm às hh:mm", 65 + a marca) e cabe inteiro na compacta ("Proposta vence dd/mm HHh: <título>"),
  em até 70 caracteres com " · Viva Nomads", sem reticências.
  Como a t597/t712: um 2º servidor do MESMO build do laboratório (porta 3185), com um CRON_SECRET só dele e
  AUTOMACOES_ATIVO=1 só no processo dele — nenhuma configuração de ambiente muda. Contas do laboratório marcadas como de
  teste: o e-mail cai em emails_teste (o texto do e-mail), lido aqui.
*/
const SAIDA = "tests/laboratorio/saida";
const PORTA = 3185;
const SEGREDO = `lab-t885-${Math.random().toString(36).slice(2)}`;
const senha = novaSenha();
const sufixo = novoSufixo();
const TITULO = `[TESTE QA] Studio E342 ${sufixo}`;
const ids: { dono?: string; inq?: string; imovel?: string; proposta?: string; lead?: string } = {};
let servidor: ChildProcess | null = null;
let validaAte = "";

async function conta(quem: string, nome: string, role: "owner" | "tenant") {
  const id = await criarConta({ email: `${quem}.t885.${sufixo}@lab.vivanomads.test`, nome, role }, senha);
  await adm().from("profiles").update({ is_teste: true }).eq("id", id);
  return id;
}

async function caixa(usuarioId: string, evento: string): Promise<{ assunto: string; corpo: string }[]> {
  const { data } = await adm().from("emails_teste").select("assunto, corpo").eq("usuario_id", usuarioId).eq("evento", evento).order("criado_em");
  return (data ?? []).map((d) => ({ assunto: String(d.assunto ?? ""), corpo: String(d.corpo ?? "") }));
}

async function rodarCron() {
  const r = await fetch(`http://localhost:${PORTA}/api/cron/automacoes`, { headers: { authorization: `Bearer ${SEGREDO}` } });
  const corpo = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  expect(r.status, JSON.stringify(corpo)).toBe(200);
  expect(corpo.simulado).toBe(false);
}

test.describe("T885 — E342: o assunto real do proposta_vencendo leva o título inteiro", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    test.setTimeout(180_000);
    ids.dono = await conta("dono", "Dora Proposta", "owner");
    ids.inq = await conta("inq", "Ivo Proposta", "tenant");
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true, preco: 3200 });
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel);
    // Vence na hora cheia daqui a ~5 h (dentro das 24 h do aviso; hora cheia = "22h" na forma curta do assunto).
    const prazo = new Date(Date.now() + 5 * 3_600_000);
    prazo.setUTCMinutes(0, 0, 0);
    validaAte = prazo.toISOString();
    const { data: numero } = await adm().rpc("next_document_number", { p_type: "orcamento", p_year: new Date().getFullYear() });
    const { data: p, error } = await adm()
      .from("propostas")
      .insert({ numero, lead_id: ids.lead, property_id: ids.imovel, owner_id: ids.dono, tenant_id: ids.inq, status: "enviada", versao_atual: 1, validade_dias: 7, valida_ate: validaAte })
      .select("id")
      .single();
    if (error) throw error;
    ids.proposta = p.id as string;
    // A última versão é do dono: a vez (e o aviso) é do morador.
    const entrada = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
    const { error: ev } = await adm().from("proposta_versoes").insert({
      proposta_id: p.id, versao: 1, autor: "owner", valor_base: 3200, valor_mensal: 3200, meses: 4, data_entrada: entrada, total_mensal: 3200, total_contrato: 12800,
    });
    if (ev) throw ev;
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    if (ids.proposta) {
      await adm().from("proposta_versoes").delete().eq("proposta_id", ids.proposta);
      await adm().from("propostas").delete().eq("id", ids.proposta);
    }
    const pessoas = [ids.dono, ids.inq].filter(Boolean) as string[];
    if (pessoas.length) {
      await adm().from("automacoes_envios").delete().in("usuario_id", pessoas);
      await adm().from("emails_teste").delete().in("usuario_id", pessoas);
    }
    await apagarContas(pessoas);
  });

  test("o cron manda 'Proposta vence dd/mm HHh: <título inteiro> · Viva Nomads', em até 70 caracteres, sem '…'", async () => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    mkdirSync(SAIDA, { recursive: true });
    const log = createWriteStream(`${SAIDA}/t885-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, AUTOMACOES_ATIVO: "1", PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/automacoes`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);

    await rodarCron();
    await expect.poll(async () => (await caixa(ids.inq!, "proposta_vencendo")).filter((m) => m.corpo.includes(TITULO)).length, { timeout: 30_000, message: "proposta_vencendo do morador" }).toBeGreaterThanOrEqual(1);
    const email = (await caixa(ids.inq!, "proposta_vencendo")).filter((m) => m.corpo.includes(TITULO)).at(-1)!;
    console.log(`t885|assunto|${email.assunto}`);
    console.log(`t885|corpo|${email.corpo.replace(/\n/g, " ⏎ ")}`);
    const p = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date(validaAte));
    const v = (k: string) => p.find((x) => x.type === k)?.value ?? "";
    expect(email.assunto, "forma compacta com o título inteiro").toBe(`Proposta vence ${v("day")}/${v("month")} ${v("hour")}h: ${TITULO} · Viva Nomads`);
    expect(email.assunto.length, "assunto em até 70 caracteres").toBeLessThanOrEqual(70);
    expect(email.assunto, "nenhum corte com reticências").not.toContain("…");
  });
});
