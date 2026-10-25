import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPasso, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T547 — E148-A (#1399), guarda permanente da Pista C: o Passo 7 (Título e descrição) nunca abre vazio. No laboratório a
  IA não responde, então vale o modelo fixo (src/lib/anuncio/texto-sugerido.ts), montado só com o que o dono informou:
   1. rascunho com Apartamento, 2 quartos, 1 banheiro, 55 m², Santa Mônica/Uberlândia e título e descrição VAZIOS → o
      passo abre com "Apartamento mobiliado de 2 quartos no Santa Mônica" e a descrição com quartos, banheiro, área e
      "Para estadias de 30 a 180 dias." — sem rua nem número (nada de endereço exato);
   2. rascunho com a descrição escrita pelo dono → nada é sobrescrito (a sugestão só entra com os dois campos vazios).
  A 390 e 1280 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t547.${sufixo}@lab.vivanomads.test`, nome: "Sara Sugestão", role: "owner" as const };
const ids: Record<string, string> = {};
const BASE = {
  propertyType: "apartamento",
  bedrooms: "2",
  bathrooms: "1",
  areaM2: "55",
  neighborhood: "Santa Mônica",
  city: "Uberlândia",
  street: "Rua Particular do Laboratório",
  numero: "987",
};
const TEXTO_DO_DONO = "Apartamento claro, com varanda e vista para o parque. Escrito pelo dono, palavra por palavra.";

test.describe("T547 — E148-A: o Passo 7 abre com o texto do modelo e não pisa no texto do dono", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (IA desligada: vale o modelo fixo).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.vazio390 = await prepararRascunho(ids.dono, `Rascunho t547 a ${sufixo}`, { ...BASE, title: "", description: "" });
    ids.vazio1280 = await prepararRascunho(ids.dono, `Rascunho t547 b ${sufixo}`, { ...BASE, title: "", description: "" });
    ids.doDono = await prepararRascunho(ids.dono, `Rascunho t547 c ${sufixo}`, { ...BASE, title: "", description: TEXTO_DO_DONO });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`1. a ${w} px: título e descrição vazios → o texto do modelo, só com os dados do cadastro`, async ({ browser }) => {
      const page = await abrirPasso(browser, { email: dono.email, senha }, w === 390 ? ids.vazio390 : ids.vazio1280, "descricao", w);
      const titulo = page.getByTestId("cadastro-titulo");
      const descricao = page.getByTestId("cadastro-descricao");
      await expect(titulo).toHaveValue("Apartamento mobiliado de 2 quartos no Santa Mônica", { timeout: 30_000 });
      const texto = await descricao.inputValue();
      console.log(`t547 ${w}: descrição "${texto}"`);
      expect(texto).toContain("Apartamento mobiliado com 2 quartos, 1 banheiro e 55 m².");
      expect(texto.trim().endsWith("Para estadias de 30 a 180 dias.")).toBe(true);
      expect(texto, "endereço exato na descrição").not.toContain(BASE.street);
      expect(texto).not.toContain(BASE.numero);
      await page.screenshot({ path: `tests/laboratorio/saida/t547-modelo-${w}.png` });
      await page.context().close();
    });
  }

  test("2. a 1280 px: a descrição do dono fica como está", async ({ browser }) => {
    const page = await abrirPasso(browser, { email: dono.email, senha }, ids.doDono, "descricao", 1280);
    await expect(page.getByTestId("cadastro-descricao")).toHaveValue(TEXTO_DO_DONO, { timeout: 30_000 });
    await page.waitForTimeout(3_000);
    await expect(page.getByTestId("cadastro-descricao"), "a sugestão sobrescreveu o texto do dono").toHaveValue(TEXTO_DO_DONO);
    await page.context().close();
  });
});
