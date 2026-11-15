import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { ANCORAS_ANTIGAS, ENDERECOS_DA_CONTA, SECAO_INEXISTENTE } from "../fixtures/enderecos-da-conta";

/*
  T1660 — E744 (passo 9): todo endereço da Conta leva à tela registrada, a 390 e a 1280 px.
  Antes deste spec, vários endereços eram abertos por outros testes (que cobram o conteúdo), mas ninguém cobrava o
  endereço em que a tela assenta: /perfil-publico, /privacidade, /seguranca, /pagamentos, /plano, a seção inexistente,
  10 das 13 âncoras antigas da página longa e todas elas a 390 px.
   • telas próprias e as que levam a outra tela: a matriz de fixtures/enderecos-da-conta.ts (decisão citada por linha);
   • âncoras antigas (/dashboard/conta#documento…): cada uma vai à sua tela (regra de src/lib/conta/secoes.ts,
     "mantendo a busca e a âncora que ainda existe");
   • /dashboard/conta sem o cookie da largura (1ª visita) e com ele desatualizado: E492 — no computador é o Perfil, no
     celular é o menu da Conta.
  /dashboard/conta com o cookie em dia é do t1611 (E798).
  Dois casos nasceram vermelhos e foram corrigidos no produto, no mesmo PR (src/lib/conta/e798-consulta-e-largura.test.ts):
  a âncora antiga com consulta a 1280 px (o proxy não levava o ?linkedin=…) e /dashboard/conta a 390 px com o cookie da
  largura dizendo "larga" (caía no Perfil).
*/
const senha = novaSenha();
const conta = { email: `conta.t1660.${novoSufixo()}@lab.vivanomads.test`, nome: "Elisa Endereço", role: "tenant" as const };
let id: string | undefined;

const COOKIE_TELA = "vn-tela";
const TELAS = [
  { largura: 1280, altura: 900, tela: "larga" },
  { largura: 390, altura: 844, tela: "estreita" },
] as const;
type Tela = (typeof TELAS)[number];

/** Caminho + consulta (+ âncora, quando pedido) do endereço atual. */
function endereco(page: Page, comAncora = false): string {
  const u = new URL(page.url());
  return `${u.pathname}${u.search}${comAncora ? u.hash : ""}`;
}
const cookieDaTela = async (page: Page) => (await page.context().cookies()).find((c) => c.name === COOKIE_TELA)?.value;

/** Entra e espera a casca do painel gravar a largura deste aparelho (o que o proxy lê no E798). */
async function entrarNaLargura(page: Page, t: Tela) {
  await page.setViewportSize({ width: t.largura, height: t.altura });
  await entrarNaPagina(page, conta.email, senha);
  await page.goto("/dashboard", { waitUntil: "load" });
  await expect.poll(() => cookieDaTela(page), { message: "a casca grava a largura da tela", timeout: 20_000 }).toBe(t.tela);
}

/** Troca o cookie da largura (mesmo domínio e caminho do que a casca grava) ou o apaga. */
async function forcarCookieDaTela(page: Page, valor: "larga" | "estreita" | null) {
  await page.context().clearCookies({ name: COOKIE_TELA });
  if (valor) await page.context().addCookies([{ name: COOKIE_TELA, value: valor, domain: new URL(page.url()).hostname, path: "/" }]);
  expect(await cookieDaTela(page), "o cookie ficou como o teste pediu").toBe(valor ?? undefined);
}

const suave = expect.configure({ soft: true });

/** Cobra a tela em que o endereço assentou: endereço, um H1 visível com o título, e o item do menu lateral. */
async function cobrarTela(page: Page, t: Tela, rotulo: string, esperado: { destino: string; h1: string; menu: string | null }) {
  const comAncora = esperado.destino.includes("#");
  await suave.poll(() => endereco(page, comAncora), { message: `${rotulo}: endereço em que a tela assenta`, timeout: 20_000 }).toBe(esperado.destino);
  await suave(page.locator("h1:visible"), `${rotulo}: um título só, o da tela`).toHaveText([esperado.h1], { timeout: 20_000 });
  const lateral = page.getByTestId("conta-menu-lateral");
  if (t.largura >= 1024) {
    const ativos = lateral.locator('[aria-current="page"]');
    if (esperado.menu) await suave(ativos, `${rotulo}: item ativo do menu da Conta`).toHaveAttribute("data-testid", `conta-menu-${esperado.menu}`);
    else await suave(ativos, `${rotulo}: nenhum item ativo no menu da Conta`).toHaveCount(0);
  } else {
    await suave(lateral, `${rotulo}: sem menu lateral no celular`).toBeHidden();
  }
}

