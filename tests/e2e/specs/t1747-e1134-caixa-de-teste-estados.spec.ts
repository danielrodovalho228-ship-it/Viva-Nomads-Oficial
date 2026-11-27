import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1747 — E1134 @E1134 (ORDEM-DUET-589, ao serviço da linha Parceiros): a Caixa de e-mails de teste (Conta › Ajuda) não
  some em silêncio. Só contas do laboratório; não é prova ao vivo no site.
   1. ENQUANTO BUSCA. A rota da caixa fica presa: a conta de teste vê o cartão "Caixa de e-mails de teste" com
      "Carregando os e-mails…" (e a âncora #caixa-emails-teste já existe). Solta a rota: aparece o e-mail. 390 e 1280 px.
   2. A BUSCA FALHA. A rota responde 503; depois a rede cai; depois responde 200 sem a lista. Nas três, a conta de teste
      vê "Não foi possível ler a caixa agora. Isso não quer dizer que ela está vazia." — nunca "Nenhum e-mail ainda" nem
      nada. "Tentar de novo" com a rota de volta: aparece o e-mail. 390 e 1280 px.
   3. CONTA REAL. Com a rota presa e depois a responder 503, a conta que não é de teste não vê a caixa, nem
      "carregando", nem o erro. Sem interceptar nada: também não. 390 e 1280 px.
  A rota a falhar de verdade (o banco a dar erro) não se simula aqui: está nas guardas de fonte da trava de unidade
  (e1134-caixa-de-teste-estados.test.ts).
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const ROTA = "**/api/conta/caixa-teste";
const AJUDA = "/dashboard/conta/ajuda";
const CARREGANDO = "Carregando os e-mails…";
const NAO_LIDA = "Não foi possível ler a caixa agora. Isso não quer dizer que ela está vazia.";
const senha = novaSenha();
const sufixo = novoSufixo();
const ASSUNTO = `E-mail de teste t1747 ${sufixo}`;
const deTeste = { email: `teste.t1747.${sufixo}@lab.vivanomads.test`, nome: "Tina Teste", role: "tenant" as const };
const real = { email: `real.t1747.${sufixo}@lab.vivanomads.test`, nome: "Rita Real", role: "tenant" as const };
const ids: Record<string, string> = {};

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
async function semRolagemLateral(page: Page, quando: string) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra, `${quando}: sem rolagem lateral`).toBeLessThanOrEqual(1);
}
/** Dois quadros de pintura: o React já desenhou o que a resposta mudou. */
async function pintou(page: Page) {
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}
const caixa = (p: Page) => p.getByTestId("caixa-emails-teste");
const carregando = (p: Page) => p.getByTestId("caixa-emails-teste-carregando");
const erro = (p: Page) => p.getByTestId("caixa-emails-teste-erro");
const titulo = (p: Page) => p.getByText("Caixa de e-mails de teste", { exact: true });

