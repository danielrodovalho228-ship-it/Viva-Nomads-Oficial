import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1717 — E1081 (ORDEM-DUET-387, classe A): o bloqueio da prova do piloto. O imóvel está numa cidade COM acento e a
  tabela de preço foi gravada SEM acento (como "Uberlândia" × "Uberlandia" em produção). O dono do piloto (conta de
  teste + vistoria_piloto, sem a chave nem o cookie do laboratório) abre Meus imóveis › Nível, ruído e extras:
   - vê o valor de referência da tabela e o botão "Pedir avaliação do imóvel";
   - NÃO vê "A avaliação ainda não tem valor nesta cidade".
  A trava morde: sem a linha da tabela, a mesma tela diz que ainda não há valor e não mostra o botão.
  Cidade única do spec (não mexe na tabela de Uberlândia dos outros specs). 390 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const CIDADE_IMOVEL = `Cidadela Ácentuada ${sufixo}`;
const CIDADE_TABELA = `cidadela acentuada ${sufixo}`.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const dono = { email: `dono.t1717.${sufixo}@lab.vivanomads.test`, nome: "Dora Acento", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T1717 — E1081: o preço da cidade sem acento chega ao imóvel com acento", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    const t = await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    if (t.error) throw t.error;
    ids.imovel = await criarImovelPronto(ids.dono, `Casa com acento ${sufixo}`, { ativo: true, preco: 2400 });
    const c = await adm().from("properties").update({ city: CIDADE_IMOVEL }).eq("id", ids.imovel);
    if (c.error) throw c.error;
    const p = await adm().from("vistoria_piloto").insert({ user_id: ids.dono, nota: "T1717 (laboratório)" });
    if (p.error) throw p.error;
  });
  test.afterAll(async () => {
    await adm().from("vistoria_precos").delete().eq("cidade", CIDADE_TABELA);
    if (ids.dono) await adm().from("vistoria_piloto").delete().eq("user_id", ids.dono);
    if (ids.imovel) await adm().from("properties").delete().eq("id", ids.imovel);
    await apagarContas([ids.dono].filter(Boolean));
  });

  test("sem a linha da tabela: ainda não há valor; com a linha sem acento: valor e botão de pedido", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    const nivel = `/dashboard/imoveis/${ids.imovel}/nivel`;

    // A trava morde: sem tabela na cidade, a tela diz que ainda não há valor.
    await page.goto(nivel, { waitUntil: "domcontentloaded" });
    const rota = page.getByTestId("rota-avaliacao");
    await expect(rota).toBeVisible({ timeout: 25_000 });
    await expect(page.getByTestId("avaliacao-indisponivel")).toHaveText("A avaliação ainda não tem valor nesta cidade.");
    await expect(page.getByTestId("pedir-avaliacao")).toHaveCount(0);

    // A tabela gravada sem acento e em maiúsculas (o imóvel tem 1 quarto: porte "1 ou 2 quartos").
    const { error } = await adm()
      .from("vistoria_precos")
      .insert(["estudio", "q1_2", "q3_mais"].map((porte) => ({ cidade: CIDADE_TABELA, porte, valor: porte === "q1_2" ? 350 : 300 })));
    expect(error).toBeNull();

    await page.goto(nivel, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("avaliacao-valor")).toContainText("350", { timeout: 25_000 });
    await expect(page.getByTestId("pedir-avaliacao")).toBeVisible();
    await expect(page.getByTestId("pedir-avaliacao").getByRole("button")).toHaveText("Pedir avaliação do imóvel");
    await expect(page.getByText("A avaliação ainda não tem valor nesta cidade.")).toHaveCount(0);
    await expect(page.getByTestId("avaliacao-modo-teste")).toHaveCount(0);
    await page.screenshot({ path: "tests/laboratorio/saida/t1717-nivel-390.png", fullPage: false });
    await page.context().close();
  });
});
