import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1714 — E1077 (ORDEM-DUET-369): a avaliação do imóvel em âmbito de TESTE. Com a VISTORIA_ATIVA desligada (e sem o
  cookie do laboratório), só a conta que está em vistoria_piloto vê o fluxo.
  Opção (a) da ORDEM-DUET-375: o dono do piloto é também conta de teste (profiles.is_teste) — o piloto corre inteiro no
  âmbito de teste.
   0. dono REAL fora do piloto: em Meus imóveis › Nível, ruído e extras não aparece o bloco "Pedir avaliação" — como hoje;
   1. dono de teste FORA do piloto: só o bloco de conferência (aviso de só leitura), como hoje — as ações não rodam;
   2. o MESMO dono, posto no piloto: o bloco aparece ativo (sem o aviso de só leitura);
   3. tirado do piloto: volta à só leitura (a trava morde).
  390 px (o login do laboratório abre a 390).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1714.${sufixo}@lab.vivanomads.test`, nome: "Dalva Piloto", role: "owner" as const };
const real = { email: `real.t1714.${sufixo}@lab.vivanomads.test`, nome: "Reinaldo Fora", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T1714 — E1077: a avaliação do imóvel só para as contas do piloto", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    const { error } = await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    if (error) throw error;
    ids.imovel = await criarImovelPronto(ids.dono, `Casa do piloto ${sufixo}`, { ativo: true, preco: 2400 });
    ids.real = await criarConta(real, senha);
    ids.imovelReal = await criarImovelPronto(ids.real, `Casa fora do piloto ${sufixo}`, { ativo: true, preco: 2400 });
  });
  test.afterAll(async () => {
    if (ids.dono) await adm().from("vistoria_piloto").delete().eq("user_id", ids.dono);
    for (const im of [ids.imovel, ids.imovelReal]) if (im) await adm().from("properties").delete().eq("id", im);
    await apagarContas([ids.dono, ids.real].filter(Boolean));
  });

  test("dono real fora do piloto não vê nada; dono de teste só confere; no piloto o bloco fica ativo; tirado, volta à só leitura", async ({ browser }) => {
    // 0. Dono real, fora do piloto: nada.
    const fora = await entrar(browser, real.email, senha);
    await fora.goto(`/dashboard/imoveis/${ids.imovelReal}/nivel`, { waitUntil: "domcontentloaded" });
    await expect(fora.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 25_000 });
    await expect(fora.getByTestId("avaliacao-dono")).toHaveCount(0);
    await fora.context().close();

    const page = await entrar(browser, dono.email, senha);
    const nivel = `/dashboard/imoveis/${ids.imovel}/nivel`;

    // 1. Dono de teste fora do piloto: só conferência.
    await page.goto(nivel, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("avaliacao-dono")).toBeVisible({ timeout: 25_000 });
    await expect(page.getByTestId("avaliacao-modo-teste")).toBeVisible();

    // 2. No piloto: o bloco aparece, ativo.
    const { error } = await adm().from("vistoria_piloto").insert({ user_id: ids.dono, nota: "T1714 (laboratório)" });
    expect(error).toBeNull();
    await page.goto(nivel, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("avaliacao-dono")).toBeVisible({ timeout: 25_000 });
    await expect(page.getByTestId("avaliacao-modo-teste")).toHaveCount(0);
    await expect(page.getByTestId("avaliacao-dono")).not.toContainText(/CNPJ da Viva/i);

    // 3. Fora outra vez: a trava morde (volta à só leitura).
    await adm().from("vistoria_piloto").delete().eq("user_id", ids.dono);
    await page.goto(nivel, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("avaliacao-dono")).toBeVisible({ timeout: 25_000 });
    await expect(page.getByTestId("avaliacao-modo-teste")).toBeVisible();
    await page.context().close();
  });
});
