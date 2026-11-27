import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";
import { prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T2124 — E618 @E618: no Passo 7 os campos não prometem sugestão, e a sugestão sempre chega.
  Regra decidida (E618; unitário e618-sugestao-sem-promessa.test.ts):
    (1) título e descrição mostram o exemplo como placeholder ("Ex.: Studio mobiliado no Centro" / "Descreva o
        imóvel…"), nunca "Escrevendo uma sugestão…"; o aviso de que a sugestão vem fica à parte, como status;
    (2) o pedido à IA tem tempo máximo: se a resposta não volta, entra o texto pronto (modelo fixo) no cartão.
  Para provar (2) de forma determinística, a rota da IA fica PENDURADA (o navegador nunca recebe resposta). O cartão tem
  de chegar com o texto pronto mesmo assim, e os campos seguem vazios (E613: a sugestão só entra no clique do dono).
  390 e 1280 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2124.${sufixo}@lab.vivanomads.test`, nome: "Sofia Sugestao", role: "owner" as const };
const ids: Record<string, string> = {};
const DADOS = { propertyType: "apartamento", bedrooms: "2", bathrooms: "1", areaM2: "58", neighborhood: "Santa Mônica", internetMbps: "300", amenityKeys: { ar_condicionado: true } };
/** A sugestão tem de chegar dentro do teto (15 s no código de hoje) com folga para o laboratório; sem teto, nunca chega. */
const ESPERA_MAX_MS = 40_000;

test.describe("T2124 — E618: Passo 7 sem promessa no campo, e a sugestão chega mesmo com a IA calada @E618", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — IA sem resposta: o campo mostra o exemplo e o texto pronto chega ao cartão`, async ({ browser }) => {
      const id = await prepararRascunho(ids.dono, `Rascunho T2124 ${largura} ${sufixo}`, { ...DADOS, title: "", description: "" }, 0);
      const contexto = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      let chamadas = 0;
      // A IA nunca responde: o pedido fica pendurado até o navegador desistir.
      await contexto.route("**/api/ai/anuncio", () => {
        chamadas++;
      });
      const page = await entrarNaPagina(await contexto.newPage(), dono.email, senha);
      await page.goto(`/dashboard/imoveis/novo?draft=${id}&etapa=descricao`, { waitUntil: "domcontentloaded" });
      await noPasso(page, "descricao", 30_000);

      // (1) os campos mostram o exemplo; o aviso fica à parte, como status
      await expect(page.getByTestId("cadastro-titulo")).toHaveAttribute("placeholder", "Ex.: Studio mobiliado no Centro");
      await expect(page.getByTestId("cadastro-descricao")).toHaveAttribute("placeholder", "Descreva o imóvel…");
      await expect(page.getByTestId("sugestao-preparando"), "o aviso de que a sugestão vem, à parte").toBeVisible({ timeout: 15_000 });
      expect(chamadas, "a sugestão foi pedida ao entrar").toBeGreaterThan(0);
      await expect(page.locator("main")).not.toContainText("Escrevendo uma sugestão");

      // (2) sem resposta da IA, o texto pronto chega ao cartão dentro do teto
      const inicio = Date.now();
      await expect(page.getByTestId("sugestao-titulo"), "o texto pronto chega mesmo com a IA calada").toHaveText(
        "Apartamento mobiliado de 2 quartos no Santa Mônica",
        { timeout: ESPERA_MAX_MS },
      );
      expect(Date.now() - inicio).toBeLessThan(ESPERA_MAX_MS);
      await expect(page.getByTestId("sugestao-preparando"), "o aviso sai quando a sugestão chega").toHaveCount(0);
      await expect(page.getByTestId("sugestao-descricao")).toContainText("2 quartos, 1 banheiro e 58 m²");
      // E613: nada entra sozinho nos campos.
      await expect(page.getByTestId("cadastro-titulo")).toHaveValue("");
      await expect(page.getByTestId("cadastro-descricao")).toHaveValue("");
      await expect(page.locator("main")).not.toContainText("Escrevendo uma sugestão");

      await contexto.close();
      await adm().from("properties").delete().eq("id", id);
    });
  }
});
