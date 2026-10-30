import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPasso, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T685 — E259 (3) (prova de publicação do QA, 30/10): no Passo 2, a contagem "N / 8 fotos" anda a cada foto concluída
  durante o envio ("Enviando 3 de 8…") — antes ficava em 0 até a última terminar. 1280 e 390, com prints.
*/
const SAIDA = "tests/laboratorio/saida";
const FOTOS = ["sala", "quarto-1", "quarto-2", "cozinha", "banheiro", "home-office", "varanda", "fachada"].map((n) => `public/images/imoveis/ube/ube-001-${n}.webp`);
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t685.${sufixo}@lab.vivanomads.test`, nome: "Lia Contagem", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T685 — E259 (3): a contagem do Passo 2 anda a cada foto", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    for (const w of [1280, 390]) ids[`r${w}`] = await prepararRascunho(ids.dono, `Studio Contagem ${w} ${sufixo}`, {}, 0);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [1280, 390] as const) {
    test(`${w} px — os números do meio do envio aparecem`, async ({ browser }) => {
      const p = await abrirPasso(browser, { email: dono.email, senha }, ids[`r${w}`], "fotos", w);
      const numero = p.getByTestId("fotos-contagem-numero");
      await expect(numero).toHaveText("0", { timeout: 30_000 });
      // Guarda cada valor que a contagem mostra durante o envio.
      await p.evaluate(() => {
        const w = window as unknown as { __contagens: string[] };
        w.__contagens = [];
        const alvo = document.querySelector('[data-testid="fotos-contagem-numero"]')!;
        new MutationObserver(() => w.__contagens.push(alvo.textContent ?? "")).observe(alvo, { childList: true, characterData: true, subtree: true });
      });
      await p.getByTestId("etapa-fotos").locator('input[type="file"]').first().setInputFiles(FOTOS);
      await expect(numero).toHaveText("8", { timeout: 90_000 });
      const vistos = await p.evaluate(() => (window as unknown as { __contagens: string[] }).__contagens);
      console.log(`t685 ${w}`, JSON.stringify(vistos));
      const doMeio = vistos.map(Number).filter((n) => n > 0 && n < 8);
      expect(doMeio.length, `contagens vistas: ${vistos.join(",")}`).toBeGreaterThan(0);
      await p.getByTestId("fotos-contagem").scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t685-contagem-${w}.png` });
      await p.context().close();
    });
  }
});
