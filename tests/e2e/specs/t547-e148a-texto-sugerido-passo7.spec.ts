// Portão pós-#1500 (Pista C, 29/10): o E193 (#1496) trocou listas e caixas por pílulas e cartões no assistente e no editor; roda no lab-crítico deste PR.
import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPasso, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T547 — E148-A (#1399), guarda permanente da Pista C, no que a t484 da Pista A não cobre: o TEXTO EXATO do modelo fixo
  (src/lib/anuncio/texto-sugerido.ts, a IA não responde no laboratório) a 390 e 1280, e nada de endereço exato:
   1. rascunho com Apartamento, 2 quartos, 1 banheiro, 55 m², Santa Mônica/Uberlândia e título e descrição VAZIOS → o
      passo abre com "Apartamento mobiliado de 2 quartos no Santa Mônica" e a descrição com quartos, banheiro, área e
      "Para estadias de 30 a 180 dias." — sem rua nem número (nada de endereço exato);
  (O texto do dono não ser sobrescrito é da t484.)
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

test.describe("T547 — E148-A: o texto exato do modelo no Passo 7, sem endereço", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (IA desligada: vale o modelo fixo).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.vazio390 = await prepararRascunho(ids.dono, `Rascunho t547 a ${sufixo}`, { ...BASE, title: "", description: "" });
    ids.vazio1280 = await prepararRascunho(ids.dono, `Rascunho t547 b ${sufixo}`, { ...BASE, title: "", description: "" });
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

});
