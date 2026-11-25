import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1745 — E1093 @E1093 (ORDENS 446 e 565, linha Parceiros): as secções do painel do dono não somem entre uma carga e a
  seguinte. Só contas de teste; laboratório, não é prova ao vivo no site.
   1. RECARREGA e confere. A dona com dois imóveis ativos: no Início, o bloco principal é o de quem tem anúncios (leva
      a "Ver meus anúncios"), nunca "Anuncie seu primeiro imóvel", e não há aviso de leitura falhada; a barra é a do
      dono (Anúncios, Interessados, Contratos). Em Serviços, o cartão "Avaliação do imóvel" está na grade. Recarrega três
      vezes cada página e confere tudo de novo, a cada recarga. 390 e 1280 px.
   2. "NÃO LI" NÃO É "NÃO TEM". A dona a usar o painel como moradora tem "Modo proprietário" no menu da Conta. A rota do
      menu passa a responder que NÃO conseguiu ler os imóveis (naoLidos) — o que o servidor responde quando a leitura
      falha. A casca fica com o que já sabia: "Modo proprietário" continua lá, e a leitura é repetida sozinha. Depois a
      rota responde 503: continua lá. 390 e 1280 px.
  O servidor a falhar de verdade (a sessão por confirmar, o banco a dar erro) não se simula aqui: está nas travas de
  unidade (e1093-*.test.ts) e na prova local com falhas injetadas, descrita no PR.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const ROTA = "/api/painel/contadores";
