// Portão pós-#1509/#1512 (Pista C, 29/10): E228 (links da auditoria) e botões do observador da QA; roda no lab-crítico deste PR.
import { test, expect, type Browser, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T631 — E222-B: renovar = ADITIVO DE PRORROGAÇÃO já preenchido (um caminho só; o renovarBloco saiu).
    1. Contrato de 2 meses (bloco padrão de 2): na página do contrato, "Renovar a estadia" (botão de contorno) abre o
       aditivo como renovação — 4 meses já escolhidos, com as datas e o valor do período acrescentado. O morador envia,
       o dono aceita, os dois assinam com código: o bloco 2 aparece (2 meses, agendado, com os dois aceites) e o
       contrato registra estadia_remarcada (E213).
    2. Contrato no teto (3 + 3 meses = 180 dias): sem o botão, com "Esta estadia já chegou ao máximo de 180 dias.";
       o link da renovação mostra a mesma frase, sem formulário.
    3. A Carteira do dono ("Preparar renovação") e o e-mail renovacao_aviso (cron, 15 dias antes do fim) levam ao
       fluxo da renovação. A parte do cron sobe um 2º servidor do mesmo build (porta 3129), como a t592/t597.
  Só no laboratório, com contas e contratos de teste criados aqui.
*/
const SAIDA = "tests/laboratorio/saida";
const PORTA = 3129;
const SEGREDO = `lab-t631-${Math.random().toString(36).slice(2)}`;
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: Record<string, string> = {};
const contratos: string[] = [];
const emails: Record<string, string> = {};
const hojeBRT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const emDias = (n: number) => new Date(Date.parse(hojeBRT()) + n * 86_400_000).toISOString().slice(0, 10);
const ddmmaaaa = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const renovar = (id: string) => `/dashboard/estadia/${id}/alteracao?renovar=1`;
let servidor: ChildProcess | null = null;

async function conta(quem: string, nome: string, role: "owner" | "tenant") {
  emails[quem] = `${quem}.t631.${sufixo}@lab.vivanomads.test`;
  const id = await criarConta({ email: emails[quem], nome, role }, senha);
  await adm().from("profiles").update({ is_teste: true }).eq("id", id);
  return id;
}

/** Contrato ativo, assinado pelas duas partes, com os blocos dados (meses), o último terminando em `fimEm` dias. */
async function contrato(letra: string, inquilino: string, mesesPorBloco: number[], fimEm: number) {
  const imovel = await criarImovelPronto(ids.dono, `Studio renova ${letra} t631 ${sufixo}`, { ativo: true, preco: 3200 });
  const lead = await criarLead(ids.dono, inquilino, imovel, true);
  const agora = new Date().toISOString();
  const total = mesesPorBloco.reduce((s, m) => s + m, 0);
  const { data: c, error } = await adm()
    .from("contratos")
    .insert({ property_id: imovel, tenant_id: inquilino, lead_id: lead, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: total * 30, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 256 * total, qtd_ocupantes: 1, capacidade_snapshot: 2, status: "ativo", garantia: "caucao", assinado_proprietario_em: agora, assinado_inquilino_em: agora })
    .select("id")
    .single();
  if (error) throw error;
  contratos.push(c.id);
  let inicio = new Date(Date.parse(emDias(fimEm)) - (total * 30 - 1) * 86_400_000).toISOString().slice(0, 10);
  for (const [i, meses] of mesesPorBloco.entries()) {
    const fim = new Date(Date.parse(inicio) + (meses * 30 - 1) * 86_400_000).toISOString().slice(0, 10);
    const { error: e } = await adm().from("contrato_blocos").insert({ contrato_id: c.id, numero_bloco: i + 1, inicio, fim, meses, valor: 3200 * meses, caucao: i === 0 ? 3200 : 0, status: i === 0 ? "ativo" : "agendado", aceite_proprietario_em: agora, aceite_inquilino_em: agora });
    if (e) throw e;
    inicio = new Date(Date.parse(fim) + 86_400_000).toISOString().slice(0, 10);
  }
  return c.id as string;
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

const pronto = (p: Page) => p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

async function assinar(pagina: Page, quem: string) {
  await pagina.reload({ waitUntil: "domcontentloaded" });
  await pronto(pagina);
  const desde = new Date().toISOString();
  await pagina.getByTestId("aditivo-pedir-codigo").click();
  await expect(pagina.getByTestId("estadia-ok").or(pagina.getByTestId("estadia-erro"))).toHaveText("Código enviado para o seu e-mail.", { timeout: 30_000 });
  await pagina.getByTestId("aditivo-codigo").fill(await codigoDaCaixa(quem, desde));
  await pagina.getByTestId("aditivo-aceite").check();
  await pagina.getByTestId("aditivo-assinar").click();
  await expect(pagina.getByTestId("estadia-ok").or(pagina.getByTestId("estadia-erro"))).toHaveText("Assinatura registrada.", { timeout: 30_000 });
}

async function rodarCron() {
  const r = await fetch(`http://localhost:${PORTA}/api/cron/automacoes`, { headers: { authorization: `Bearer ${SEGREDO}` } });
  const corpo = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  expect(r.status, JSON.stringify(corpo)).toBe(200);
  expect(corpo.simulado).toBe(false);
}

test.describe("T631 — E222-B: renovar é o aditivo de prorrogação já preenchido", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 300_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    test.setTimeout(180_000);
    ids.dono = await conta("dono", "Dora Renova", "owner");
    ids.ana = await conta("ana", "Ana Renova", "tenant");
    ids.beto = await conta("beto", "Beto Renova", "tenant");
    ids.caio = await conta("caio", "Caio Renova", "tenant");
    ids.A = await contrato("A", ids.ana, [2], 20); // 2 meses, termina em 20 dias: renova
    ids.B = await contrato("B", ids.beto, [3, 3], 40); // 180 dias: no teto
    ids.C = await contrato("C", ids.caio, [2], 15); // termina em 15 dias: o cron manda renovacao_aviso
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    if (contratos.length) {
      await adm().from("contrato_aditivos").delete().in("contrato_id", contratos);
      await adm().from("contrato_eventos").delete().in("contrato_id", contratos);
      await adm().from("pagamentos_bloco").delete().in("contrato_id", contratos);
      await adm().from("contrato_blocos").delete().in("contrato_id", contratos);
      await adm().from("contratos").delete().in("id", contratos);
    }
    const pessoas = ["dono", "ana", "beto", "caio"].map((k) => ids[k]).filter(Boolean);
    await adm().from("automacoes_envios").delete().in("usuario_id", pessoas);
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas(pessoas);
  });

  test("1. página do contrato → 'Renovar a estadia' → aditivo já preenchido → as duas assinaturas: bloco novo e estadia_remarcada", async ({ browser }: { browser: Browser }) => {
    const fimAtual = emDias(20);
    const m = await entrar(browser, emails.ana, senha);
    // O morador chega ao contrato por Minhas locações (o dono, por Contratos): o mesmo detalhe para as duas partes.
    await m.goto(`/dashboard/locacoes/${ids.A}`, { waitUntil: "domcontentloaded" });
    await pronto(m);
    const botao = m.getByTestId("contrato-renovar");
    await expect(botao).toHaveText("Renovar a estadia");
    await expect(botao).toHaveAttribute("href", renovar(ids.A));
    await expect(m.getByTestId("contrato-renovacao")).toContainText("Cabem mais 4 meses");
    await botao.click();
    await expect(m).toHaveURL(new RegExp(`/dashboard/estadia/${ids.A}/alteracao\\?renovar=1$`));
    await expect(m.getByTestId("pagina-alteracao")).toHaveAttribute("data-modo", "renovar");
    await expect(m.getByRole("heading", { name: "Renovar a estadia" })).toBeVisible();
    // Já preenchido: 2 → 4 meses (mais 1 bloco padrão de 2), com as datas e o valor do período acrescentado.
    await expect(m.getByTestId("alteracao-meses")).toHaveValue("4");
    const inicioNovo = emDias(21);
    const fimNovo = emDias(80);
    const previa = m.getByTestId("renovacao-previa");
    await expect(previa).toHaveAttribute("data-inicio", inicioNovo);
    await expect(previa).toHaveAttribute("data-fim", fimNovo);
    await expect(previa).toHaveAttribute("data-valor", "6400");
    await expect(previa).toContainText(`Mais 2 meses: de ${ddmmaaaa(inicioNovo)} a ${ddmmaaaa(fimNovo)}`);
    // Ajuste dentro do teto: as opções vão de 3 a 6 meses.
    await expect(m.getByTestId("alteracao-meses").locator("option")).toHaveText(["3 meses (mais 1)", "4 meses (mais 2)", "5 meses (mais 3)", "6 meses (mais 4)"]);
    await m.screenshot({ path: `${SAIDA}/t631-renovar-preenchido.png`, fullPage: true });
    await m.getByTestId("alteracao-enviar").click();
    await expect(m).toHaveURL(new RegExp(`/dashboard/estadia/${ids.A}$`));
    await expect(m.getByTestId("aditivo-resumo")).toHaveText("Meses: de 2 para 4");

    const d = await entrar(browser, emails.dono, senha);
    await d.goto(`/dashboard/estadia/${ids.A}`, { waitUntil: "domcontentloaded" });
    await pronto(d);
    await d.getByTestId("aditivo-aceitar").click();
    await expect(d.getByTestId("estadia-ok").or(d.getByTestId("estadia-erro"))).toHaveText("Proposta aceita. Agora as duas partes assinam o aditivo.", { timeout: 30_000 });
    await assinar(d, ids.dono);
    await assinar(m, ids.ana);

    const { data: blocos } = await adm().from("contrato_blocos").select("numero_bloco, inicio, fim, meses, status, aceite_proprietario_em, aceite_inquilino_em").eq("contrato_id", ids.A).order("numero_bloco");
    expect(blocos!.map((b) => [b.numero_bloco, b.meses, b.status])).toEqual([
      [1, 2, "ativo"],
      [2, 2, "agendado"],
    ]);
    expect(blocos![0].fim).toBe(fimAtual);
    expect(blocos![1]).toMatchObject({ inicio: inicioNovo, fim: fimNovo });
    expect(blocos![1].aceite_proprietario_em && blocos![1].aceite_inquilino_em).toBeTruthy();
    const { data: ev } = await adm().from("contrato_eventos").select("tipo").eq("contrato_id", ids.A).eq("tipo", "estadia_remarcada");
    expect(ev ?? [], "o aditivo assinado registra estadia_remarcada").toHaveLength(1);

    // 4 meses agora: a página do contrato (lado do dono) oferece só o que ainda cabe (2 meses).
    await d.goto(`/dashboard/contratos/${ids.A}`, { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("contrato-renovar")).toHaveAttribute("href", renovar(ids.A));
    await expect(d.getByTestId("contrato-renovacao")).toContainText("Cabem mais 2 meses");
    await d.context().close();
    await m.context().close();
  });

  test("2. contrato no teto (180 dias): sem o botão, com a frase do máximo — também no link da renovação", async ({ browser }) => {
    const p = await entrar(browser, emails.dono, senha);
    await p.goto(`/dashboard/contratos/${ids.B}`, { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("contrato-renovacao")).toHaveAttribute("data-cabe", "0");
    await expect(p.getByTestId("contrato-renovacao-maximo")).toHaveText("Esta estadia já chegou ao máximo de 180 dias.");
    await expect(p.getByTestId("contrato-renovar")).toHaveCount(0);
    await p.goto(renovar(ids.B), { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("renovacao-no-maximo")).toHaveText("Esta estadia já chegou ao máximo de 180 dias.");
    await expect(p.getByTestId("alteracao-form")).toHaveCount(0);
    await p.context().close();
  });

  test("3a. Carteira: 'Preparar renovação' leva ao fluxo da renovação", async ({ browser }) => {
    const p = await entrar(browser, emails.dono, senha);
    await p.goto("/dashboard/carteira", { waitUntil: "domcontentloaded" });
    await expect(p.locator(`[data-testid="carteira-preparar-renovacao"][href="${renovar(ids.C)}"]`)).toBeVisible({ timeout: 20_000 });
    await p.locator(`[data-testid="carteira-preparar-renovacao"][href="${renovar(ids.C)}"]`).click();
    await expect(p).toHaveURL(new RegExp(`/dashboard/estadia/${ids.C}/alteracao\\?renovar=1$`));
    await expect(p.getByTestId("alteracao-meses")).toHaveValue("4");
    await p.context().close();
  });

  test("3b. e-mail renovacao_aviso (cron, 15 dias antes do fim): o link abre o fluxo da renovação", async () => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    const log = createWriteStream(`${SAIDA}/t631-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, AUTOMACOES_ATIVO: "1", PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/automacoes`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);
    await rodarCron();
    for (const quem of [ids.caio, ids.dono]) {
      await expect
        .poll(async () => ((await adm().from("emails_teste").select("corpo").eq("usuario_id", quem).eq("evento", "renovacao_aviso")).data ?? []).map((e) => String(e.corpo)), { timeout: 30_000 })
        .toEqual([expect.stringContaining(renovar(ids.C))]);
    }
  });
});
