import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2216 — E1080 (a) (ORDEM-DUET-385): a grade de serviços traz a opção de AVALIAÇÃO DO IMÓVEL. Só no laboratório.
  TRAVA EM RASCUNHO: nasce vermelha na main de hoje (a grade só tem as categorias de parceiro: fotografia, limpeza,
  lavanderia, montagem, mudança, reparos) e fica verde quando o E1080 entrar.
  Referência: o mockup aprovado `docs/mockups-avaliadores/morador-servico-avaliador-mobile.webp` (E1079). A lista
  "Pedir um serviço" traz uma linha "Avaliação do imóvel", com a frase "Laudo com o nível do imóvel" e a foto redonda à
  direita, entre os outros serviços. O que a trava cobra, nas duas telas que mostram os serviços (Serviços e o Início
  do painel), a 390 e a 1280 px: a linha "Avaliação do imóvel" está lá, com a frase, e leva a quem avalia (um caminho de
  avaliadores). A conformidade visual elemento a elemento é da QA print × mockup do Gerente e da trava (c).
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
        await expect(page.locator("main"), `${rota}: a página abriu`).toBeVisible({ timeout: 30_000 });
        const opcao = page.locator("main").getByRole("link", { name: /Avalia[çc][ãa]o do im[óo]vel/i });
        await expect(opcao.first(), `E1080 (a) ${rota}: a opção "Avaliação do imóvel" está nos serviços`).toBeVisible({ timeout: 20_000 });
        expect.soft(await opcao.first().innerText(), `E1080 (a) ${rota}: com a frase do mockup`).toMatch(/Laudo com o n[íi]vel do im[óo]vel/i);
        expect.soft((await opcao.first().getAttribute("href")) ?? "", `E1080 (a) ${rota}: a opção leva a quem avalia`).toMatch(/avaliador/);
      }
      await page.context().close();
    });
  }
});
