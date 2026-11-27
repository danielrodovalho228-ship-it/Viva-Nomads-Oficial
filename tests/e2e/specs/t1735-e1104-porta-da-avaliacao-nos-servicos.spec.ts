import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1735 — E1104 @E1104 (ORDEM-DUET-470, classe A): a porta da avaliação estava escondida de quem quer começar. O cartão
  "Avaliação do imóvel" da grade de Serviços só aparecia para a conta com a avaliação já aberta (piloto). Só contas de
  teste; cidade própria do spec (Frutal); a chave fica DESLIGADA (sem o cookie do laboratório), como em produção.
   1. Dono FORA do piloto, sem avaliação: vê o cartão e chega à porta, que diz o estado honesto ("ainda não chegou a
      Frutal") e oferece a volta aos serviços. Nada da avaliação aparece. Print a 390 e a 1280 px.
   2. Dono NO piloto, sem avaliação em curso: o cartão leva à porta, que lista o imóvel com "Pedir avaliação"; o botão
      leva ao começo do pedido (o bloco da avaliação, na página do nível do imóvel). Print a 390 e a 1280 px.
   3. Dono NO piloto, com avaliação em curso: o mesmo cartão leva direto ao pedido em curso.
   4. Dono novo, no piloto e ainda sem imóvel: a porta diz para anunciar primeiro.
   5. Morador: não vê o cartão; a porta, aberta pelo endereço, devolve-o aos Serviços.
  Laboratório; não é prova ao vivo no site.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Frutal";
const senha = novaSenha();
const sufixo = novoSufixo();
const fora = { email: `fora.t1735.${sufixo}@lab.vivanomads.test`, nome: "Flora Fora", role: "owner" as const };
const dentro = { email: `dentro.t1735.${sufixo}@lab.vivanomads.test`, nome: "Dário Dentro", role: "owner" as const };
const novo = { email: `novo.t1735.${sufixo}@lab.vivanomads.test`, nome: "Nilo Novo", role: "owner" as const };
const morador = { email: `mor.t1735.${sufixo}@lab.vivanomads.test`, nome: "Mara Moradora", role: "tenant" as const };
const ids: Record<string, string> = {};
const titulos = { fora: `Casa fora t1735 ${sufixo}`, dentro: `Casa dentro t1735 ${sufixo}` };

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
const semRolagemLateral = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

test.describe("T1735 — E1104: o cartão 'Avaliação do imóvel' é a porta de todo dono @E1104", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    for (const [k, c] of [["fora", fora], ["dentro", dentro], ["novo", novo], ["morador", morador]] as const) ids[k] = await criarConta(c, senha);
    // Conta de teste (is_teste): só as do piloto. O "fora" e a moradora ficam como uma conta comum de produção — a conta
    // de teste, mesmo fora do piloto, vê o bloco da avaliação em modo só-leitura (E235), e não é esse o caso da trava.
    const t = await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dentro, ids.novo]);
    if (t.error) throw t.error;
    ids.imovelFora = await criarImovelPronto(ids.fora, titulos.fora, { ativo: true });
    ids.imovelDentro = await criarImovelPronto(ids.dentro, titulos.dentro, { ativo: true });
    const c = await adm().from("properties").update({ city: CIDADE }).in("id", [ids.imovelFora, ids.imovelDentro]);
    if (c.error) throw c.error;
    const { error: eT } = await adm()
      .from("vistoria_precos")
      .insert(["estudio", "q1_2", "q3_mais"].map((porte) => ({ cidade: CIDADE, porte, valor: 350 })));
    if (eT) throw eT;
    // O piloto: só o "dentro" e o "novo". O "fora" e a moradora ficam de fora, como qualquer conta em produção hoje.
    for (const u of [ids.dentro, ids.novo]) {
      const p = await adm().from("vistoria_piloto").insert({ user_id: u, nota: "T1735 (laboratório)" });
      if (p.error) throw p.error;
    }
  });

  test.afterAll(async () => {
    const imoveis = [ids.imovelFora, ids.imovelDentro].filter(Boolean);
    if (imoveis.length) {
      const pedidos = ((await adm().from("vistoria_pedidos").select("id").in("property_id", imoveis)).data ?? []).map((x) => x.id as string);
      if (pedidos.length) await adm().from("vistoria_fila_admin").delete().in("pedido_id", pedidos);
      await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    }
    await adm().from("vistoria_precos").delete().eq("cidade", CIDADE);
    const contas = [ids.fora, ids.dentro, ids.novo, ids.morador].filter(Boolean);
    if (contas.length) await adm().from("vistoria_piloto").delete().in("user_id", contas);
    if (imoveis.length) await adm().from("properties").delete().in("id", imoveis);
    await apagarContas(contas);
  });

  test("1. dono fora do piloto: vê o cartão e chega à porta, que diz o estado honesto (nunca um beco)", async ({ browser }) => {
    const d = await entrar(browser, fora.email, senha);
    for (const w of LARGURAS) {
      await largura(d, w);
      await d.goto("/dashboard/servicos", { waitUntil: "domcontentloaded" });
      const card = d.getByTestId("servicos-avaliacao");
      await expect(card).toBeVisible({ timeout: 30_000 });
      await expect(card).toContainText("Avaliação do imóvel");
      await expect(card).toContainText("Laudo com o nível do imóvel");
      await expect(card).toHaveAttribute("href", "/dashboard/servicos/avaliacao");
      await card.scrollIntoViewIfNeeded();
      await d.screenshot({ path: `${SAIDA}/t1735-1-servicos-${w}.png` });
      await card.click();
      const porta = d.getByTestId("porta-avaliacao");
      await expect(porta).toHaveAttribute("data-estado", "a_chegar", { timeout: 30_000 });
      await expect(d).toHaveURL(/\/dashboard\/servicos\/avaliacao$/);
      await expect(d.getByRole("heading", { level: 1, name: "Avaliação do imóvel" })).toBeVisible();
      const aviso = porta.getByTestId("porta-a-chegar");
      await expect(aviso).toContainText(`A avaliação do imóvel ainda não chegou a ${CIDADE}`);
      await expect(aviso).toContainText("Estamos credenciando avaliadores e abrindo o serviço cidade por cidade. Quando abrir para a sua conta, o pedido aparece aqui e na página do nível de cada imóvel.");
      // O piloto continua fechado: a porta não lista imóvel para pedir nem mostra avaliador.
      await expect(porta.getByTestId("porta-escolher")).toHaveCount(0);
      await expect(porta.getByTestId("porta-imovel")).toHaveCount(0);
      await semRolagemLateral(d);
      await d.screenshot({ path: `${SAIDA}/t1735-1-porta-a-chegar-${w}.png`, fullPage: true });
      // Nunca um beco: a volta aos serviços.
      await porta.getByTestId("porta-outros-servicos").click();
      await expect(d).toHaveURL(/\/dashboard\/servicos$/);
      await expect(d.getByTestId("servicos-grade")).toBeVisible({ timeout: 30_000 });
    }
    // E a página do imóvel segue sem o bloco da avaliação (o piloto não abriu para esta conta).
    await d.goto(`/dashboard/imoveis/${ids.imovelFora}/nivel`, { waitUntil: "domcontentloaded" });
    await expect(d.getByRole("heading", { level: 1, name: "Nível, ruído e extras" })).toBeVisible({ timeout: 30_000 });
    await expect(d.getByTestId("avaliacao-dono")).toHaveCount(0);
    await d.context().close();
  });

  test("2. dono no piloto, sem avaliação em curso: o cartão leva à porta e a porta leva ao começo do pedido", async ({ browser }) => {
    const d = await entrar(browser, dentro.email, senha);
    for (const w of LARGURAS) {
      await largura(d, w);
      await d.goto("/dashboard/servicos", { waitUntil: "domcontentloaded" });
      const card = d.getByTestId("servicos-avaliacao");
      await expect(card).toBeVisible({ timeout: 30_000 });
      await expect(card).toHaveAttribute("href", "/dashboard/servicos/avaliacao");
      await card.click();
      const porta = d.getByTestId("porta-avaliacao");
      await expect(porta).toHaveAttribute("data-estado", "escolher", { timeout: 30_000 });
      await expect(porta.getByTestId("porta-escolher")).toContainText("Escolha o imóvel");
      const item = porta.getByTestId("porta-imovel");
      await expect(item).toHaveCount(1);
      await expect(item).toContainText(titulos.dentro);
      await expect(item).toContainText(CIDADE);
      await expect(item).toHaveAttribute("data-em-curso", "0");
      const acao = item.getByTestId("porta-imovel-acao");
      await expect(acao).toHaveText("Pedir avaliação");
      await expect(acao).toHaveAttribute("href", `/dashboard/imoveis/${ids.imovelDentro}/nivel#avaliacao-do-imovel`);
      await semRolagemLateral(d);
      await d.screenshot({ path: `${SAIDA}/t1735-2-porta-escolher-${w}.png`, fullPage: true });
      await acao.click();
      // O começo do pedido: o bloco da avaliação do imóvel, com o botão de pedir, à vista.
      await expect(d).toHaveURL(new RegExp(`/dashboard/imoveis/${ids.imovelDentro}/nivel#avaliacao-do-imovel$`));
      const pedir = d.getByTestId("pedir-avaliacao").getByRole("button", { name: "Pedir avaliação do imóvel" });
      await expect(pedir).toBeVisible({ timeout: 30_000 });
      await expect(d.getByTestId("avaliacao-dono")).toBeInViewport();
      await d.screenshot({ path: `${SAIDA}/t1735-2-comeco-do-pedido-${w}.png` });
    }
    await d.context().close();
  });

  test("3. dono no piloto, com avaliação em curso: o mesmo cartão leva direto ao pedido em curso", async ({ browser }) => {
    const d = await entrar(browser, dentro.email, senha);
    await largura(d, 390);
    // O pedido nasce pela própria tela (o caminho do caso 2).
    await d.goto(`/dashboard/imoveis/${ids.imovelDentro}/nivel`, { waitUntil: "domcontentloaded" });
    await d.getByTestId("pedir-avaliacao").getByRole("button", { name: "Pedir avaliação do imóvel" }).click({ timeout: 30_000 });
    await expect
      .poll(async () => ((await adm().from("vistoria_pedidos").select("status").eq("property_id", ids.imovelDentro).maybeSingle()).data?.status as string | undefined) ?? "", { timeout: 20_000 })
      .toBe("pedido");
    await d.goto("/dashboard/servicos", { waitUntil: "domcontentloaded" });
    const card = d.getByTestId("servicos-avaliacao");
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card).toHaveAttribute("href", `/dashboard/imoveis/${ids.imovelDentro}/nivel#avaliacao-do-imovel`);
    await card.click();
    await expect(d).toHaveURL(new RegExp(`/dashboard/imoveis/${ids.imovelDentro}/nivel#avaliacao-do-imovel$`));
    const pedido = d.getByTestId("avaliacao-dono-pedido");
    await expect(pedido).toBeVisible({ timeout: 30_000 });
    await expect(pedido).toHaveAttribute("data-status", "pedido");
    await expect(d.getByTestId("avaliacao-dono")).toBeInViewport();
    await d.screenshot({ path: `${SAIDA}/t1735-3-pedido-em-curso-390.png` });
    // A porta, aberta pelo endereço, diz o mesmo: este imóvel tem pedido em curso.
    await d.goto("/dashboard/servicos/avaliacao", { waitUntil: "domcontentloaded" });
    const item = d.getByTestId("porta-imovel");
    await expect(item).toHaveAttribute("data-em-curso", "1", { timeout: 30_000 });
    await expect(item.getByTestId("porta-imovel-acao")).toHaveText("Ver o pedido em curso");
    await d.context().close();
  });

  test("4. dono novo no piloto, ainda sem imóvel: vê o cartão; a porta diz para anunciar primeiro", async ({ browser }) => {
    const d = await entrar(browser, novo.email, senha);
    await largura(d, 390);
    await d.goto("/dashboard/servicos", { waitUntil: "domcontentloaded" });
    const card = d.getByTestId("servicos-avaliacao");
    await expect(card).toBeVisible({ timeout: 30_000 });
    await card.click();
    const porta = d.getByTestId("porta-avaliacao");
    await expect(porta).toHaveAttribute("data-estado", "sem_imovel", { timeout: 30_000 });
    await expect(porta.getByTestId("porta-sem-imovel")).toContainText("Você ainda não tem imóvel anunciado");
    await expect(porta.getByTestId("porta-anunciar")).toHaveAttribute("href", "/dashboard/imoveis/novo");
    await d.screenshot({ path: `${SAIDA}/t1735-4-sem-imovel-390.png`, fullPage: true });
    await d.context().close();
  });

  test("5. morador: não vê o cartão; a porta, pelo endereço, devolve-o aos Serviços", async ({ browser }) => {
    const m = await entrar(browser, morador.email, senha);
    await largura(m, 390);
    await m.goto("/dashboard/servicos", { waitUntil: "domcontentloaded" });
    await expect(m.getByTestId("servicos-grade")).toBeVisible({ timeout: 30_000 });
    await expect(m.getByTestId("servicos-avaliacao")).toHaveCount(0);
    await m.goto("/dashboard/servicos/avaliacao", { waitUntil: "domcontentloaded" });
    await expect(m).toHaveURL(/\/dashboard\/servicos$/, { timeout: 30_000 });
    await expect(m.getByTestId("porta-avaliacao")).toHaveCount(0);
    await m.context().close();
  });
});
