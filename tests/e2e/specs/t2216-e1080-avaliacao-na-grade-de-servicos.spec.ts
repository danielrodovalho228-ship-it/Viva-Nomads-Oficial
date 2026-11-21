import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2216 — E1080 (a) (ORDEM-DUET-385): a grade de serviços traz a opção de AVALIAÇÃO DO IMÓVEL. Só no laboratório.
  TRAVA EM RASCUNHO: nasce vermelha na main de hoje (a grade só tem as categorias de parceiro: fotografia, limpeza,
  lavanderia, montagem, mudança, reparos) e fica verde quando o E1080 entrar.
  O que a trava cobra, pelo que a pessoa vê, nas duas telas que mostram a grade (Serviços e o Início do painel), a 390 e a
  1280 px: há um cartão de avaliação na mesma grade (`servicos-grade`), com o mesmo formato dos outros (foto no topo,
  nome, frase), e ele leva a quem avalia (um caminho de avaliadores). O rótulo, a foto e a frase exactas são dos mockups
  aprovados (E1079): a conformidade visual é da QA print × mockup do Gerente e da trava (c), não desta.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2216.${sufixo}@lab.vivanomads.test`, nome: "Dina Serviços", role: "owner" as const };
const ids: { dono?: string } = {};

test.describe("T2216 — E1080 (a): a avaliação do imóvel está na grade de serviços @E1080", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono].filter(Boolean) as string[]);
  });

  for (const largura of [390, 1280]) {
    test(`${largura}: a grade de Serviços tem o cartão de avaliação, no formato dos outros, a levar aos avaliadores`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      for (const rota of ["/dashboard/servicos", "/dashboard"]) {
        await page.goto(rota, { waitUntil: "domcontentloaded" });
        const grade = page.getByTestId("servicos-grade");
        await expect(grade, `${rota}: a grade de serviços está na tela`).toBeVisible({ timeout: 30_000 });
        const cartoes = grade.locator(":scope > li");
        const textos = await cartoes.allInnerTexts();
        const i = textos.findIndex((t) => /avalia[çc][ãa]o/i.test(t));
        expect(i, `E1080 (a) ${rota}: há um cartão de avaliação na grade (cartões: ${textos.map((t) => t.split("\n")[0]).join(" | ")})`).toBeGreaterThanOrEqual(0);
        const cartao = cartoes.nth(i);
        await expect.soft(cartao.getByTestId("servicos-foto"), `E1080 (a) ${rota}: o cartão de avaliação tem a foto no topo, como os outros`).toHaveCount(1);
        const href = (await cartao.locator("a").first().getAttribute("href")) ?? "";
        expect.soft(href, `E1080 (a) ${rota}: o cartão leva a quem avalia`).toMatch(/avaliador/);
      }
      await page.context().close();
    });
  }
});
