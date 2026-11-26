import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2232 — E1145 (ORDEM-DUET-632): em /parceiros, a recusa de contacto aparece UMA vez, junto do campo @E1145
  Só no laboratório. Achado da perna 1 da passagem (23/11): a mesma frase aparecia junto do campo e outra vez abaixo
  da linha "Regra 90/10". A trava conta a frase no formulário: 1, e é a do campo (sp-erro-descricao); o aviso geral
  (seja-parceiro-erro) não aparece. Nada é gravado.
*/
const AVISO = "Para sua segurança e registro, o contato acontece pela plataforma — remova telefone, e-mail ou apps de mensagem do texto.";
const senha = novaSenha();
const sufixo = novoSufixo();
const candidata = { email: `cand.t2232.${sufixo}@lab.vivanomads.test`, nome: "Clara Candidata", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T2232 — E1145: a recusa de contacto aparece uma vez só, junto do campo @E1145", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.candidata = await criarConta(candidata, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.candidata]);
  });

  for (const largura of [390, 1280]) {
    test(`${largura}px: telefone na descrição → a frase uma vez, no campo da descrição`, async ({ browser }) => {
      const page = await entrar(browser, candidata.email, senha);
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/parceiros#quero-ser-parceiro", { waitUntil: "domcontentloaded" });
      const form = page.getByTestId("seja-parceiro-form");
      await expect(form).toBeVisible({ timeout: 30_000 });
      await form.locator("#sp-nome").fill("Clara Limpezas");
      await form.locator("#sp-doc").fill(cnpjAleatorio());
      await page.getByTestId("sp-cat-limpeza").check();
      await form.locator("#sp-cidades").fill("Uberlândia");
      await form.locator("#sp-descricao").fill("Limpeza de rotina. Chama no zap 34 99876-5432");
      await form.getByText("Sim", { exact: true }).click();
      await page.getByTestId("sp-aceite").check();
      await page.getByTestId("seja-parceiro-enviar").click();
      await expect(page.getByTestId("sp-erro-descricao")).toHaveText(AVISO, { timeout: 20_000 });
      // E1145: uma vez só — o aviso geral abaixo da "Regra 90/10" não repete a frase.
      await expect(page.getByTestId("seja-parceiro-erro")).toHaveCount(0);
      const vezes = (await form.innerText()).split(AVISO).length - 1;
      expect(vezes, "a frase aparece uma única vez no formulário").toBe(1);
      const { count } = await adm().from("parceiro_solicitacoes").select("id", { count: "exact", head: true }).eq("user_id", ids.candidata);
      expect(count ?? 0, "nenhum pedido gravado").toBe(0);
      await page.context().close();
    });
  }
});
