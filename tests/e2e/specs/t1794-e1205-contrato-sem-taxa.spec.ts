import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";
import { categoriaDoEvento } from "../../../src/config/matriz-notificacoes";
import postgres from "postgres";

/*
  T1794 — E1205 @E1205 (ORDEM-DUET-979, 1012 e 1017; número dado na ORDEM-1017). Linha Proposta e contrato.
  O furo: a taxa só fica reservada quando a tela chama /api/comissao DEPOIS do registo do contrato; quem fecha a aba
  entre os dois passos deixa um contrato sem taxa. A varredura não cobra nada: o contrato entra na fila da Central
  ("Contrato sem taxa reservada", VN-CT · proposta · data) e o dono recebe UM aviso com a ligação para o assistente
  daquela estadia.
  Massa só no laboratório, contas de teste, uma dona com três contratos criados há 2 horas:
   - SEM TAXA: com proposta e sem a reserva da taxa (o caso);
   - RESERVADO: com proposta e com a reserva da taxa (fora);
   - LEGADO: sem proposta (fora do âmbito);
   - CANCELADO: com proposta e sem taxa, criado há 31 minutos, mas cancelado (ORDEM-DUET-1041, ajuste B do
     coordenador) → nem item na Central, nem aviso, nem e-mail. Só o contrato ATIVO entra.
  A rotina corre num 2º servidor do mesmo build (porta 3154, CRON_SECRET só dele; o padrão da t1753), duas vezes.
   1. A Central (admin) mostra o contrato SEM TAXA, com o VN-CT, a proposta e a data; os outros dois não aparecem.
   2. Depois de duas rodadas: UM e-mail e UM aviso no sino ao dono, só do contrato SEM TAXA, com a ligação para o
      assistente da estadia; nenhuma reserva nova (a rotina não cobra). (ORDEM-DUET-1039, V3/V3b) O dono lê o aviso e
      a rotina corre outra vez; depois resolve-o e corre outra vez: continua UM e-mail e UM aviso. A categoria é decisão.
   3. (ORDEM-DUET-1039, V1) Um contrato novo; a 1.ª rodada num servidor com o envio a falhar (o Resend falso fora do
      ar): a âncora fica gravada e nenhum e-mail é entregue; as rodadas seguintes, com o envio a funcionar, não gravam
      um 2.º aviso nem entregam um e-mail; o item continua na Central (o filtro é calculado na leitura).
   3b. (ORDEM-DUET-1039, V1 — a ordem) O notify também grava o aviso, em paralelo ao envio, por isso a falha do e-mail
      não separa "âncora antes" de "e-mail antes". O que separa é a gravação do aviso falhar: um gatilho temporário no
      banco do laboratório recusa o aviso de UM contrato da massa. Com a âncora antes, nenhum e-mail sai nessa rodada;
      na seguinte (gatilho retirado), um aviso e UM e-mail, e mais uma rodada não repete. Com o e-mail antes, sairiam dois.
   4. Com a taxa reservada, o item sai da Central sozinho.
  Nota: a rotina corre sobre o banco inteiro; contratos de outras specs nesta situação também recebem o seu aviso.
  Laboratório; não é prova ao vivo no site.
*/
const SAIDA = "tests/laboratorio/saida";
const PORTA = 3154;
// ORDEM-DUET-1039 (V1): um 2.º servidor da rotina com o Resend falso apontado para uma porta fechada — o envio falha.
const PORTA_FALHA = 3155;
const RESEND_FORA = "http://127.0.0.1:9";
const SEGREDO = `lab-t1794-${Math.random().toString(36).slice(2)}`;
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = (nome: string, quem: string, role: "owner" | "tenant") => ({ email: `${quem}.t1794.${sufixo}@lab.vivanomads.test`, nome, role });
const D = conta("Dalva Taxa Sobrenome", "dona", "owner");
const M = conta("Mirta Taxa Sobrenome", "mora", "tenant");
const ids: Record<string, string> = {};
const servidores: ChildProcess[] = [];
const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const HA_2H = new Date(Date.now() - 2 * 3_600_000).toISOString();
const vnct = (id: string) => `VN-CT-${id.slice(0, 8).toUpperCase()}`;
const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

