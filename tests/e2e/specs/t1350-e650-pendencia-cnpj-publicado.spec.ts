import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1350 — E650 (#3013, na main): o parceiro PESSOA FÍSICA (legado) que já está publicado vê, no painel
  (/dashboard/parceiro), a pendência do CNPJ (parceiro-pendencia-cnpj-publicado). Antes, quem já tinha publicado saía da
  busca (E648) sem o painel explicar nem pedir o CNPJ. Um parceiro PJ publicado não vê o aviso. 390 e 1280 px, sem estouro.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const pf = { email: `pf.t1350.${sufixo}@lab.vivanomads.test`, nome: "Paula Parceira Fisica", role: "tenant" as const };
const pj = { email: `pj.t1350.${sufixo}@lab.vivanomads.test`, nome: "Pedro Parceiro Empresa", role: "tenant" as const };
const ids: { pf?: string; pj?: string } = {};

const cnpjValido = () => {
  const base = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).concat([0, 0, 0, 1]);
  const dv = (d: number[]) => {
    const pesos = d.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = d.reduce((s, x, i) => s + x * pesos[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(base);
  const d2 = dv([...base, d1]);
  return [...base, d1, d2].join("");
};

test.describe("T1350 — E650: pendência do CNPJ no painel do parceiro já publicado", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.pf = await criarConta(pf, senha);
    ids.pj = await criarConta(pj, senha);
    const base = { categorias: ["limpeza"], cidades: ["Uberlândia"], status: "publicado" };
    const a = await adm().from("parceiros").insert({ ...base, user_id: ids.pf, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: `Paula PF ${sufixo}`, slug: `t1350-pf-${sufixo}` });
    if (a.error) throw a.error;
    const b = await adm().from("parceiros").insert({ ...base, user_id: ids.pj, tipo_pessoa: "pj", documento: cnpjValido(), nome_publico: `Pedro PJ ${sufixo}`, slug: `t1350-pj-${sufixo}` });
    if (b.error) throw b.error;
  });
  test.afterAll(async () => {
    await adm().from("parceiros").delete().in("user_id", [ids.pf ?? "", ids.pj ?? ""]);
    await apagarContas([ids.pf, ids.pj]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: o PF publicado vê a pendência do CNPJ; o PJ publicado não`, async ({ browser }) => {
      const doPf = await entrar(browser, pf.email, senha);
      await doPf.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await doPf.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
      const aviso = doPf.getByTestId("parceiro-pendencia-cnpj-publicado");
      await expect(aviso).toBeVisible({ timeout: 30_000 });
      await expect(aviso).toContainText(/CNPJ/);
      expect(await doPf.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await doPf.context().close();

      const doPj = await entrar(browser, pj.email, senha);
      await doPj.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await doPj.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
      await expect(doPj.locator("main").first()).toBeVisible({ timeout: 30_000 });
      await expect(doPj.getByTestId("parceiro-pendencia-cnpj-publicado")).toHaveCount(0);
      await doPj.context().close();
    });
  }
});