test.describe("T1660 — E744: todo endereço da Conta leva à tela registrada", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.beforeAll(async () => {
    id = await criarConta(conta, senha);
  });
  test.afterAll(async () => {
    await apagarContas([id]);
  });

  for (const t of TELAS) {
    test(`${t.largura} px: cada seção abre a sua tela, e as que levam a outra tela chegam lá`, async ({ page }) => {
      test.setTimeout(240_000);
      await entrarNaLargura(page, t);
      for (const e of ENDERECOS_DA_CONTA) {
        await test.step(`${e.rota} — ${e.decisao}`, async () => {
          await page.goto(e.rota, { waitUntil: "domcontentloaded" });
          await cobrarTela(page, t, e.rota, e);
        });
      }
    });

    test(`${t.largura} px: seção que não existe mostra "Página não encontrada", sem a casca da Conta`, async ({ page }) => {
      await entrarNaLargura(page, t);
      await page.goto(SECAO_INEXISTENTE, { waitUntil: "domcontentloaded" });
      await expect(page.locator("h1:visible")).toHaveText(["Página não encontrada"], { timeout: 20_000 });
      expect(endereco(page), "o endereço digitado fica na barra").toBe(SECAO_INEXISTENTE);
      await expect(page.getByTestId("conta-cabecalho")).toHaveCount(0);
    });

    test(`${t.largura} px: cada âncora antiga da página longa vai à sua tela`, async ({ page }) => {
      test.setTimeout(240_000);
      await entrarNaLargura(page, t);
      for (const a of ANCORAS_ANTIGAS) {
        await test.step(`/dashboard/conta#${a.ancora}`, async () => {
          // De uma tela neutra: trocar só a âncora na mesma URL não recarrega o documento.
          await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
          await page.goto(`/dashboard/conta#${a.ancora}`, { waitUntil: "domcontentloaded" });
          await cobrarTela(page, t, `#${a.ancora}`, a);
        });
      }
    });

    test(`${t.largura} px: a âncora antiga com consulta leva a consulta junto (?linkedin=…#confianca)`, async ({ page }) => {
      await entrarNaLargura(page, t);
      await page.goto("/dashboard/conta?linkedin=conectado#confianca", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1, name: "Segurança e verificações" })).toBeVisible({ timeout: 20_000 });
      expect(endereco(page)).toBe("/dashboard/conta/seguranca?linkedin=conectado");
    });
  }

  test("1280 px, 1ª visita (sem o cookie da largura): /dashboard/conta chega ao Perfil", async ({ page }) => {
    await entrarNaLargura(page, TELAS[0]);
    await forcarCookieDaTela(page, null);
    await page.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
    await expect.poll(() => endereco(page), { timeout: 20_000 }).toBe("/dashboard/conta/perfil");
    await expect(page.getByTestId("perfil-tela")).toBeVisible({ timeout: 20_000 });
  });

  test("390 px, 1ª visita (sem o cookie da largura): /dashboard/conta é o menu da Conta", async ({ page }) => {
    await entrarNaLargura(page, TELAS[1]);
    await forcarCookieDaTela(page, null);
    await page.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("conta-menu")).toBeVisible({ timeout: 20_000 });
    expect(endereco(page)).toBe("/dashboard/conta");
  });

  test("1280 px com o cookie dizendo tela estreita (janela alargada): /dashboard/conta chega ao Perfil", async ({ page }) => {
    await entrarNaLargura(page, TELAS[0]);
    await forcarCookieDaTela(page, "estreita");
    await page.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
    await expect.poll(() => endereco(page), { timeout: 20_000 }).toBe("/dashboard/conta/perfil");
    await expect(page.getByTestId("perfil-tela")).toBeVisible({ timeout: 20_000 });
  });

  test("390 px com o cookie dizendo tela larga (janela estreitada, tablet girado): /dashboard/conta é o menu da Conta", async ({ page }) => {
    await entrarNaLargura(page, TELAS[1]);
    await forcarCookieDaTela(page, "larga");
    await page.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("conta-menu")).toBeVisible({ timeout: 15_000 });
    expect(endereco(page)).toBe("/dashboard/conta");
    // A largura ficou corrigida: a próxima abertura já é o menu, direto do servidor.
    expect(await cookieDaTela(page)).toBe("estreita");
    const r = await page.request.get("/dashboard/conta", { maxRedirects: 0 });
    expect(r.status()).toBe(200);
  });

  test("390 px: abrir o Perfil direto fica no Perfil (a volta ao menu é só para quem veio de /dashboard/conta)", async ({ page }) => {
    await entrarNaLargura(page, TELAS[1]);
    await forcarCookieDaTela(page, "larga");
    await page.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("perfil-tela")).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1500);
    expect(endereco(page)).toBe("/dashboard/conta/perfil");
  });
});