async function proposta(lead: string, imovel: string): Promise<{ id: string; numero: string }> {
  const { data: numero } = await adm().rpc("next_document_number", { p_type: "orcamento", p_year: new Date().getFullYear() });
  const { data, error } = await adm()
    .from("propostas")
    .insert({ numero, lead_id: lead, property_id: imovel, owner_id: ids.D, tenant_id: ids.M, status: "contrato_assinado", versao_atual: 1, validade_dias: 7, valida_ate: `${emDias(7)}T23:00:00Z`, aceita_em: HA_2H })
    .select("id, numero")
    .single();
  if (error) throw error;
  const { error: ev } = await adm().from("proposta_versoes").insert({ proposta_id: data.id, versao: 1, autor: "owner", valor_base: 2800, valor_mensal: 2800, meses: 2, data_entrada: emDias(20), total_mensal: 2800, total_contrato: 5600, mensagem: "Proposta da t1794." });
  if (ev) throw ev;
  return { id: data.id as string, numero: data.numero as string };
}

async function contrato(lead: string, imovel: string, propostaId: string | null, inicio: number, extra: { status?: string; criadoEm?: string } = {}): Promise<string> {
  const { data, error } = await adm()
    .from("contratos")
    .insert({ lead_id: lead, property_id: imovel, tenant_id: ids.M, proposta_id: propostaId, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 60, aluguel_mensal: 2800, tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 672, qtd_ocupantes: 1, garantia: "caucao", status: extra.status ?? "ativo", periodo: `[${emDias(inicio)},${emDias(inicio + 59)}]`, created_at: extra.criadoEm ?? HA_2H })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

const emails = async () => ((await adm().from("emails_teste").select("assunto, corpo").eq("usuario_id", ids.D).eq("evento", "contrato_sem_taxa")).data ?? []) as { assunto: string; corpo: string }[];
const emailsDe = async (contrato: string) => (await emails()).filter((e) => e.corpo.includes(vnct(contrato)));
const avisos = async () => ((await adm().from("avisos").select("ref_id, url").eq("usuario_id", ids.D).eq("evento", "contrato_sem_taxa")).data ?? []) as { ref_id: string; url: string }[];
const avisosDe = async (contrato: string) => (await avisos()).filter((a) => a.ref_id === contrato);

/** Sobe um servidor do mesmo build só para a rotina (CRON_SECRET dele; `extra` muda o ambiente, ex.: o Resend fora). */
async function subirRotina(porta: number, extra: Record<string, string> = {}): Promise<() => Promise<{ encontrados?: number; avisados?: number }>> {
  const log = createWriteStream(`${SAIDA}/t1794-servidor-cron-${porta}.log`);
  const s = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(porta)], {
    env: { ...process.env, CRON_SECRET: SEGREDO, PORT: String(porta), ...extra },
    stdio: ["ignore", "pipe", "pipe"],
  });
  servidores.push(s);
  s.stdout?.pipe(log);
  s.stderr?.pipe(log);
  await expect.poll(async () => (await fetch(`http://localhost:${porta}/api/cron/contratos-sem-taxa`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);
  return async () => {
    const r = await fetch(`http://localhost:${porta}/api/cron/contratos-sem-taxa`, { headers: { authorization: `Bearer ${SEGREDO}` } });
    const corpo = (await r.json().catch(() => ({}))) as { ok?: boolean; encontrados?: number; avisados?: number };
    expect(r.status, JSON.stringify(corpo)).toBe(200);
    return corpo;
  };
}
let rodar: (() => Promise<{ encontrados?: number; avisados?: number }>) | null = null;
// ORDEM-DUET-1039 (V1, a ordem): o banco do laboratório pelo cliente JS do Postgres (o padrão da t1680/t1793), para um
// gatilho temporário que recusa a gravação do aviso de UM contrato da massa — a única falha que separa "âncora antes do
// e-mail" de "e-mail antes" (o notify também grava o aviso, em paralelo ao envio).
const DB = process.env.LAB_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const GATILHO = "t1794_recusa_aviso";
async function noBanco(f: (sql: postgres.Sql) => Promise<unknown>) {
  const sql = postgres(DB, { max: 1, onnotice: () => undefined });
  try {
    await f(sql);
  } finally {
    await sql.end();
  }
}
async function recusarAvisoDe(contrato: string) {
  await noBanco(async (sql) => {
    await sql.unsafe(`create or replace function public.${GATILHO}() returns trigger language plpgsql as $$ begin
      if new.ref_id = '${contrato}' then raise exception 't1794: a gravação do aviso falhou (simulada)'; end if; return new; end $$`);
    await sql.unsafe(`drop trigger if exists ${GATILHO} on public.avisos`);
    await sql.unsafe(`create trigger ${GATILHO} before insert on public.avisos for each row execute function public.${GATILHO}()`);
  });
}
async function voltarAGravarAvisos() {
  await noBanco(async (sql) => {
    await sql.unsafe(`drop trigger if exists ${GATILHO} on public.avisos`);
    await sql.unsafe(`drop function if exists public.${GATILHO}()`);
  });
}

test.beforeAll(async () => {
  if (!NO_LABORATORIO) return;
  ids.D = await criarConta(D, senha);
  ids.M = await criarConta(M, senha);
  await adm().from("profiles").update({ is_teste: true }).in("id", [ids.D, ids.M]);
  for (const k of ["Sem", "Res", "Leg", "Can"]) {
    ids[`im${k}`] = await criarImovelPronto(ids.D, `[TESTE QA] Taxa ${k} ${sufixo}`, { ativo: true, preco: 2800 });
    ids[`lead${k}`] = await criarLead(ids.D, ids.M, ids[`im${k}`], true);
  }
  const pSem = await proposta(ids.leadSem, ids.imSem);
  ids.orcSem = pSem.id;
  ids.numSem = pSem.numero;
  ids.ctSem = await contrato(ids.leadSem, ids.imSem, pSem.id, 20);
  const pRes = await proposta(ids.leadRes, ids.imRes);
  ids.orcRes = pRes.id;
  ids.ctRes = await contrato(ids.leadRes, ids.imRes, pRes.id, 100);
  const { error: eR } = await adm().from("cobrancas_fechamento").insert({ lead_id: ids.leadRes, tipo: "comissao", proposta_id: pRes.id });
  if (eR) throw eR;
  ids.ctLeg = await contrato(ids.leadLeg, ids.imLeg, null, 180);
  // ORDEM-DUET-1041 (ajuste B do coordenador): CANCELADO, com proposta e sem taxa há 31 minutos → fora.
  const pCan = await proposta(ids.leadCan, ids.imCan);
  ids.ctCan = await contrato(ids.leadCan, ids.imCan, pCan.id, 420, { status: "cancelado", criadoEm: new Date(Date.now() - 31 * 60_000).toISOString() });
});

test.afterAll(async () => {
  for (const s of servidores) s.kill("SIGTERM");
  if (NO_LABORATORIO) await voltarAGravarAvisos().catch(() => undefined);
  const leads = [ids.leadSem, ids.leadRes, ids.leadLeg, ids.leadCan, ids.leadFal, ids.leadAnc].filter(Boolean);
  const contratos = [ids.ctSem, ids.ctRes, ids.ctLeg, ids.ctCan, ids.ctFal, ids.ctAnc].filter(Boolean);
  if (ids.D) await adm().from("emails_teste").delete().eq("usuario_id", ids.D);
  if (contratos.length) await adm().from("avisos").delete().in("ref_id", contratos);
  if (leads.length) {
    await adm().from("cobrancas_fechamento").delete().in("lead_id", leads);
    await adm().from("contratos").delete().in("lead_id", leads);
    await adm().from("propostas").delete().in("lead_id", leads);
    await adm().from("leads").delete().in("id", leads);
  }
  const imoveis = [ids.imSem, ids.imRes, ids.imLeg, ids.imCan, ids.imFal, ids.imAnc].filter(Boolean);
  if (imoveis.length) await adm().from("properties").delete().in("id", imoveis);
  await apagarContas([ids.D, ids.M].filter(Boolean));
});

test.describe("T1794 — E1205: o contrato sem taxa reservada vai à Central e avisa o dono uma vez @E1205", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test("1. a Central mostra o contrato sem taxa (VN-CT · proposta · data); os outros dois não aparecem", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    await p.goto("/admin/pendencias?filtro=contratos_sem_taxa", { waitUntil: "domcontentloaded" });
    const linhas = p.locator('[data-testid="central-linha"][data-filtro="contratos_sem_taxa"]');
    const nossa = linhas.filter({ hasText: vnct(ids.ctSem) });
    await expect(nossa).toHaveCount(1, { timeout: 30_000 });
    await expect(nossa).toContainText("Contrato sem taxa reservada");
    await expect(nossa).toContainText(`${vnct(ids.ctSem)} · ${ids.numSem} · ${dataBR(HA_2H)}`);
    await expect(nossa.getByRole("link", { name: "Ver contrato" })).toHaveAttribute("href", `/admin/contratos/${ids.ctSem}`);
    await expect(linhas.filter({ hasText: vnct(ids.ctRes) }), "com a taxa reservada: fora").toHaveCount(0);
    await expect(linhas.filter({ hasText: vnct(ids.ctLeg) }), "sem proposta: fora do âmbito").toHaveCount(0);
    await expect(linhas.filter({ hasText: vnct(ids.ctCan) }), "cancelado (com proposta, sem taxa, 31 min): fora da Central").toHaveCount(0);
    await p.screenshot({ path: `${SAIDA}/t1794-central-1280.png`, fullPage: true });
    await ctx.close();
  });

  test("2. a rotina: um e-mail e um aviso ao dono, para o assistente da estadia; lido e depois resolvido, nunca se repete; categoria decisão; nada cobrado", async () => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    expect(await emailsDe(ids.ctSem), "antes da rotina: nenhum e-mail").toHaveLength(0);
    rodar = await subirRotina(PORTA);
    expect((await rodar()).encontrados ?? 0, "a rotina encontrou pelo menos o contrato sem taxa").toBeGreaterThanOrEqual(1);
    await rodar();

    await expect.poll(async () => (await emailsDe(ids.ctSem)).length, { timeout: 30_000, message: "um e-mail ao dono, mesmo com 2 rodadas" }).toBe(1);
    const email = (await emailsDe(ids.ctSem))[0];
    expect(email.assunto).toMatch(/^Falta concluir o fechamento — \[TESTE QA\] Taxa Sem/);
    expect(email.corpo).toContain(`O contrato ${vnct(ids.ctSem)} (proposta ${ids.numSem}) foi gerado, mas o fechamento não terminou: falta a etapa da taxa de serviço. Abra o fechamento da estadia para concluir.`);
    expect(email.corpo).toContain("Concluir o fechamento");
    // A ligação para o assistente da estadia (o "&" pode vir escapado no HTML do e-mail).
    expect(email.corpo).toMatch(new RegExp(`/dashboard/fechamento\\?c=${ids.leadSem}&(amp;)?p=${ids.orcSem}`));
    const sino = await avisosDe(ids.ctSem);
    expect(sino, "um aviso no sino do contrato sem taxa").toHaveLength(1);
    expect(sino[0].url).toBe(`/dashboard/fechamento?c=${ids.leadSem}&p=${ids.orcSem}`);
    // ORDEM-DUET-1039 (V3/V3b): o dono LÊ o aviso; a rotina corre outra vez — continua um e-mail e um aviso.
    // (O sino marca "lido" e "resolvido" nestas colunas; aqui o gesto do dono é gravado pelo serviço.)
    expect((await adm().from("avisos").update({ lido_em: new Date().toISOString() }).eq("usuario_id", ids.D).eq("ref_id", ids.ctSem)).error).toBeNull();
    await rodar();
    expect(await emailsDe(ids.ctSem), "V3: lido o aviso, a rotina não repete o e-mail").toHaveLength(1);
    expect(await avisosDe(ids.ctSem), "V3: lido o aviso, a rotina não grava outro").toHaveLength(1);
    // …e depois RESOLVE-o; a rotina corre outra vez — continua um e-mail e um aviso.
    expect((await adm().from("avisos").update({ resolvido_em: new Date().toISOString() }).eq("usuario_id", ids.D).eq("ref_id", ids.ctSem)).error).toBeNull();
    await rodar();
    expect(await emailsDe(ids.ctSem), "V3b: resolvido o aviso, a rotina não repete o e-mail").toHaveLength(1);
    expect(await avisosDe(ids.ctSem), "V3b: resolvido o aviso, a rotina não grava outro").toHaveLength(1);
    // A categoria do aviso: "decisao" (a que o notify nunca desliga pela preferência da pessoa).
    expect(categoriaDoEvento("contrato_sem_taxa"), "a categoria do aviso é decisão").toBe("decisao");
    // ORDEM-DUET-1041: o contrato cancelado não gera aviso nem e-mail.
    expect(await avisosDe(ids.ctCan), "cancelado: nenhum aviso").toHaveLength(0);
    expect(await emailsDe(ids.ctCan), "cancelado: nenhum e-mail").toHaveLength(0);
    const { data: reservas } = await adm().from("cobrancas_fechamento").select("lead_id").eq("lead_id", ids.leadSem);
    expect(reservas ?? [], "a rotina não cobra nem reserva nada").toHaveLength(0);
  });

  test("3. o e-mail falha na 1.ª rodada: a âncora fica gravada antes; a 2.ª rodada não repete; o item continua na Central", async ({ browser }) => {
    test.skip(!existsSync(".next/BUILD_ID") || !rodar, "Precisa do build do laboratório e da rotina do caso 2.");
    // Um contrato novo nesta situação (os do caso 2 já estão avisados).
    ids.imFal = await criarImovelPronto(ids.D, `[TESTE QA] Taxa Fal ${sufixo}`, { ativo: true, preco: 2800 });
    ids.leadFal = await criarLead(ids.D, ids.M, ids.imFal, true);
    const pFal = await proposta(ids.leadFal, ids.imFal);
    ids.orcFal = pFal.id;
    ids.ctFal = await contrato(ids.leadFal, ids.imFal, pFal.id, 260);
    // 1.ª rodada com o envio a falhar (o Resend falso fora do ar).
    const rodarComFalha = await subirRotina(PORTA_FALHA, { LAB_RESEND_URL: RESEND_FORA });
    await rodarComFalha();
    expect(await avisosDe(ids.ctFal), "V1: a âncora (o aviso no sino) ficou gravada antes da tentativa de envio").toHaveLength(1);
    expect(await emailsDe(ids.ctFal), "V1: o envio falhou — nenhum e-mail entregue").toHaveLength(0);
    // 2.ª rodada (e uma 3.ª) com o envio a funcionar: a âncora existe, nada se repete.
    await rodar!();
    await rodar!();
    expect(await avisosDe(ids.ctFal), "V1: a 2.ª rodada não grava um 2.º aviso").toHaveLength(1);
    expect((await emailsDe(ids.ctFal)).length, "V1: no total, no máximo um e-mail entregue").toBeLessThanOrEqual(1);
    // O item continua na Central: o filtro é calculado na leitura, não depende do aviso.
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    await p.goto("/admin/pendencias?filtro=contratos_sem_taxa", { waitUntil: "domcontentloaded" });
    await expect(p.locator('[data-testid="central-linha"][data-filtro="contratos_sem_taxa"]').filter({ hasText: vnct(ids.ctFal) }), "V1: o item continua na Central").toHaveCount(1, { timeout: 30_000 });
    await ctx.close();
  });

  test("3b. a âncora vem ANTES do e-mail: se a gravação do aviso falha, nenhum e-mail sai; a hora seguinte avisa uma vez só", async () => {
    test.skip(!existsSync(".next/BUILD_ID") || !rodar, "Precisa do build do laboratório e da rotina do caso 2.");
    ids.imAnc = await criarImovelPronto(ids.D, `[TESTE QA] Taxa Anc ${sufixo}`, { ativo: true, preco: 2800 });
    ids.leadAnc = await criarLead(ids.D, ids.M, ids.imAnc, true);
    const pAnc = await proposta(ids.leadAnc, ids.imAnc);
    ids.ctAnc = await contrato(ids.leadAnc, ids.imAnc, pAnc.id, 340);
    // 1.ª rodada com a gravação do aviso DESTE contrato a falhar: sem âncora, o e-mail não pode sair.
    await recusarAvisoDe(ids.ctAnc);
    try {
      await rodar!();
      expect(await avisosDe(ids.ctAnc), "V1 (ordem): a gravação falhou — nenhum aviso").toHaveLength(0);
      expect(await emailsDe(ids.ctAnc), "V1 (ordem): sem âncora gravada, nenhum e-mail sai").toHaveLength(0);
    } finally {
      await voltarAGravarAvisos();
    }
    // A hora seguinte (a gravação de volta): a âncora grava-se e o e-mail sai UMA vez; mais uma rodada não repete.
    await rodar!();
    await rodar!();
    expect(await avisosDe(ids.ctAnc), "V1 (ordem): um aviso").toHaveLength(1);
    await expect.poll(async () => (await emailsDe(ids.ctAnc)).length, { timeout: 30_000, message: "V1 (ordem): no total, um e-mail entregue" }).toBe(1);
  });

  test("4. com a taxa reservada, o item sai da Central sozinho", async ({ browser }) => {
    const { error } = await adm().from("cobrancas_fechamento").insert({ lead_id: ids.leadSem, tipo: "comissao", proposta_id: ids.orcSem });
    expect(error).toBeNull();
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    await p.goto("/admin/pendencias?filtro=contratos_sem_taxa", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("central-pendencias")).toBeVisible({ timeout: 30_000 });
    await expect(p.locator('[data-testid="central-linha"][data-filtro="contratos_sem_taxa"]').filter({ hasText: vnct(ids.ctSem) })).toHaveCount(0);
    await ctx.close();
  });
});
