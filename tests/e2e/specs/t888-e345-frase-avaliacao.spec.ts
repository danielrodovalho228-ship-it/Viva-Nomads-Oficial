import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T888 — E345 (#1927, Pista B): o pedido de avaliação mandado pelo cron diz UMA frase só — "Sua avaliação leva 2 minutos
  e ajuda os próximos moradores e proprietários." — no corpo e no bloco do detalhe do MESMO e-mail. Antes, o corpo dizia
  "moradores e proprietários" e o detalhe só "moradores". Vale para as duas partes (dono e morador).
  Massa: contrato assinado pelas duas partes, ainda "ativo" (o cron só lê contratos ativos), com o último bloco
  terminado ONTEM (horário de Brasília) — o dia em que o cron pede a avaliação às duas partes.
  Como a t597/t712: um 2º servidor do MESMO build do laboratório (porta 3188), com um CRON_SECRET só dele e
  AUTOMACOES_ATIVO=1 só no processo dele — nenhuma configuração de ambiente muda. Contas do laboratório marcadas como de
  teste: os e-mails caem em emails_teste (o texto do e-mail), lidos aqui.
*/
const SAIDA = "tests/laboratorio/saida";
const PORTA = 3188;
const SEGREDO = `lab-t888-${Math.random().toString(36).slice(2)}`;
const senha = novaSenha();
const sufixo = novoSufixo();
const TITULO = `Studio E345 t888 ${sufixo}`;
const emails: Record<string, string> = {};
const ids: { dono?: string; inq?: string; imovel?: string; contrato?: string } = {};
let servidor: ChildProcess | null = null;

const hojeBRT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const somar = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);

async function conta(quem: string, nome: string, role: "owner" | "tenant") {
  emails[quem] = `${quem}.t888.${sufixo}@lab.vivanomads.test`;
  const id = await criarConta({ email: emails[quem], nome, role }, senha);
  await adm().from("profiles").update({ is_teste: true }).eq("id", id);
  return id;
}

async function caixa(usuarioId: string, evento: string): Promise<{ assunto: string; corpo: string }[]> {
  const { data } = await adm().from("emails_teste").select("assunto, corpo").eq("usuario_id", usuarioId).eq("evento", evento).order("criado_em");
  return (data ?? []).map((d) => ({ assunto: String(d.assunto ?? ""), corpo: String(d.corpo ?? "") }));
}

/** O pedido de avaliação que fala do imóvel desta spec (espera até 30 s). */
async function pedidoDe(usuarioId: string): Promise<{ assunto: string; corpo: string }> {
  await expect.poll(async () => (await caixa(usuarioId, "avaliacao_pedido")).filter((m) => m.corpo.includes(TITULO)).length, { timeout: 30_000, message: `avaliacao_pedido sobre ${TITULO}` }).toBeGreaterThanOrEqual(1);
  return (await caixa(usuarioId, "avaliacao_pedido")).filter((m) => m.corpo.includes(TITULO)).at(-1)!;
}

async function rodarCron() {
  const r = await fetch(`http://localhost:${PORTA}/api/cron/automacoes`, { headers: { authorization: `Bearer ${SEGREDO}` } });
  const corpo = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  expect(r.status, JSON.stringify(corpo)).toBe(200);
  expect(corpo.simulado).toBe(false);
}

test.describe("T888 — E345: uma frase só no pedido de avaliação (dono e morador)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    test.setTimeout(180_000);
    ids.dono = await conta("dono", "Dora Avaliacao", "owner");
    ids.inq = await conta("inq", "Ivo Avaliacao", "tenant");
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true, preco: 3200 });
    const lead = await criarLead(ids.dono, ids.inq, ids.imovel, true);
    const agora = new Date().toISOString();
    const fim = somar(hojeBRT(), -1);
    const inicio = somar(fim, -59);
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({ property_id: ids.imovel, tenant_id: ids.inq, lead_id: lead, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1, capacidade_snapshot: 3, status: "ativo", garantia: "caucao", assinado_proprietario_em: agora, assinado_inquilino_em: agora })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c.id as string;
    const { error: eb } = await adm().from("contrato_blocos").insert({ contrato_id: c.id, numero_bloco: 1, inicio, fim, meses: 2, valor: 6400, caucao: 3200, status: "ativo", aceite_proprietario_em: agora, aceite_inquilino_em: agora });
    if (eb) throw eb;
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    if (ids.contrato) {
      for (const t of ["avaliacoes", "pagamentos_bloco", "contrato_eventos", "contrato_blocos"]) await adm().from(t).delete().eq("contrato_id", ids.contrato);
      await adm().from("contratos").delete().eq("id", ids.contrato);
    }
    const pessoas = [ids.dono, ids.inq].filter(Boolean) as string[];
    if (pessoas.length) {
      await adm().from("automacoes_envios").delete().in("usuario_id", pessoas);
      await adm().from("emails_teste").delete().in("usuario_id", pessoas);
    }
    await apagarContas(pessoas);
  });

  test("cron do laboratório: o pedido de avaliação sai para as duas partes", async () => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    mkdirSync(SAIDA, { recursive: true });
    const log = createWriteStream(`${SAIDA}/t888-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, AUTOMACOES_ATIVO: "1", PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/automacoes`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);
    await rodarCron();
    for (const quem of ["dono", "inq"] as const) {
      const e = await pedidoDe(ids[quem]!);
      console.log(`t888|${quem}|assunto|${e.assunto}`);
      console.log(`t888|${quem}|corpo|${e.corpo.replace(/\n/g, " ⏎ ")}`);
    }
  });

  test("a mesma frase no corpo e no detalhe, para o dono e para o morador; nunca a versão só com 'moradores'", async () => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    const FRASE = "Sua avaliação leva 2 minutos e ajuda os próximos moradores e proprietários.";
    for (const quem of ["dono", "inq"] as const) {
      const { corpo } = await pedidoDe(ids[quem]!);
      expect(corpo.split(FRASE).length - 1, `${quem}: a frase no corpo e no detalhe (2 vezes, idêntica)`).toBe(2);
      expect(corpo, `${quem}: sem a versão antiga que parava em "moradores."`).not.toContain("próximos moradores.");
    }
  });
});
