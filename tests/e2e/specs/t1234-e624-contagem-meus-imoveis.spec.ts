import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1234 — E624 (#2867): "Meus imóveis" com UMA contagem, a do anúncio. Antes: abas 29, "Mostrar mais (12 de 17)" e 31 com
  as cópias de rascunho abertas — três números na mesma tela. Agora a unidade é o anúncio em toda superfície, e a cópia
  aberta vem junto do pai, sem ocupar vaga, e a frase a nomeia.
  Semeia 12 anúncios publicados + um rascunho com uma cópia (14 linhas no banco = 13 anúncios, 12 por página) e confere,
  a 390 e a 1280 px:
   - aba "Todos (13)" e "Mostrando 12 de 13 imóveis" (a cópia fechada não conta);
   - o botão "Mostrar mais 1" (o que falta em anúncios, não em linhas);
   - ao abrir a cópia: a frase passa a "(+ 1 cópia de rascunho aberta)" e a aba continua 13;
   - "Mostrar mais 1" soma a 2ª página: "13 imóveis (+ 1 cópia de rascunho aberta)" e o botão some.
  Complementa a t810 (cópia/rascunho sem foto) e o teste unitário e624-contagem-meus-imoveis.test.ts.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1234.${sufixo}@lab.vivanomads.test`, nome: "Cora Contagem", role: "owner" as const };
const ids: Record<string, string> = {};
const REPETIDO = `Studio repetido t1234 ${sufixo}`;
const PUBLICADOS = 12;

test.describe("T1234 — E624: Meus imóveis conta anúncios, uma vez só", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true, preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    for (let i = 0; i < PUBLICADOS; i++) {
      ids[`pub${i}`] = await criarImovelPronto(ids.dono, `Publicado ${String(i).padStart(2, "0")} t1234 ${sufixo}`, { ativo: true, preco: 2800 + i });
    }
    ids.antigo = await criarImovelPronto(ids.dono, REPETIDO, { semInternet: true, semConforto: true });
    ids.novo = await criarImovelPronto(ids.dono, REPETIDO, { semInternet: true, semConforto: true });
    await adm().from("properties").update({ created_at: new Date(Date.now() - 86_400_000).toISOString() }).eq("id", ids.antigo);
    await adm().from("property_photos").delete().in("property_id", [ids.antigo, ids.novo]);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: a aba, a frase e o botão contam anúncios; a cópia aberta é nomeada e não ocupa vaga`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      const cartao = (id: string) => p.locator(`[data-testid="meu-anuncio"][data-imovel="${id}"]`);
      const contagem = p.getByTestId("imoveis-contagem");
      const maisBtn = p.getByTestId("imoveis-mostrar-mais");
      await expect(contagem).toBeVisible({ timeout: 30_000 });

      // 13 anúncios (a cópia fechada fora da conta): aba, frase e botão dizem o mesmo número.
      await expect(p.getByTestId("imoveis-aba-todos")).toContainText("(13)");
      await expect(contagem).toHaveText("Mostrando 12 de 13 imóveis");
      await expect(maisBtn).toHaveText("Mostrar mais 1");
      await expect(cartao(ids.novo)).toBeVisible();
      await expect(cartao(ids.antigo)).toHaveCount(0);
      await expect(p.getByTestId("meu-anuncio")).toHaveCount(12);

      // Abre a cópia: ela vem junto do pai, a frase a nomeia, a aba e o botão não mudam.
      await cartao(ids.novo).getByTestId("rascunho-copias").click();
      await expect(cartao(ids.antigo)).toBeVisible();
      await expect(contagem).toHaveText("Mostrando 12 de 13 imóveis (+ 1 cópia de rascunho aberta)");
      await expect(p.getByTestId("imoveis-aba-todos")).toContainText("(13)");
      await expect(maisBtn).toHaveText("Mostrar mais 1");
      await expect(p.getByTestId("meu-anuncio")).toHaveCount(13);
      await p.screenshot({ path: `${SAIDA}/t1234-contagem-${w}.png`, fullPage: true });

      // 2ª página: todos os 13 anúncios + a cópia; o botão some e a frase fecha a conta.
      await maisBtn.click();
      await expect(contagem).toHaveText("13 imóveis (+ 1 cópia de rascunho aberta)");
      await expect(maisBtn).toHaveCount(0);
      await expect(p.getByTestId("meu-anuncio")).toHaveCount(14);
      expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await p.context().close();
    });
  }
});
