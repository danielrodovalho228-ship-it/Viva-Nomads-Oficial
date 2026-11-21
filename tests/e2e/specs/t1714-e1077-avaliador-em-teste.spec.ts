import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1714 — E1077 (ORDEM-DUET-369): a avaliação do imóvel em âmbito de TESTE. Com a VISTORIA_ATIVA desligada (e sem o
  cookie do laboratório), só a conta que está em vistoria_piloto vê o fluxo.
   1. conta FORA do piloto: em Meus imóveis › Nível, ruído e extras não aparece o bloco "Pedir avaliação" — como hoje;
   2. a MESMA conta, posta no piloto: o bloco aparece, ativo (sem o aviso de só leitura das contas de teste);
   3. tirada do piloto: volta a não ver nada (a trava morde).
  390 px (o login do laboratório abre a 390).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1714.${sufixo}@lab.vivanomads.test`, nome: "Dalva Piloto", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T1714 — E1077: a avaliação do imóvel só para as contas do piloto", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Casa do piloto ${sufixo}`, { ativo: true, preco: 2400 });
  });
  test.afterAll(async () => {
    if (ids.dono) await adm().from("vistoria_piloto").delete().eq("user_id", ids.dono);
    if (ids.imovel) await adm().from("properties").delete().eq("id", ids.imovel);
    await apagarContas([ids.dono]);
  });

  test("fora do piloto não vê nada; no piloto vê o bloco ativo; tirada do piloto, some outra vez", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    const nivel = `/dashboard/imoveis/${ids.imovel}/nivel`;

    // 1. Fora do piloto: nada.
    await page.goto(nivel, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 25_000 });
    await expect(page.getByTestId("avaliacao-dono")).toHaveCount(0);

    // 2. No piloto: o bloco aparece, ativo.
    const { error } = await adm().from("vistoria_piloto").insert({ user_id: ids.dono, nota: "T1714 (laboratório)" });
    expect(error).toBeNull();
    await page.goto(nivel, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("avaliacao-dono")).toBeVisible({ timeout: 25_000 });
    await expect(page.getByTestId("avaliacao-modo-teste")).toHaveCount(0);
    await expect(page.getByTestId("avaliacao-dono")).not.toContainText(/CNPJ da Viva/i);

    // 3. Fora outra vez: a trava morde.
    await adm().from("vistoria_piloto").delete().eq("user_id", ids.dono);
    await page.goto(nivel, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 25_000 });
    await expect(page.getByTestId("avaliacao-dono")).toHaveCount(0);
    await page.context().close();
  });
});
