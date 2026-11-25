import { test, expect, type Page, type Route } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1748 — E1136 @E1136 (ORDENS-DUET 594 e 599; resíduos do E1134): a Caixa de e-mails de teste (Conta › Ajuda). Só
  contas do laboratório; não é prova ao vivo no site.
   1. SILÊNCIO DUPLO. A sessão do navegador não sabe que a conta é de teste (o perfil dela não lê: a rota do perfil
      responde 500) e a busca da caixa fica presa e depois falha (503). A conta de teste vê "Carregando os e-mails…" e
      depois "Não foi possível ler a caixa agora…": a página disse, do servidor, que a conta é de teste. 390 e 1280 px.
   2. A BUSCA DEMORA. A rota fica presa: no começo só "Carregando os e-mails…", sem botão; aos 5 s aparece "Está
      demorando mais que o normal." e "Tentar de novo". Com a rota de volta, o botão traz o e-mail (uma busca nova).
      390 e 1280 px.
   3. A BUSCA NÃO RESPONDE. A rota fica presa para sempre: aos 15 s a tela corta a busca e mostra "Não foi possível ler
      a caixa agora…" com "Tentar de novo"; nada de "carregando" para sempre. 390 e 1280 px.
   4. CONTA REAL. Com a rota presa até o corte dos 15 s, a conta que não é de teste não vê a caixa, nem "carregando",
      nem a demora, nem o erro — também com a sessão do navegador sem ler o perfil. 390 e 1280 px.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const ROTA = "**/api/conta/caixa-teste";
/** A leitura do perfil que a sessão do navegador faz (a que traz o is_teste). */
const ROTA_PERFIL = /\/rest\/v1\/profiles\?.*is_teste/;
const AJUDA = "/dashboard/conta/ajuda";
const CARREGANDO = "Carregando os e-mails…";
const DEMORADA = "Está demorando mais que o normal.";
const NAO_LIDA = "Não foi possível ler a caixa agora. Isso não quer dizer que ela está vazia.";
const senha = novaSenha();
const sufixo = novoSufixo();
const ASSUNTO = `E-mail de teste t1748 ${sufixo}`;
const deTeste = { email: `teste.t1748.${sufixo}@lab.vivanomads.test`, nome: "Tina Teste", role: "tenant" as const };
const real = { email: `real.t1748.${sufixo}@lab.vivanomads.test`, nome: "Rita Real", role: "tenant" as const };
const ids: Record<string, string> = {};

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
async function semRolagemLateral(page: Page, quando: string) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra, `${quando}: sem rolagem lateral`).toBeLessThanOrEqual(1);
}
async function pintou(page: Page) {
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}
/** A sessão do navegador volta a não saber se a conta é de teste (como na primeira carga depois do login). */
async function esquecerQueEhDeTeste(page: Page) {
  await page.evaluate(() => {
    const bruto = localStorage.getItem("vivanomads-auth");
    if (!bruto) return;
    const v = JSON.parse(bruto);
    if (v?.state?.user) delete v.state.user.isTeste;
    localStorage.setItem("vivanomads-auth", JSON.stringify(v));
  });
}
const perfilFalha = (rota: Route) => rota.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "falha simulada" }) });
const falha503 = (rota: Route) => rota.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Serviço indisponível." }) });
const caixa = (p: Page) => p.getByTestId("caixa-emails-teste");
const carregando = (p: Page) => p.getByTestId("caixa-emails-teste-carregando");
const demorada = (p: Page) => p.getByTestId("caixa-emails-teste-demorada");
const erro = (p: Page) => p.getByTestId("caixa-emails-teste-erro");
const titulo = (p: Page) => p.getByText("Caixa de e-mails de teste", { exact: true });
const tentar = (p: Page) => p.getByRole("button", { name: "Tentar de novo" });

