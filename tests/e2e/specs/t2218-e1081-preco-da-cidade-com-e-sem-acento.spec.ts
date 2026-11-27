import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2218 — E1081 (ORDEM-DUET-387): a tabela de preços da avaliação casa a cidade do imóvel com ou sem acento. Só no
  laboratório (a chave da avaliação liga só neste navegador, pelo cookie de laboratório, como na t305/t341).
  TRAVA EM RASCUNHO: nasce vermelha na main de hoje — o bloco do dono e a ação de pedir procuram o preço com
  `.eq("cidade", im.city)`, texto exacto — e fica verde com a correcção da Code 2.
  Dois imóveis, cada um com a sua tabela (cidades só deste teste, para nada se cruzar com outras specs):
    1. imóvel em "Uberlândia T2218 …" e tabela gravada como "Uberlandia T2218 …";
    2. o inverso: imóvel em "Uberlandia T2218 …" e tabela como "Uberlândia T2218 …".
  Em cada um, pela tela do dono (/dashboard/imoveis/<id>/nivel): o bloco da avaliação mostra o valor da tabela (não
  "indisponível") e o pedido abre (vistoria_pedidos em "pedido"). Os três portes têm o mesmo valor (R$ 350), para a
  trava não depender do porte do imóvel.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2218.${sufixo}@lab.vivanomads.test`, nome: "Dalva Acento", role: "owner" as const };
const CASOS = [
  { k: "acento-no-imovel", imovel: `Uberlândia T2218 ${sufixo}`, tabela: `Uberlandia T2218 ${sufixo}` },
  { k: "acento-na-tabela", imovel: `Uberlandia T2218 x${sufixo}`, tabela: `Uberlândia T2218 x${sufixo}` },
] as const;
const ids: Record<string, string> = {};

async function abrir(browser: Browser): Promise<Page> {
  const page = await entrar(browser, dono.email, senha);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(page.url()).origin }]);
  return page;
}

test.describe("T2218 — E1081: o preço da avaliação casa a cidade com ou sem acento @E1081", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    for (const c of CASOS) {
      ids[c.k] = await criarImovelPronto(ids.dono, `Studio ${c.k} T2218 ${sufixo}`, { ativo: true });
      const { error } = await adm().from("properties").update({ city: c.imovel }).eq("id", ids[c.k]);
      if (error) throw error;
      await adm().from("vistoria_precos").delete().eq("cidade", c.tabela);
      const { error: e2 } = await adm().from("vistoria_precos").insert([
        { cidade: c.tabela, porte: "estudio", valor: 350 },
        { cidade: c.tabela, porte: "q1_2", valor: 350 },
        { cidade: c.tabela, porte: "q3_mais", valor: 350 },
      ]);
      if (e2) throw e2;
    }
  });
  test.afterAll(async () => {
    const imoveis = CASOS.map((c) => ids[c.k]).filter(Boolean);
    if (imoveis.length) await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    for (const c of CASOS) await adm().from("vistoria_precos").delete().eq("cidade", c.tabela);
    await apagarContas([ids.dono].filter(Boolean));
  });

  for (const c of CASOS) {
    test(`${c.k}: imóvel em "${c.imovel.split(" T2218")[0]}", tabela em "${c.tabela.split(" T2218")[0]}" — o valor aparece e o pedido abre`, async ({ browser }) => {
      const page = await abrir(browser);
      await page.goto(`/dashboard/imoveis/${ids[c.k]}/nivel`, { waitUntil: "domcontentloaded" });
      const bloco = page.getByTestId("avaliacao-dono");
      await expect(bloco, "o bloco da avaliação está na tela").toBeVisible({ timeout: 30_000 });
      expect.soft(await bloco.getByTestId("avaliacao-indisponivel").count(), "E1081: com a tabela da cidade, a avaliação não fica indisponível").toBe(0);
      await expect(bloco.getByTestId("avaliacao-valor"), "E1081: o bloco mostra o valor da tabela da cidade").toContainText(/350/, { timeout: 15_000 });
      await bloco.getByTestId("pedir-avaliacao").getByRole("button", { name: /Pedir avaliação do imóvel/ }).click();
      await expect
        .poll(async () => ((await adm().from("vistoria_pedidos").select("status").eq("property_id", ids[c.k]).maybeSingle()).data?.status as string | undefined) ?? "sem pedido", {
          timeout: 20_000,
          message: "E1081: o pedido abre com o preço da tabela",
        })
        .toBe("pedido");
      await page.context().close();
    });
  }
});
