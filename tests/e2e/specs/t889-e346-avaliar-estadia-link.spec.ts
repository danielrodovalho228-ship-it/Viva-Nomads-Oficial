import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T889 — E346 (#1929, Pista B): o botão "Avaliar a estadia" do pedido de avaliação mandado pelo cron abre a avaliação
  DAQUELA estadia — o dono em /dashboard/contratos#avaliar-<contrato>, o morador em /dashboard/locacoes#avaliar-<contrato>
  — e não a lista genérica /dashboard/avaliacoes. Aqui: o link certo no texto do e-mail de cada parte e, abrindo o link,
  o bloco da âncora na tela.
  Diagnóstico: o caso do morador registra no log o status e o encerrado_em do contrato no banco quando o link é
  aberto (a leitura do código sugeria que o cron pede a avaliação de contrato ainda "ativo", sem a âncora do morador;
  o primeiro lab-crítico mostrou a âncora presente — o log diz o porquê).
*/
const SAIDA = "tests/laboratorio/saida";
const PORTA = 3189;
const SEGREDO = `lab-t889-${Math.random().toString(36).slice(2)}`;
const senha = novaSenha();
const sufixo = novoSufixo();
const TITULO = `Studio E346 t889 ${sufixo}`;
const emails: Record<string, string> = {};
const ids: { dono?: string; inq?: string; imovel?: string; contrato?: string } = {};
let servidor: ChildProcess | null = null;

const hojeBRT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const somar = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);

async function conta(quem: string, nome: string, role: "owner" | "tenant") {
  emails[quem] = `${quem}.t889.${sufixo}@lab.vivanomads.test`;
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

test.describe("T889 — E346: Avaliar a estadia abre a avaliação daquela estadia", () => {
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
    const log = createWriteStream(`${SAIDA}/t889-servidor-cron.log`);
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
      console.log(`t889|${quem}|assunto|${e.assunto}`);
      console.log(`t889|${quem}|corpo|${e.corpo.replace(/\n/g, " ⏎ ")}`);
    }
  });

  test("o link de cada parte aponta para a avaliação daquela estadia", async () => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    const dono = await pedidoDe(ids.dono!);
    expect(dono.corpo, "dono: Contratos com a âncora do contrato").toMatch(new RegExp(`Avaliar a estadia: \\S*/dashboard/contratos#avaliar-${ids.contrato}(\\s|$)`));
    const inq = await pedidoDe(ids.inq!);
    expect(inq.corpo, "morador: Locações com a âncora do contrato").toMatch(new RegExp(`Avaliar a estadia: \\S*/dashboard/locacoes#avaliar-${ids.contrato}(\\s|$)`));
    for (const e of [dono, inq]) expect(e.corpo, "não a lista genérica").not.toMatch(/Avaliar a estadia: \S*\/dashboard\/avaliacoes/);
  });

  for (const largura of [1280, 390] as const) {
    test(`dono abre o link: o bloco da avaliação do contrato aparece na tela (${largura} px)`, async ({ browser }) => {
      test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
      const page = await entrar(browser, emails.dono, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(`/dashboard/contratos#avaliar-${ids.contrato}`, { waitUntil: "domcontentloaded" });
      const bloco = page.locator(`[id="avaliar-${ids.contrato}"]`);
      await expect(bloco, "a âncora do contrato existe em Contratos").toBeAttached({ timeout: 30_000 });
      await bloco.scrollIntoViewIfNeeded();
      await expect(bloco).toBeVisible();
      await page.screenshot({ path: `${SAIDA}/t889-dono-${largura}.png` });
      await page.context().close();
    });

    test(`morador abre o link: o bloco da avaliação do contrato aparece na tela (${largura} px)`, async ({ browser }) => {
      test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
      // Diagnóstico (L-84 em verificação): o estado do contrato no banco quando o morador abre o link.
      const { data: c } = await adm().from("contratos").select("status, encerrado_em").eq("id", ids.contrato!).single();
      console.log(`t889|contrato|${largura}|status=${c?.status}|encerrado_em=${c?.encerrado_em}`);
      const page = await entrar(browser, emails.inq, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(`/dashboard/locacoes#avaliar-${ids.contrato}`, { waitUntil: "domcontentloaded" });
      const bloco = page.locator(`[id="avaliar-${ids.contrato}"]`);
      await expect(bloco, "a âncora do contrato existe em Locações").toBeAttached({ timeout: 30_000 });
      await bloco.scrollIntoViewIfNeeded();
      await expect(bloco).toBeVisible();
      console.log(`t889|morador|${largura}|form=${(await bloco.innerText()).replace(/\s+/g, " ").slice(0, 200)}`);
      await page.screenshot({ path: `${SAIDA}/t889-morador-${largura}.png` });
      await page.context().close();
    });
  }
});
