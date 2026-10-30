import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T701 — E261 (QA, 30/10): o editor de seções do anúncio JÁ PUBLICADO roda as MESMAS checagens do Passo 7 do assistente
  (título × tipo, título × quartos, título × bairro) e mostra os mesmos avisos não bloqueantes ("Confira se está certo
  (você pode manter)"), sem impedir o salvamento. Nas duas larguras (1280 e 390):
   1. o título que bate com o anúncio (studio, 1 quarto) não avisa nada — nem com o tipo gravado como "Studio";
   2. "Casa com 3 quartos…" num studio de 1 quarto: os dois avisos aparecem; "Salvar seção" grava mesmo assim e os
      avisos continuam à vista.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t701.${sufixo}@lab.vivanomads.test`, nome: "Edu Editor", role: "owner" as const };
const ids: { dono?: string; imovel: Record<number, string> } = { imovel: {} };
const LARGURAS = [1280, 390] as const;

test.describe("T701 — E261: avisos de consistência do título no editor do anúncio publicado", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    for (const l of LARGURAS) ids.imovel[l] = await criarImovelPronto(ids.dono, `Studio mobiliado ${l} ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono!]);
  });

  for (const largura of LARGURAS) {
    test(`${largura} px: os avisos do Passo 7 no editor, e salvar segue livre`, async ({ browser }) => {
      const id = ids.imovel[largura];
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto(`/dashboard/imoveis/${id}/editar`, { waitUntil: "domcontentloaded" });
      const secao = p.getByTestId("secao-titulo-descricao");
      await secao.getByRole("button", { name: /Título & descrição/ }).click();
      const titulo = secao.getByPlaceholder(/Studio mobiliado com home office/);
      await expect(titulo).toHaveValue(`Studio mobiliado ${largura} ${sufixo}`, { timeout: 20_000 });
      // 1. Título coerente: nada a conferir.
      await expect(secao.getByTestId("aviso-titulo-consistencia")).toHaveCount(0);

      // 2. Título que contradiz o tipo e os quartos.
      const novo = `Casa com 3 quartos mobiliada ${sufixo}`;
      await titulo.fill(novo);
      const avisos = secao.getByTestId("aviso-titulo-consistencia");
      await expect(avisos).toContainText("O título diz casa, mas o tipo do anúncio é studio/kitnet. Confira se está certo (você pode manter).");
      await expect(avisos).toContainText("O título diz 3 quartos, mas o anúncio tem 1 quarto. Confira se está certo (você pode manter).");
      await secao.getByRole("button", { name: "Salvar seção" }).click();
      await expect(secao.getByText("Alterações salvas.")).toBeVisible({ timeout: 20_000 });
      await expect(avisos, "os avisos seguem à vista depois de salvar").toBeVisible();
      await expect
        .poll(async () => (await adm().from("properties").select("title, status").eq("id", id).single()).data, { timeout: 20_000 })
        .toEqual({ title: novo, status: "active" });
      await avisos.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await p.screenshot({ path: `${SAIDA}/t701-editor-avisos-${largura}.png` });
      expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await p.context().close();
    });
  }
});