const senha = novaSenha();
const sufixo = novoSufixo();
// role "tenant": a conta que se cadastrou para morar e depois anunciou (é dona pelos imóveis que tem).
const dona = { email: `dona.t1745.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "tenant" as const };
const ids: Record<string, string> = {};
const RECARGAS = 3;

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
async function gravarModo(conta: string, modo: "owner" | "tenant") {
  // O que a troca de papel pela tela grava (setPreferredMode): o modo e o papel ativo.
  const { error } = await adm().from("profiles").update({ preferred_mode: modo, papel_ativo: modo === "owner" ? "proprietario" : "morador" }).eq("id", conta);
  if (error) throw error;
}
const barraDoDono = (page: Page, w: number) => (w === 390 ? page.getByRole("navigation", { name: "Navegação principal" }) : page.getByTestId("abas-dono"));

/** O Início de quem tem anúncios: o bloco leva aos anúncios, a barra é a do dono, nada de "primeiro imóvel" nem de aviso. */
async function conferirInicioDeDona(page: Page, w: number, quando: string) {
  const bloco = page.getByTestId("inicio-dono-principal");
  await expect(bloco, `${quando}: o bloco principal do dono`).toBeVisible({ timeout: 30_000 });
  await expect(bloco, `${quando}: o bloco é de quem tem anúncios`).toHaveAttribute("data-tipo", /^(em_dia|decisao)$/);
  await expect(bloco, `${quando}: nunca "primeiro imóvel" para quem tem imóveis`).not.toContainText("Anuncie seu primeiro imóvel");
  await expect(page.getByTestId("inicio-sem-leitura"), `${quando}: sem aviso de leitura falhada`).toHaveCount(0);
  await expect(page.getByTestId("inicio-so-morador"), `${quando}: não é o Início do morador`).toHaveCount(0);
  const barra = barraDoDono(page, w);
  for (const aba of ["Anúncios", "Interessados", "Contratos"]) await expect(barra.locator("a").filter({ hasText: aba }), `${quando}: aba ${aba}`).toHaveCount(1);
}

async function conferirCartaoDaAvaliacao(page: Page, quando: string) {
  await expect(page.getByTestId("servicos-grade"), `${quando}: a grade de Serviços`).toBeVisible({ timeout: 30_000 });
  const cartao = page.getByTestId("servicos-avaliacao");
  await expect(cartao, `${quando}: o cartão da avaliação`).toBeVisible();
  await expect(cartao).toContainText("Avaliação do imóvel");
}

test.describe("T1745 — E1093: as secções do painel do dono continuam lá depois de recarregar @E1093", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dona = await criarConta(dona, senha);
    const t = await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dona);
    if (t.error) throw t.error;
    ids.a = await criarImovelPronto(ids.dona, `[TESTE QA] t1745 Casa A ${sufixo}`, { ativo: true });
    ids.b = await criarImovelPronto(ids.dona, `[TESTE QA] t1745 Casa B ${sufixo}`, { ativo: true });
  });

  test.afterAll(async () => {
    const imoveis = [ids.a, ids.b].filter(Boolean);
    if (imoveis.length) await adm().from("properties").delete().in("id", imoveis);
    await apagarContas([ids.dona].filter(Boolean));
  });

  test("1. recarregar não tira nada: o Início, a barra do dono e o cartão da avaliação em Serviços continuam lá a cada recarga", async ({ browser }) => {
    await gravarModo(ids.dona, "owner");
    const p = await entrar(browser, dona.email, senha);
    for (const w of LARGURAS) {
      await largura(p, w);
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await conferirInicioDeDona(p, w, `Início a ${w} px, 1ª carga`);
      for (let i = 1; i <= RECARGAS; i++) {
        await p.reload({ waitUntil: "domcontentloaded" });
        await conferirInicioDeDona(p, w, `Início a ${w} px, recarga ${i}`);
      }
      await p.screenshot({ path: `${SAIDA}/t1745-1-inicio-depois-de-recarregar-${w}.png`, fullPage: true });

      await p.goto("/dashboard/servicos", { waitUntil: "domcontentloaded" });
      await conferirCartaoDaAvaliacao(p, `Serviços a ${w} px, 1ª carga`);
      for (let i = 1; i <= RECARGAS; i++) {
        await p.reload({ waitUntil: "domcontentloaded" });
        await conferirCartaoDaAvaliacao(p, `Serviços a ${w} px, recarga ${i}`);
      }
      await p.getByTestId("servicos-avaliacao").scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t1745-1-servicos-depois-de-recarregar-${w}.png` });
    }
    await p.context().close();
  });

  test("2. 'não li' não é 'não tem': com a rota do menu sem conseguir ler os imóveis, a dona em modo morador continua com 'Modo proprietário', e a leitura repete-se", async ({ browser }) => {
    await gravarModo(ids.dona, "tenant");
    const p = await entrar(browser, dona.email, senha);
    for (const w of LARGURAS) {
      await largura(p, w);
      await p.unroute(ROTA);
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const id = w === 390 ? "conta-morador-celular" : "conta-morador";
      const botao = w === 390 ? p.getByTestId("topo-celular").getByTestId(id) : p.getByTestId(id);
      const modoProprietario = p.getByTestId(`${id}-modo-proprietario`);
      const abrirConta = async () => {
        if (!(await p.getByTestId(`menu-${id}`).isVisible())) await botao.click();
        await expect(p.getByTestId(`menu-${id}`)).toBeVisible();
      };
      const fecharConta = async () => {
        if (await p.getByTestId(`menu-${id}`).isVisible()) await botao.click();
      };
      await expect(botao).toBeVisible({ timeout: 30_000 });
      // A massa, antes da falha: a casca sabe que a conta tem imóvel.
      await abrirConta();
      await expect(modoProprietario, `a ${w} px, antes da falha`).toBeVisible({ timeout: 15_000 });
      await fecharConta();

      // A rota passa a responder o que o servidor responde quando NÃO consegue ler os imóveis.
      // (A resposta verdadeira é lida uma vez; a casca cancela a leitura em curso quando pede outra, por isso o
      // fulfill de uma leitura cancelada pode falhar — não é o que se confere aqui.)
      const verdadeira = (await (await p.request.get(ROTA)).json()) as Record<string, unknown>;
      expect(verdadeira.temImovel, "a massa: o servidor sabe que a conta tem imóvel").toBe(true);
      let naoLidas = 0;
      await p.route(ROTA, async (rota) => {
        naoLidas++;
        await rota.fulfill({ json: { ...verdadeira, temImovel: false, imoveisAtivos: 0, naoLidos: ["temImovel", "imoveisAtivos"] } }).catch(() => {});
      });
      const resposta = p.waitForResponse((r) => new URL(r.url()).pathname === ROTA);
      await p.evaluate(() => window.dispatchEvent(new Event("vn:contadores-mudaram")));
      await resposta;
      expect(naoLidas, "a casca releu pela rota").toBeGreaterThanOrEqual(1);
      await abrirConta();
      await expect(modoProprietario, `a ${w} px, com os imóveis por ler: a casca fica com o que já sabia`).toBeVisible();
      await p.screenshot({ path: `${SAIDA}/t1745-2-modo-proprietario-com-leitura-falhada-${w}.png` });
      await fecharConta();
      // Campo por ler = a casca tenta de novo sozinha (a 1ª espera é de 2 s), sem ninguém pedir.
      const antes = naoLidas;
      await expect.poll(() => naoLidas, { timeout: 12_000, message: "a leitura repete-se sozinha" }).toBeGreaterThan(antes);

      // A rota a falhar de vez (503): também não vira "conta sem imóvel".
      await p.unroute(ROTA);
      await p.route(ROTA, (rota) => rota.fulfill({ status: 503, json: { error: "Não foi possível ler agora." } }).catch(() => {}));
      const falha = p.waitForResponse((r) => new URL(r.url()).pathname === ROTA && r.status() === 503);
      await p.evaluate(() => window.dispatchEvent(new Event("vn:contadores-mudaram")));
      await falha;
      await abrirConta();
      await expect(modoProprietario, `a ${w} px, com a rota em 503`).toBeVisible();
      await fecharConta();
      await p.unroute(ROTA);
    }
    await p.context().close();
    await gravarModo(ids.dona, "owner");
  });
});
