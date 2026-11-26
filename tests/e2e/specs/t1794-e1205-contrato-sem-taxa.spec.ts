import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/*
  T1794 — E1205 @E1205 (ORDEM-DUET-979, 1012 e 1017; número dado na ORDEM-1017). Linha Proposta e contrato.
  O furo: a taxa só fica reservada quando a tela chama /api/comissao DEPOIS do registo do contrato; quem fecha a aba
  entre os dois passos deixa um contrato sem taxa. A varredura não cobra nada: o contrato entra na fila da Central
  ("Contrato sem taxa reservada", VN-CT · proposta · data) e o dono recebe UM aviso com a ligação para o assistente
  daquela estadia.
  Massa só no laboratório, contas de teste, uma dona com três contratos criados há 2 horas:
   - SEM TAXA: com proposta e sem a reserva da taxa (o caso);
   - RESERVADO: com proposta e com a reserva da taxa (fora);
   - LEGADO: sem proposta (fora do âmbito).
  A rotina corre num 2º servidor do mesmo build (porta 3154, CRON_SECRET só dele; o padrão da t1753), duas vezes.
   1. A Central (admin) mostra o contrato SEM TAXA, com o VN-CT, a proposta e a data; os outros dois não aparecem.
   2. Depois de duas rodadas: UM e-mail e UM aviso no sino ao dono, só do contrato SEM TAXA, com a ligação para o
      assistente da estadia; nada sobre os outros dois; nenhuma reserva nova (a rotina não cobra).
   3. Com a taxa reservada, o item sai da Central sozinho.
  Nota: a rotina corre sobre o banco inteiro; contratos de outras specs nesta situação também recebem o seu aviso.
  Laboratório; não é prova ao vivo no site.
*/
const SAIDA = "tests/laboratorio/saida";
const PORTA = 3154;
const SEGREDO = `lab-t1794-${Math.random().toString(36).slice(2)}`;
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = (nome: string, quem: string, role: "owner" | "tenant") => ({ email: `${quem}.t1794.${sufixo}@lab.vivanomads.test`, nome, role });
const D = conta("Dalva Taxa Sobrenome", "dona", "owner");
const M = conta("Mirta Taxa Sobrenome", "mora", "tenant");
const ids: Record<string, string> = {};
let servidor: ChildProcess | null = null;
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

async function contrato(lead: string, imovel: string, propostaId: string | null, inicio: number): Promise<string> {
  const { data, error } = await adm()
    .from("contratos")
    .insert({ lead_id: lead, property_id: imovel, tenant_id: ids.M, proposta_id: propostaId, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 60, aluguel_mensal: 2800, tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 672, qtd_ocupantes: 1, garantia: "caucao", status: "ativo", periodo: `[${emDias(inicio)},${emDias(inicio + 59)}]`, created_at: HA_2H })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

const emails = async () => ((await adm().from("emails_teste").select("corpo").eq("usuario_id", ids.D).eq("evento", "contrato_sem_taxa")).data ?? []) as { corpo: string }[];
const avisos = async () => ((await adm().from("avisos").select("ref_id, url").eq("usuario_id", ids.D).eq("evento", "contrato_sem_taxa")).data ?? []) as { ref_id: string; url: string }[];

test.beforeAll(async () => {
  if (!NO_LABORATORIO) return;
  ids.D = await criarConta(D, senha);
  ids.M = await criarConta(M, senha);
  await adm().from("profiles").update({ is_teste: true }).in("id", [ids.D, ids.M]);
  for (const k of ["Sem", "Res", "Leg"]) {
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
});

test.afterAll(async () => {
  servidor?.kill("SIGTERM");
  const leads = [ids.leadSem, ids.leadRes, ids.leadLeg].filter(Boolean);
  const contratos = [ids.ctSem, ids.ctRes, ids.ctLeg].filter(Boolean);
  if (ids.D) await adm().from("emails_teste").delete().eq("usuario_id", ids.D);
  if (contratos.length) await adm().from("avisos").delete().in("ref_id", contratos);
  if (leads.length) {
    await adm().from("cobrancas_fechamento").delete().in("lead_id", leads);
    await adm().from("contratos").delete().in("lead_id", leads);
    await adm().from("propostas").delete().in("lead_id", leads);
    await adm().from("leads").delete().in("id", leads);
  }
  const imoveis = [ids.imSem, ids.imRes, ids.imLeg].filter(Boolean);
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
    await p.screenshot({ path: `${SAIDA}/t1794-central-1280.png`, fullPage: true });
    await ctx.close();
  });

  test("2. duas rodadas da rotina: um e-mail e um aviso ao dono, só do contrato sem taxa, para o assistente da estadia; nada cobrado", async () => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    expect(await emails(), "antes da rotina: nenhum e-mail").toHaveLength(0);
    const log = createWriteStream(`${SAIDA}/t1794-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/contratos-sem-taxa`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);
    const rodar = async () => {
      const r = await fetch(`http://localhost:${PORTA}/api/cron/contratos-sem-taxa`, { headers: { authorization: `Bearer ${SEGREDO}` } });
      const corpo = (await r.json().catch(() => ({}))) as { ok?: boolean; encontrados?: number };
      expect(r.status, JSON.stringify(corpo)).toBe(200);
      return corpo;
    };
    expect((await rodar()).encontrados ?? 0, "a rotina encontrou pelo menos o contrato sem taxa").toBeGreaterThanOrEqual(1);
    await rodar();

    await expect.poll(async () => (await emails()).length, { timeout: 30_000, message: "um e-mail ao dono, mesmo com 2 rodadas" }).toBe(1);
    const email = (await emails())[0];
    expect(email.corpo).toContain(`o contrato ${vnct(ids.ctSem)} (proposta ${ids.numSem}) foi gerado, mas a taxa de serviço da Viva não ficou reservada`);
    // A ligação para o assistente da estadia (o "&" pode vir escapado no HTML do e-mail).
    expect(email.corpo).toMatch(new RegExp(`/dashboard/fechamento\\?c=${ids.leadSem}&(amp;)?p=${ids.orcSem}`));
    const sino = await avisos();
    expect(sino.map((a) => a.ref_id), "um aviso no sino, só do contrato sem taxa").toEqual([ids.ctSem]);
    expect(sino[0].url).toBe(`/dashboard/fechamento?c=${ids.leadSem}&p=${ids.orcSem}`);
    const { data: reservas } = await adm().from("cobrancas_fechamento").select("lead_id").eq("lead_id", ids.leadSem);
    expect(reservas ?? [], "a rotina não cobra nem reserva nada").toHaveLength(0);
  });

  test("3. com a taxa reservada, o item sai da Central sozinho", async ({ browser }) => {
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
