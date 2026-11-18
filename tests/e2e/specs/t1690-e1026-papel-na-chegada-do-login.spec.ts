import { test, expect, type BrowserContext } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrarNaPagina, novaSenha, novoSufixo, cnpjAleatorio } from "../fixtures/laboratorio";

/*
  T1690 — E1026 (18/11): o cabeçalho do parceiro nascia como dono logo depois do login. O papel vinha só do que o
  navegador guarda, que no login nasce "não é parceiro" e só muda quando a leitura do perfil volta. Agora o painel
  recebe do servidor o papel ativo e o usa enquanto o navegador ainda não o conhece.
  Conta com imóvel + parceria aprovada + papel ativo = parceiro (com o carimbo da escolha), a 390 e a 1280:
    1) a página de CHEGADA do login já nasce com o cabeçalho do parceiro — nunca passa pelo do dono;
    2) com a leitura do perfil pelo navegador atrasada 3 s, a tela aberta logo depois do login também nasce certa
       (antes: dono durante os 6 s das duas leituras);
    3) sem atraso nenhum, a tela aberta logo depois do login nasce certa mesmo quando a leitura do perfil da chegada
       terminou sem ser aplicada (o modo mudou no meio) — o caminho que fazia o t886 falhar às vezes.
  O t886 cobre as cargas seguintes das telas da Conta; este cobre o intervalo logo depois do login, que ele não mede.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const pessoa = { email: `chegada.t1690.${sufixo}@lab.vivanomads.test`, nome: "Paula Parceira", role: "owner" as const };
const ids: Record<string, string> = {};

/** Anota, desde o 1º quadro de cada carga, os papéis que o cabeçalho mostrou (topo do computador e sino do celular). */
async function anotarPapeis(ctx: BrowserContext) {
  await ctx.addInitScript(() => {
    const g = window as unknown as { __papeis: string[] };
    g.__papeis = [];
    const anota = () => {
      for (const e of document.querySelectorAll<HTMLElement>("header[data-papel]")) if (e.offsetParent) g.__papeis.push(`topo:${e.dataset.papel}`);
      for (const e of document.querySelectorAll<HTMLElement>('[data-testid^="sino-"][data-testid$="-celular"]')) if (e.offsetParent) g.__papeis.push(`sino:${e.dataset.testid}`);
    };
    new MutationObserver(anota).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-papel", "data-testid"] });
  });
}

test.describe("T1690 — o cabeçalho do parceiro logo depois do login (E1026)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 120_000 });
  test.beforeAll(async () => {
    ids.pessoa = await criarConta(pessoa, senha);
    await criarImovelPronto(ids.pessoa, `Studio T1690 ${sufixo}`, { ativo: true });
    const { data, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.pessoa, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: `Paula Limpeza ${sufixo}`, slug: `paula-t1690-${sufixo}`, categorias: ["limpeza"], cidades: ["Uberlândia"], descricao_curta: "Parceiro de laboratório para o teste do cabeçalho na chegada do login." })
      .select("id")
      .single();
    if (error) throw error;
    ids.parceiro = data.id as string;
    // E668: "parceiro" gravado só vale com o carimbo da escolha.
    const { error: erroPapel } = await adm().from("profiles").update({ papel_ativo: "parceiro", papel_ativo_escolhido_em: new Date().toISOString() }).eq("id", ids.pessoa);
    if (erroPapel) throw erroPapel;
  });
  test.afterAll(async () => {
    if (ids.parceiro) await adm().from("parceiros").delete().eq("id", ids.parceiro);
    await apagarContas([ids.pessoa]);
  });

  for (const w of [390, 1280] as const) {
    const cabecalhoDoParceiro = (p: import("@playwright/test").Page) =>
      w === 1280 ? p.getByTestId("topo-parceiro").getByTestId("sino-parceiro") : p.getByTestId("topo-celular").getByTestId("sino-parceiro-celular");
    const deOutroPapel = async (p: import("@playwright/test").Page) => {
      const vistos = [...new Set(await p.evaluate(() => (window as unknown as { __papeis: string[] }).__papeis))];
      return vistos.filter((v) => !v.endsWith("parceiro") && !v.endsWith("parceiro-celular"));
    };

    test(`a ${w} px: a página de chegada do login nasce com o cabeçalho do parceiro`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      await anotarPapeis(ctx);
      const p = await entrarNaPagina(await ctx.newPage(), pessoa.email, senha);
      await expect(cabecalhoDoParceiro(p), "cabeçalho do parceiro na chegada").toBeVisible({ timeout: 30_000 });
      await p.waitForTimeout(2500);
      expect(await deOutroPapel(p), `chegada do login (${new URL(p.url()).pathname}): cabeçalho de outro papel`).toEqual([]);
      await p.screenshot({ path: `tests/laboratorio/saida/t1690-chegada-${w}.png` });
      await ctx.close();
    });

    test(`a ${w} px: com a leitura do perfil atrasada, a tela aberta logo depois do login nasce certa`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      await anotarPapeis(ctx);
      // Só as leituras que o NAVEGADOR faz do perfil atrasam; o servidor lê o banco por dentro.
      await ctx.route("**/rest/v1/profiles*", async (rota) => {
        await new Promise((r) => setTimeout(r, 3_000));
        await rota.continue();
      });
      const p = await entrarNaPagina(await ctx.newPage(), pessoa.email, senha);
      await p.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
      await expect(cabecalhoDoParceiro(p), "cabeçalho do parceiro antes de o perfil voltar").toBeVisible({ timeout: 2_500 });
      await p.waitForTimeout(2500);
      expect(await deOutroPapel(p), "/dashboard/conta/perfil: cabeçalho de outro papel").toEqual([]);
      await ctx.close();
    });

    test(`a ${w} px: a tela aberta logo depois do login nasce com o cabeçalho do parceiro (leitura da chegada não aplicada)`, async ({ browser }) => {
      // 2ª causa (18/11): na chegada, a leitura do perfil pode terminar SEM ser aplicada — o ModeInitializer muda o modo de
      // null para o do servidor no meio, e o AuthProvider toma isso por troca da pessoa. O navegador fica a guardar "não é
      // parceiro", e a tela seguinte não pode acreditar nisso. Acontece numa parte das vezes (4 em 24 no laboratório, com a
      // 1ª versão desta correção); por isso o caso roda sem atraso nenhum, como o t886 faz, e conta com as repetições.
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      await anotarPapeis(ctx);
      const p = await entrarNaPagina(await ctx.newPage(), pessoa.email, senha);
      await p.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
      await expect(cabecalhoDoParceiro(p), "cabeçalho do parceiro na tela seguinte").toBeVisible({ timeout: 20_000 });
      await p.waitForTimeout(2500);
      expect(await deOutroPapel(p), "/dashboard/conta/perfil, logo depois do login: cabeçalho de outro papel").toEqual([]);
      await ctx.close();
    });
  }
});