test.describe("T1748 — E1136: a Caixa de e-mails de teste sem silêncio duplo e com limite de tempo @E1136", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  test.beforeAll(async () => {
    ids.teste = await criarConta(deTeste, senha);
    ids.real = await criarConta(real, senha);
    const t = await adm().from("profiles").update({ is_teste: true }).eq("id", ids.teste);
    if (t.error) throw t.error;
    const r = await adm().from("profiles").update({ is_teste: false }).eq("id", ids.real);
    if (r.error) throw r.error;
    const e = await adm().from("emails_teste").insert({ usuario_id: ids.teste, evento: "t1748", assunto: ASSUNTO, corpo: "Olá Tina,\nEste é o e-mail da trava t1748.", destinatario_mascarado: "t•••@lab.vivanomads.test" });
    if (e.error) throw e.error;
  });

  test.afterAll(async () => {
    if (ids.teste) await adm().from("emails_teste").delete().eq("usuario_id", ids.teste);
    await apagarContas([ids.teste, ids.real].filter(Boolean));
  });

  test("1. silêncio duplo: a sessão não lê o perfil e a busca falha — a conta de teste vê 'carregando' e depois o aviso de leitura falhada", async ({ browser }) => {
    const p = await entrar(browser, deTeste.email, senha);
    for (const w of LARGURAS) {
      await largura(p, w);
      await esquecerQueEhDeTeste(p);
      await p.route(ROTA_PERFIL, perfilFalha);
      let soltar!: () => void;
      const trinco = new Promise<void>((r) => (soltar = r));
      await p.route(ROTA, async (rota) => {
        await trinco;
        await falha503(rota);
      });
      const perfilPedido = p.waitForResponse((r) => ROTA_PERFIL.test(r.url()) && r.status() === 500, { timeout: 30_000 });
      await p.goto(AJUDA, { waitUntil: "domcontentloaded" });
      await perfilPedido;
      await expect(carregando(p), `a ${w} px: "carregando" mesmo sem a sessão saber que a conta é de teste`).toBeVisible({ timeout: 30_000 });
      await expect(carregando(p)).toContainText(CARREGANDO);
      soltar();
      await expect(erro(p), `a ${w} px: o aviso de leitura falhada, sem a sessão saber que a conta é de teste`).toBeVisible({ timeout: 30_000 });
      await expect(erro(p)).toContainText(NAO_LIDA);
      await expect(titulo(p)).toBeVisible();
      await expect(caixa(p)).toHaveCount(0);
      await semRolagemLateral(p, `a ${w} px, silêncio duplo`);
      await p.screenshot({ path: `${SAIDA}/t1748-silencio-duplo-${w}.png`, fullPage: true });
      await p.unroute(ROTA);
      await p.unroute(ROTA_PERFIL);
    }
    await p.context().close();
  });

  test("2. a busca demora: aos 5 s o carregamento diz que demora e ganha 'Tentar de novo'; o botão faz uma busca nova e traz o e-mail", async ({ browser }) => {
    const p = await entrar(browser, deTeste.email, senha);
    for (const w of LARGURAS) {
      await largura(p, w);
      let pedidos = 0;
      // Presa para sempre: só a busca nova (depois do unroute) responde.
      await p.route(ROTA, async () => {
        pedidos += 1;
        await new Promise<void>(() => {});
      });
      await p.goto(AJUDA, { waitUntil: "domcontentloaded" });
      await expect(carregando(p), `a ${w} px: "carregando" no começo`).toBeVisible({ timeout: 30_000 });
      await expect(demorada(p), `a ${w} px: no começo, sem aviso de demora`).toHaveCount(0);
      await expect(carregando(p).getByRole("button"), `a ${w} px: no começo, sem botão`).toHaveCount(0);
      await expect(demorada(p), `a ${w} px: aos 5 s, o aviso de demora`).toBeVisible({ timeout: 12_000 });
      await expect(demorada(p)).toContainText(DEMORADA);
      await expect(carregando(p), `a ${w} px: continua a carregar`).toContainText(CARREGANDO);
      await expect(carregando(p).getByRole("button", { name: "Tentar de novo" }), `a ${w} px: "Tentar de novo" no carregamento`).toBeVisible();
      await expect(erro(p), `a ${w} px: ainda não é erro`).toHaveCount(0);
      await semRolagemLateral(p, `a ${w} px, demora`);
      await p.screenshot({ path: `${SAIDA}/t1748-demora-${w}.png`, fullPage: true });
      expect(pedidos, `a ${w} px: uma busca até aqui`).toBe(1);
      await p.unrouteAll({ behavior: "ignoreErrors" });
      const nova = p.waitForResponse((r) => r.url().includes("/api/conta/caixa-teste") && r.status() === 200, { timeout: 30_000 });
      await carregando(p).getByRole("button", { name: "Tentar de novo" }).click();
      await nova;
      await expect(caixa(p), `a ${w} px: depois de "Tentar de novo", o e-mail`).toContainText(ASSUNTO, { timeout: 20_000 });
      await expect(carregando(p)).toHaveCount(0);
      await expect(erro(p)).toHaveCount(0);
    }
    await p.context().close();
  });

  test("3. a busca não responde: aos 15 s a tela corta a busca e mostra o aviso de leitura falhada com 'Tentar de novo'", async ({ browser }) => {
    const p = await entrar(browser, deTeste.email, senha);
    for (const w of LARGURAS) {
      await largura(p, w);
      await p.route(ROTA, async () => {
        await new Promise<void>(() => {});
      });
      const cortada = p.waitForEvent("requestfailed", { predicate: (r) => r.url().includes("/api/conta/caixa-teste"), timeout: 40_000 });
      await p.goto(AJUDA, { waitUntil: "domcontentloaded" });
      await expect(carregando(p), `a ${w} px: "carregando" no começo`).toBeVisible({ timeout: 30_000 });
      const inicio = Date.now();
      await cortada;
      await expect(erro(p), `a ${w} px: aos 15 s, o aviso de leitura falhada`).toBeVisible({ timeout: 10_000 });
      expect(Date.now() - inicio, `a ${w} px: o corte não vem antes da hora`).toBeGreaterThan(8_000);
      await expect(erro(p)).toContainText(NAO_LIDA);
      await expect(erro(p).getByRole("button", { name: "Tentar de novo" })).toBeVisible();
      await expect(carregando(p), `a ${w} px: não fica a carregar para sempre`).toHaveCount(0);
      await expect(p.getByText("Nenhum e-mail ainda"), `a ${w} px: "não li" não é "vazia"`).toHaveCount(0);
      await semRolagemLateral(p, `a ${w} px, limite`);
      await p.screenshot({ path: `${SAIDA}/t1748-limite-${w}.png`, fullPage: true });
      await p.unrouteAll({ behavior: "ignoreErrors" });
      await tentar(p).click();
      await expect(caixa(p), `a ${w} px: depois de "Tentar de novo", o e-mail`).toContainText(ASSUNTO, { timeout: 20_000 });
    }
    await p.context().close();
  });

  test("4. conta real: com a rota presa até o corte, não vê a caixa, nem 'carregando', nem a demora, nem o erro", async ({ browser }) => {
    const p = await entrar(browser, real.email, senha);
    const nada = async (quando: string) => {
      await pintou(p);
      await expect(carregando(p), `${quando}: sem "carregando"`).toHaveCount(0);
      await expect(demorada(p), `${quando}: sem aviso de demora`).toHaveCount(0);
      await expect(erro(p), `${quando}: sem erro`).toHaveCount(0);
      await expect(caixa(p), `${quando}: sem a caixa`).toHaveCount(0);
      await expect(titulo(p), `${quando}: sem o título da caixa`).toHaveCount(0);
      await expect(tentar(p), `${quando}: sem "Tentar de novo"`).toHaveCount(0);
    };
    for (const w of LARGURAS) {
      await largura(p, w);
      // A 1280 px, além da rota presa, a sessão do navegador não lê o perfil.
      if (w === 1280) {
        await esquecerQueEhDeTeste(p);
        await p.route(ROTA_PERFIL, perfilFalha);
      }
      await p.route(ROTA, async () => {
        await new Promise<void>(() => {});
      });
      const pedido = p.waitForRequest(ROTA, { timeout: 30_000 });
      const cortada = p.waitForEvent("requestfailed", { predicate: (r) => r.url().includes("/api/conta/caixa-teste"), timeout: 40_000 });
      await p.goto(AJUDA, { waitUntil: "domcontentloaded" });
      await pedido;
      await expect(p.getByRole("heading", { level: 1 }), `a ${w} px: a Ajuda abriu`).toBeVisible({ timeout: 30_000 });
      await nada(`a ${w} px, rota presa`);
      await p.waitForTimeout(6_000); // passa dos 5 s da demora
      await nada(`a ${w} px, passados os 5 s`);
      await cortada;
      await nada(`a ${w} px, depois do corte dos 15 s`);
      await p.unrouteAll({ behavior: "ignoreErrors" });
    }
    await p.context().close();
  });
});
