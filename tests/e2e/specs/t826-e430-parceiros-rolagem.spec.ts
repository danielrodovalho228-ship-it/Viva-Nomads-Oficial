import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T826 — E430 (D-V12): /parceiros sem rolagem lateral para quem já tem pedido de parceria (e-mail longo na frase
  "Mandamos a confirmação para …"). 390 e 1280.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const pessoa = { email: `parceiro.fotografo.longo.t826.${sufixo}@varredura.lab.vivanomads.test`, nome: "Paula Pedido", role: "tenant" as const };
const ids: Record<string, string> = {};

test.describe("T826 — E430: /parceiros sem rolagem lateral com pedido pendente", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    ids.pessoa = await criarConta(pessoa, senha);
    const { error } = await adm().from("parceiro_solicitacoes").insert({
      user_id: ids.pessoa,
      email: pessoa.email,
      nome: pessoa.nome,
      tipo_pessoa: "pf",
      documento: cpfAleatorio(),
      categorias: ["fotografia"],
      cidades: ["Uberlândia"],
      portfolio_url: "https://exemplo.lab.vivanomads.test",
      status: "pendente",
      origem: "site",
    });
    if (error) throw error;
  });
  test.afterAll(async () => {
    await adm().from("parceiro_solicitacoes").delete().eq("user_id", ids.pessoa ?? "");
    await apagarContas([ids.pessoa]);
  });
  for (const w of [390, 1280] as const) {
    test(`a ${w} px: pedido recebido, e-mail inteiro e sem rolagem lateral`, async ({ browser }) => {
      const p = await entrar(browser, pessoa.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto("/parceiros#quero-ser-parceiro", { waitUntil: "domcontentloaded" });
      const conf = p.getByTestId("seja-parceiro-confirmacao");
      await expect(conf).toBeVisible({ timeout: 30_000 });
      await expect(conf).toContainText(pessoa.email);
      expect(await p.evaluate((largura) => document.documentElement.scrollWidth - largura, w)).toBeLessThanOrEqual(1);
      await conf.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `tests/laboratorio/saida/t826-e430-${w}.png` });
      await p.context().close();
    });
  }
});