test.describe("T1747 — E1134: a Caixa de e-mails de teste diz que está a carregar e diz quando não conseguiu ler @E1134", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.teste = await criarConta(deTeste, senha);
    ids.real = await criarConta(real, senha);
    const t = await adm().from("profiles").update({ is_teste: true }).eq("id", ids.teste);
    if (t.error) throw t.error;
    const r = await adm().from("profiles").update({ is_teste: false }).eq("id", ids.real);
    if (r.error) throw r.error;
    const e = await adm().from("emails_teste").insert({ usuario_id: ids.teste, evento: "t1747", assunto: ASSUNTO, corpo: "Olá Tina,\nEste é o e-mail da trava t1747.", destinatario_mascarado: "t•••@lab.vivanomads.test" });
    if (e.error) throw e.error;
  });

  test.afterAll(async () => {
    if (ids.teste) await adm().from("emails_teste").delete().eq("usuario_id", ids.teste);
    await apagarContas([ids.teste, ids.real].filter(Boolean));
  });

  test("1. enquanto busca: a conta de teste vê a caixa com 'Carregando os e-mails…'; solta a rota e o e-mail aparece", async ({ browser }) => {
    const p = await entrar(browser, deTeste.email, senha);
    for (const w of LARGURAS) {
      await largura(p, w);
      let soltar!: () => void;
      const trinco = new Promise<void>((r) => (soltar = r));
      await p.route(ROTA, async (rota) => {
        await trinco;
        await rota.continue();
      });
      await p.goto(AJUDA, { waitUntil: "domcontentloaded" });
      await expect(carregando(p), `a ${w} px: "carregando" enquanto a rota não responde`).toBeVisible({ timeout: 30_000 });
      await expect(carregando(p)).toContainText(CARREGANDO);
      await expect(titulo(p), `a ${w} px: o cartão já tem o título`).toBeVisible();
      await expect(p.locator("#caixa-emails-teste"), `a ${w} px: a âncora já existe`).toHaveCount(1);
      await expect(caixa(p), `a ${w} px: a lista ainda não`).toHaveCount(0);
      await expect(p.getByText("Nenhum e-mail ainda"), `a ${w} px: "carregando" não é "vazia"`).toHaveCount(0);
      await semRolagemLateral(p, `a ${w} px, carregando`);
      await p.screenshot({ path: `${SAIDA}/t1747-carregando-${w}.png`, fullPage: true });
      soltar();
      await expect(caixa(p), `a ${w} px: o e-mail aparece quando a rota responde`).toContainText(ASSUNTO, { timeout: 20_000 });
      await expect(carregando(p)).toHaveCount(0);
      await expect(erro(p)).toHaveCount(0);
      await p.unroute(ROTA);
    }
    await p.context().close();
  });

  test("2. a busca falha (503, rede caída, 200 sem a lista): a conta de teste vê que a caixa não foi lida; 'Tentar de novo' traz o e-mail", async ({ browser }) => {
    const p = await entrar(browser, deTeste.email, senha);
    const falhas = [
      { nome: "503", agir: (rota: import("@playwright/test").Route) => rota.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Serviço indisponível." }) }) },
      { nome: "rede caída", agir: (rota: import("@playwright/test").Route) => rota.abort("failed") },
      { nome: "200 sem a lista", agir: (rota: import("@playwright/test").Route) => rota.fulfill({ status: 200, contentType: "application/json", body: "{}" }) },
    ];
    for (const w of LARGURAS) {
      await largura(p, w);
      for (const f of falhas) {
        const quando = `a ${w} px, ${f.nome}`;
        await p.route(ROTA, f.agir);
        await p.goto(AJUDA, { waitUntil: "domcontentloaded" });
        await expect(erro(p), `${quando}: o aviso de leitura falhada`).toBeVisible({ timeout: 30_000 });
        await expect(erro(p)).toContainText(NAO_LIDA);
        await expect(titulo(p), `${quando}: o cartão tem o título`).toBeVisible();
        await expect(p.locator("#caixa-emails-teste"), `${quando}: a âncora existe`).toHaveCount(1);
        await expect(caixa(p), `${quando}: sem lista`).toHaveCount(0);
        await expect(p.getByText("Nenhum e-mail ainda"), `${quando}: "não li" não é "vazia"`).toHaveCount(0);
        await expect(carregando(p)).toHaveCount(0);
        await semRolagemLateral(p, quando);
        if (f.nome === "503") await p.screenshot({ path: `${SAIDA}/t1747-nao-lida-${w}.png`, fullPage: true });
        await p.unroute(ROTA);
      }
      // Com a rota de volta, "Tentar de novo" lê a caixa sem recarregar a página.
      await erro(p).getByRole("button", { name: "Tentar de novo" }).click();
      await expect(caixa(p), `a ${w} px: depois de "Tentar de novo", o e-mail`).toContainText(ASSUNTO, { timeout: 20_000 });
      await expect(erro(p)).toHaveCount(0);
      await p.screenshot({ path: `${SAIDA}/t1747-lida-${w}.png`, fullPage: true });
    }
    await p.context().close();
  });

  test("3. conta real: não vê a caixa, nem 'carregando', nem o erro — com a rota presa, a falhar e a responder", async ({ browser }) => {
    const p = await entrar(browser, real.email, senha);
    const nada = async (quando: string) => {
      await pintou(p);
      await expect(carregando(p), `${quando}: sem "carregando"`).toHaveCount(0);
      await expect(erro(p), `${quando}: sem erro`).toHaveCount(0);
      await expect(caixa(p), `${quando}: sem a caixa`).toHaveCount(0);
      await expect(titulo(p), `${quando}: sem o título da caixa`).toHaveCount(0);
      await expect(p.locator("#caixa-emails-teste"), `${quando}: sem a âncora`).toHaveCount(0);
    };
    for (const w of LARGURAS) {
      await largura(p, w);
      // Presa, depois 503.
      let soltar!: () => void;
      const trinco = new Promise<void>((r) => (soltar = r));
      await p.route(ROTA, async (rota) => {
        await trinco;
        await rota.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Serviço indisponível." }) });
      });
      const pedido = p.waitForRequest(ROTA, { timeout: 30_000 });
      await p.goto(AJUDA, { waitUntil: "domcontentloaded" });
      await pedido;
      await expect(p.getByRole("heading", { level: 1 }), `a ${w} px: a Ajuda abriu`).toBeVisible({ timeout: 30_000 });
      await nada(`a ${w} px, rota presa`);
      const resposta = p.waitForResponse(ROTA, { timeout: 30_000 });
      soltar();
      await (await resposta).finished();
      await nada(`a ${w} px, rota a responder 503`);
      await p.unroute(ROTA);
      // Sem interceptar: a rota responde 200 com emails null.
      const real200 = p.waitForResponse(ROTA, { timeout: 30_000 });
      await p.goto(AJUDA, { waitUntil: "domcontentloaded" });
      const r = await real200;
      expect(r.status(), `a ${w} px: a rota responde 200 à conta real`).toBe(200);
      expect((await r.json()).emails, `a ${w} px: sem e-mails para a conta real`).toBeNull();
      await nada(`a ${w} px, rota a responder`);
    }
    await p.context().close();
  });
});
