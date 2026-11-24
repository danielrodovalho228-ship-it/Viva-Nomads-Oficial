import { test, expect, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  ENSAIO (Pista 3, ORDEM-DUET-618 §2) — NÃO ENTRA NA MAIN. A expiração das 72 h da proposta do avaliador (E682/E1101/E1117):
  proposta do avaliador → dono sem responder → expiração. Massa como a t1736 (piloto, como em produção: dono e avaliador
  de conta de teste na lista do piloto, pedido feito pela tela, proposta pela tela). O cron /api/cron/vistoria sobe num
  2.º servidor do mesmo build (padrão t2130), com CRON_SECRET só dele; ?agora= é o relógio controlado do laboratório.
   1. 71 h 59 depois da proposta (?agora=): nada expira.
   2. A janela entre as 72 h e o tique do cron (ao vivo: 23:21 → 00:07): a proposta recuada para 72 h 01 atrás, as telas
      do dono e do avaliador ANTES de o cron rodar.
   3. O cron roda (relógio real): a proposta expira — estado no banco, as telas e os e-mails (caixa de teste).
  Registo com "ENSAIO" no log; as asserções de texto são soft para recolher tudo de uma vez.
*/
const PORTA = 3131;
const SEGREDO = `lab-ens1117-${Math.random().toString(36).slice(2)}`;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Patrocínio";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.e1117.${sufixo}@lab.vivanomads.test`, nome: "Dora Expira", role: "owner" as const };
const aval = { email: `av.e1117.${sufixo}@lab.vivanomads.test`, nome: "Artur Avaliador", role: "tenant" as const };
const ids: Record<string, string> = {};
let pedido = "";
let servidor: ChildProcess | null = null;
const H = 3_600_000;

const linha = async () =>
  (await adm().from("vistoria_pedidos").select("status, teste, avaliador_id, escolhido_em, designado_em, proposta_em, proposta_aceita_em, valor_proposto, aguardando_avaliador").eq("id", pedido).single()).data!;
const designacoes = async () => (await adm().from("vistoria_designacoes").select("avaliador_id, resposta, respondido_em").eq("pedido_id", pedido)).data ?? [];
const caixa = async (u: string) =>
  ((await adm().from("emails_teste").select("evento, assunto, corpo, criado_em").eq("usuario_id", u).order("criado_em", { ascending: true })).data ?? []) as { evento: string; assunto: string; corpo: string }[];
async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
async function cron(agora?: string) {
  const r = await fetch(`http://localhost:${PORTA}/api/cron/vistoria${agora ? `?agora=${encodeURIComponent(agora)}` : ""}`, { headers: { authorization: `Bearer ${SEGREDO}` } });
  const corpo = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  console.log("ENSAIO cron", agora ?? "(relógio real)", r.status, JSON.stringify(corpo));
  expect(r.status, JSON.stringify(corpo)).toBe(200);
  return corpo;
}
async function texto(page: Page, rotulo: string) {
  const t = (await page.locator("main").innerText()).replace(/\s+\n/g, "\n").slice(0, 2500);
  console.log(`ENSAIO tela ${rotulo} >>>\n${t}\n<<< fim ${rotulo}`);
  return t;
}

test.describe("ENSAIO E1117 — a expiração das 72 h da proposta do avaliador", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.aval = await criarConta(aval, senha);
    const t = await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.aval]);
    if (t.error) throw t.error;
    const { data: parc, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.aval, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: aval.nome, slug: `av-e1117-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (error) throw error;
    ids.parc = parc.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: c, error: e2 } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: parc.id, cidade: CIDADE, numero_credenciado: n, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/e1117", conduta_versao: "2026-10-23", ativado_em: "2026-10-01T12:00:00Z" })
      .select("id")
      .single();
    if (e2) throw e2;
    ids.cred = c.id as string;
    for (const u of [ids.dono, ids.aval]) {
      const p = await adm().from("vistoria_piloto").insert({ user_id: u, nota: "ENSAIO E1117 (laboratório)" });
      if (p.error) throw p.error;
    }
    ids.imovel = await criarImovelPronto(ids.dono, `Casa ensaio ${sufixo}`, { ativo: true });
    const cid = await adm().from("properties").update({ city: CIDADE }).eq("id", ids.imovel);
    if (cid.error) throw cid.error;
    const { error: eT } = await adm().from("vistoria_precos").insert(["estudio", "q1_2", "q3_mais"].map((porte) => ({ cidade: CIDADE, porte, valor: 350 })));
    if (eT) throw eT;
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    if (ids.imovel) {
      const ped = ((await adm().from("vistoria_pedidos").select("id").eq("property_id", ids.imovel)).data ?? []).map((x) => x.id as string);
      if (ped.length) await adm().from("vistoria_fila_admin").delete().in("pedido_id", ped);
      await adm().from("vistoria_pedidos").delete().eq("property_id", ids.imovel);
    }
    await adm().from("vistoria_precos").delete().eq("cidade", CIDADE);
    const contas = [ids.dono, ids.aval].filter(Boolean);
    if (contas.length) await adm().from("vistoria_piloto").delete().in("user_id", contas);
    if (ids.cred) {
      await adm().from("vistoria_designacoes").delete().eq("avaliador_id", ids.cred);
      await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    }
    if (ids.parc) await adm().from("parceiros").delete().eq("id", ids.parc);
    if (ids.imovel) await adm().from("properties").delete().eq("id", ids.imovel);
    await apagarContas(contas);
  });

  test("0. o dono pede e escolhe pela tela; o avaliador propõe pela tela", async ({ browser }) => {
    const d = await entrar(browser, dono.email, senha);
    await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
    await d.getByTestId("pedir-avaliacao").getByRole("button", { name: "Pedir avaliação do imóvel" }).click({ timeout: 30_000 });
    await expect(d.getByTestId("avaliacao-escolha")).toBeVisible({ timeout: 30_000 });
    await d.getByTestId("avaliacao-sugerido").first().getByRole("button").click();
    await expect(d.getByTestId("avaliacao-aguarda-proposta")).toBeVisible({ timeout: 30_000 });
    pedido = (await adm().from("vistoria_pedidos").select("id").eq("property_id", ids.imovel).single()).data!.id as string;
    await d.context().close();

    const a = await entrar(browser, aval.email, senha);
    await a.goto(`/dashboard/parceiro/avaliacao/${pedido}`, { waitUntil: "domcontentloaded" });
    const tela = a.getByTestId("pedido-avaliador");
    await tela.getByRole("button", { name: "Aceitar pedido" }).click({ timeout: 30_000 });
    await tela.getByLabel("Seu valor (R$)").fill("250");
    await tela.getByLabel(/Seu prazo \(dias/).fill("2");
    await tela.getByRole("button", { name: "Enviar proposta" }).click();
    await expect.poll(async () => (await linha()).proposta_em, { timeout: 20_000 }).not.toBeNull();
    await a.context().close();
    const l = await linha();
    console.log("ENSAIO estado depois da proposta", JSON.stringify(l), JSON.stringify(await designacoes()));
    expect(l.status).toBe("designado");
    expect(l.teste, "piloto: o pedido nasce de teste").toBe(true);
    console.log("ENSAIO e-mails do dono depois da proposta", JSON.stringify((await caixa(ids.dono)).map((e) => [e.evento, e.assunto])));
    console.log("ENSAIO e-mails do avaliador depois da proposta", JSON.stringify((await caixa(ids.aval)).map((e) => [e.evento, e.assunto])));
  });

  test("1. 71 h 59 depois da proposta: o cron não expira nada", async () => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    const log = createWriteStream(`${SAIDA}/ensaio-e1117-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/vistoria`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);
    const propostaEm = (await linha()).proposta_em as string;
    const antesDono = (await caixa(ids.dono)).length;
    const r = await cron(new Date(Date.parse(propostaEm) + 72 * H - 60_000).toISOString());
    expect(String(r.agora), "o relógio simulado foi aceite").toBe(new Date(Date.parse(propostaEm) + 72 * H - 60_000).toISOString());
    const l = await linha();
    expect(l.status, "71 h 59: continua designado").toBe("designado");
    expect(l.proposta_em, "e a proposta continua de pé").toBe(propostaEm);
    expect((await caixa(ids.dono)).length, "nenhum e-mail novo ao dono").toBe(antesDono);
  });

  test("2. a janela entre as 72 h e o tique do cron: o que as telas mostram antes de expirar", async ({ browser }) => {
    const recuada = new Date(Date.now() - 72 * H - 60_000).toISOString();
    const p = await adm().from("vistoria_pedidos").update({ proposta_em: recuada }).eq("id", pedido);
    const g = await adm().from("vistoria_designacoes").update({ respondido_em: recuada }).eq("pedido_id", pedido).eq("avaliador_id", ids.cred);
    if (p.error ?? g.error) throw p.error ?? g.error;
    const d = await entrar(browser, dono.email, senha);
    for (const w of [390, 1280]) {
      await largura(d, w);
      await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
      await expect(d.locator("main")).toBeVisible({ timeout: 30_000 });
      await d.waitForTimeout(1500);
      await texto(d, `dono-janela-${w}`);
      await d.screenshot({ path: `${SAIDA}/ensaio-e1117-2-dono-janela-${w}.png`, fullPage: true });
    }
    await d.context().close();
    const a = await entrar(browser, aval.email, senha);
    await a.goto(`/dashboard/parceiro/avaliacao/${pedido}`, { waitUntil: "domcontentloaded" });
    await a.waitForTimeout(1500);
    await texto(a, "avaliador-pedido-janela-390");
    await a.screenshot({ path: `${SAIDA}/ensaio-e1117-2-avaliador-pedido-janela-390.png`, fullPage: true });
    await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    await a.waitForTimeout(1500);
    await texto(a, "avaliador-lista-janela-390");
    await a.context().close();
    expect((await linha()).status, "antes do cron, o banco ainda diz designado").toBe("designado");
  });

  test("3. o cron roda: a proposta expira — estado, telas e e-mails", async ({ browser }) => {
    test.skip(!servidor, "Sem o servidor do cron.");
    const antesDono = (await caixa(ids.dono)).length;
    const antesAval = (await caixa(ids.aval)).length;
    const r = await cron();
    expect(Number(r.expiradas), "o cron conta a expiração").toBeGreaterThanOrEqual(1);
    const l = await linha();
    const dsg = await designacoes();
    console.log("ENSAIO estado depois da expiração", JSON.stringify(l), JSON.stringify(dsg));
    expect(l.status, "o pedido volta ao dono").toBe("pedido");
    expect(l.avaliador_id, "sem avaliador").toBeNull();
    expect(l.proposta_em, "a proposta foi descartada").toBeNull();
    expect(l.valor_proposto, "o valor também").toBeNull();
    expect(dsg.find((x) => x.avaliador_id === ids.cred)?.resposta, "a designação fica 'expirada'").toBe("expirada");

    await expect.poll(async () => (await caixa(ids.dono)).length, { timeout: 30_000, message: "um e-mail novo ao dono" }).toBeGreaterThan(antesDono);
    const novosDono = (await caixa(ids.dono)).slice(antesDono);
    const novosAval = (await caixa(ids.aval)).slice(antesAval);
    for (const e of novosDono) console.log(`ENSAIO e-mail ao DONO [${e.evento}] ${e.assunto}\n${e.corpo}`);
    for (const e of novosAval) console.log(`ENSAIO e-mail ao AVALIADOR [${e.evento}] ${e.assunto}\n${e.corpo}`);
    console.log("ENSAIO e-mails novos: dono", novosDono.length, "avaliador", novosAval.length);
    expect.soft(novosDono.map((e) => e.evento), "o e-mail ao dono é o vistoria_designado_dono").toContain("vistoria_designado_dono");

    const d = await entrar(browser, dono.email, senha);
    for (const w of [390, 1280]) {
      await largura(d, w);
      await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
      await expect(d.locator("main")).toBeVisible({ timeout: 30_000 });
      await d.waitForTimeout(1500);
      await texto(d, `dono-expirada-${w}`);
      await d.screenshot({ path: `${SAIDA}/ensaio-e1117-3-dono-expirada-${w}.png`, fullPage: true });
    }
    await expect.soft(d.getByTestId("avaliacao-escolha"), "o dono volta a escolher").toBeVisible();
    await d.context().close();
    const a = await entrar(browser, aval.email, senha);
    await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    await a.waitForTimeout(1500);
    await texto(a, "avaliador-lista-expirada-390");
    await a.screenshot({ path: `${SAIDA}/ensaio-e1117-3-avaliador-lista-expirada-390.png`, fullPage: true });
    await a.goto(`/dashboard/parceiro/avaliacao/${pedido}`, { waitUntil: "domcontentloaded" });
    await a.waitForTimeout(1500);
    await texto(a, "avaliador-pedido-expirada-390");
    await a.context().close();
  });
});
