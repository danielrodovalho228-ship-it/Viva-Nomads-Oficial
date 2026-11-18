import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1633 — E923: anúncio com contas FIXAS e a estimativa vazia mostrava "tudo incluído" na linha do total do cartão, sem nenhum valor
  de água, luz e gás dentro do total. Regra absoluta: "tudo incluído" nunca aparece quando não está tudo incluído.
  Agora esse caso diz "água, luz e gás não informados" no cartão, e a composição do mês da página diz o mesmo. Com a estimativa
  informada (> 0), o cartão volta a dizer "tudo incluído" e o total do mês sobe exatamente o valor da estimativa.
  Só no laboratório: o imóvel de teste nasce com contas fixas e sem estimativa (o padrão do banco), que é o caso do item.
*/
const sem = (s: string) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1633.${sufixo}@lab.vivanomads.test`, nome: "Dora Contas", role: "owner" as const };
const morador = { email: `mor.t1633.${sufixo}@lab.vivanomads.test`, nome: "Mira Contas", role: "tenant" as const };
const ids: { dono?: string; morador?: string; imovel?: string } = {};

test.describe("T1633 — E923: contas fixas sem estimativa", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Contas T1633 ${sufixo}`, { ativo: true, preco: 3200 });
    const { data, error: e0 } = await adm().from("properties").select("utilities_mode, utilities_estimate").eq("id", ids.imovel).single();
    if (e0) throw e0;
    // O caso do item: contas fixas, estimativa vazia.
    expect((data as { utilities_mode: string }).utilities_mode).toBe("fixed");
    expect(Number((data as { utilities_estimate: number | null }).utilities_estimate ?? 0)).toBe(0);
    const { error } = await adm().from("favorites").insert({ tenant_id: ids.morador, property_id: ids.imovel });
    if (error) throw error;
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("favorites").delete().eq("tenant_id", ids.morador!);
    await apagarContas([ids.dono, ids.morador]);
  });

  test("cartão e página: sem estimativa, 'água, luz e gás não informados'; com estimativa, 'tudo incluído' e o total sobe o valor dela", async ({ browser }) => {
    test.setTimeout(180_000);
    const page = await entrar(browser, morador.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });

    // 1) Sem estimativa: o cartão não promete "tudo incluído".
    await page.goto("/dashboard/favoritos", { waitUntil: "domcontentloaded" });
    const cartao = page.getByTestId("cartao-imovel").first();
    await expect(cartao.getByTestId("cartao-aviso")).toHaveText("água, luz e gás não informados", { timeout: 40_000 });
    expect(sem(await cartao.innerText())).not.toContain("tudo incluído");
    expect(sem(await cartao.getByTestId("cartao-preco-mes").innerText())).toBe("R$ 3.200");

    // A página diz o mesmo, perto do preço.
    await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
    const lateral = page.locator("#cartao-preco");
    await expect(lateral.getByTestId("cartao-lateral-mes-composicao")).toHaveText(/água, luz e gás não informados, fora do total$/, { timeout: 40_000 });
    expect(sem(await lateral.getByTestId("cartao-lateral-mes").innerText())).toBe("R$ 3.200");
    await expect(lateral.getByTestId("iptu-nota")).toContainText("Água, luz e gás não informados neste anúncio.");
    expect(sem(await lateral.innerText())).not.toContain("tudo incluído");

    // 2) Com a estimativa informada: as contas entram no total e o cartão diz "tudo incluído".
    const { error } = await adm().from("properties").update({ utilities_estimate: 250 }).eq("id", ids.imovel!);
    if (error) throw error;
    await page.goto("/dashboard/favoritos", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("cartao-imovel").first().getByTestId("cartao-aviso")).toHaveText("tudo incluído", { timeout: 40_000 });
    expect(sem(await page.getByTestId("cartao-imovel").first().getByTestId("cartao-preco-mes").innerText())).toBe("R$ 3.450");
    await page.context().close();
  });
});
