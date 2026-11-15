import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1624 — E899 (Daniel, 13/11, uso real), T4: o cartão de imóvel é enxuto em TODAS as superfícies, a 390 e 1280 px.
  O cartão tinha cerca de 9 linhas; agora o bloco de texto tem no máximo 6 (local, título, preço, total + aviso, especificações,
  disponível), sem contar o selo "Anúncio de exemplo" nem "Visto" / "Você já contatou". A composição do valor saiu do cartão (fica
  na página do imóvel): os testids cartao-total-rotulo, cartao-mes-composicao e cartao-total-composicao não existem mais.
  Superfícies: home, /buscar, uma página de cidade, /dashboard/favoritos (conta com 1 favorito) e a visão geral do painel.
  "Linha" aqui é cada item do bloco (uma fileira do cartão). Local e título têm de caber em UMA linha de texto (line-clamp-1);
  no cartão de 2 colunas do celular, total + aviso, especificações e disponível podem quebrar: são avisos que não se cortam.
*/
const LARGURAS = [390, 1280] as const;
const altura = (l: number) => (l === 390 ? 844 : 900);
const REMOVIDOS = ["cartao-total-rotulo", "cartao-mes-composicao", "cartao-total-composicao"];
const LINHAS_DO_CARTAO = ["cartao-local-linha", "cartao-titulo", "cartao-total-mes", "cartao-total-linha", "cartao-sintese", "cartao-disponivel"];
// Fora da contagem: o selo do exemplo (item 4 da ordem) e o estado de quem está logado (item 9).
const FORA_DA_CONTAGEM = ["cartao-selo-exemplo", "marca-imovel"];

interface Medida {
  href: string;
  linhas: string[];
  linhasLocal: number;
  linhasTitulo: number;
  clampLocal: string;
  clampTitulo: string;
  estouros: string[];
  aviso: string;
  total: string;
}

/** Mede todos os cartões visíveis da tela de uma vez (um único evaluate: a lista pode se reordenar depois de hidratar). */
async function medirCartoes(page: Page): Promise<Medida[]> {
  return page.evaluate((fora) => {
    const visivel = (el: Element) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    };
    const linhasDeTexto = (el: HTMLElement | null) => (el ? Math.round(el.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(el).lineHeight)) : 0);
    return [...document.querySelectorAll<HTMLElement>('[data-testid="cartao-imovel"]')].filter(visivel).map((cartao) => {
      const por = (id: string) => cartao.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      // O bloco de texto é o pai da fileira do local (abaixo da foto).
      const bloco = por("cartao-local-linha")!.parentElement as HTMLElement;
      const itens = [...bloco.children].filter(visivel) as HTMLElement[];
      const estouros = [bloco, ...bloco.querySelectorAll<HTMLElement>("*")]
        .filter((n) => visivel(n) && n.scrollWidth > n.clientWidth && getComputedStyle(n).display !== "inline")
        .map((n) => `${n.dataset.testid ?? n.tagName.toLowerCase()} (${n.scrollWidth} > ${n.clientWidth})`);
      return {
        href: cartao.querySelector("a")?.getAttribute("href") ?? "",
        linhas: itens.map((n) => n.dataset.testid ?? `sem-testid:${n.tagName.toLowerCase()}:${(n.textContent ?? "").trim().slice(0, 30)}`).filter((id) => !fora.includes(id)),
        linhasLocal: linhasDeTexto(por("cartao-local")),
        linhasTitulo: linhasDeTexto(por("cartao-titulo")),
        clampLocal: por("cartao-local") ? getComputedStyle(por("cartao-local")!).getPropertyValue("-webkit-line-clamp") : "",
        clampTitulo: por("cartao-titulo") ? getComputedStyle(por("cartao-titulo")!).getPropertyValue("-webkit-line-clamp") : "",
        estouros,
        aviso: por("cartao-aviso")?.textContent?.trim() ?? "",
        total: por("cartao-total-estadia")?.textContent?.trim() ?? "",
      };
    });
  }, FORA_DA_CONTAGEM);
}

async function conferirSuperficie(page: Page, onde: string) {
  const cartoes = page.getByTestId("cartao-imovel");
  await expect(cartoes.first(), `${onde}: há cartão de imóvel`).toBeVisible({ timeout: 40_000 });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  // Nenhuma das três linhas que saíram existe (em cartão nenhum da tela).
  for (const id of REMOVIDOS) await expect(page.getByTestId(id), `${onde}: ${id} saiu do cartão`).toHaveCount(0);
  const medidas = await medirCartoes(page);
  expect(medidas.length, `${onde}: cartões visíveis`).toBeGreaterThan(0);
  for (const m of medidas) {
    const quem = `${onde} ${m.href}`;
    expect(m.linhas.length, `${quem}: no máximo 6 linhas no bloco de texto (${m.linhas.join(", ")})`).toBeLessThanOrEqual(6);
    for (const id of m.linhas) expect(LINHAS_DO_CARTAO, `${quem}: só as linhas do cartão enxuto`).toContain(id);
    expect(m.clampLocal, `${quem}: local com line-clamp-1`).toBe("1");
    expect(m.clampTitulo, `${quem}: título com line-clamp-1`).toBe("1");
    expect(m.linhasLocal, `${quem}: local em 1 linha`).toBe(1);
    expect(m.linhasTitulo, `${quem}: título em 1 linha`).toBe(1);
    expect(m.estouros, `${quem}: nada estoura a largura do cartão`).toEqual([]);
    // A linha do total fecha com o aviso curto: exatamente um dos textos. E923: contas fixas sem estimativa (o caso dos imóveis
    // de teste do laboratório) dizem "água, luz e gás não informados"; antes diziam "tudo incluído".
    expect(m.total, `${quem}: total da estadia`).toMatch(/^R\$\s?[\d.]+ em \d+ (mês|meses)$/);
    expect(["tudo incluído", "água, luz e gás à parte", "água, luz e gás não informados"], `${quem}: aviso curto`).toContain(m.aviso);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${onde}: sem rolagem horizontal`).toBeLessThanOrEqual(1);
}

test.describe("T1624 — E899: cartão enxuto nas superfícies públicas", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  for (const largura of LARGURAS) {
    for (const [nome, rota] of [["home", "/"], ["busca", "/buscar"], ["cidade", "/cidades/uberlandia"]] as const) {
      test(`${nome} a ${largura} px`, async ({ page }) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width: largura, height: altura(largura) });
        await page.goto(rota, { waitUntil: "domcontentloaded" });
        await conferirSuperficie(page, `${nome} ${largura}`);
      });
    }
  }
});

const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1624.${sufixo}@lab.vivanomads.test`, nome: "Dora Enxuta", role: "owner" as const };
const morador = { email: `mor.t1624.${sufixo}@lab.vivanomads.test`, nome: "Mira Enxuta", role: "tenant" as const };
const ids: { dono?: string; morador?: string; imovel?: string } = {};

test.describe("T1624 — E899: cartão enxuto no painel (favoritos e visão geral)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (conta de teste com 1 favorito).");
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Enxuto T1624 ${sufixo}`, { ativo: true });
    const { error } = await adm().from("favorites").insert({ tenant_id: ids.morador, property_id: ids.imovel });
    if (error) throw error;
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("favorites").delete().eq("tenant_id", ids.morador!);
    await apagarContas([ids.dono, ids.morador]);
  });

  test("/dashboard/favoritos (1 favorito) e a visão geral, a 390 e 1280 px", async ({ browser }) => {
    test.setTimeout(240_000);
    const page = await entrar(browser, morador.email, senha);
    for (const largura of LARGURAS) {
      await page.setViewportSize({ width: largura, height: altura(largura) });
      await page.goto("/dashboard/favoritos", { waitUntil: "domcontentloaded" });
      await expect(page.locator("main")).toContainText(`Enxuto T1624 ${sufixo}`, { timeout: 30_000 });
      await expect(page.getByTestId("cartao-imovel")).toHaveCount(1);
      await conferirSuperficie(page, `favoritos ${largura}`);
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("inicio-recomendados"), "a visão geral mostra os recomendados").toBeVisible({ timeout: 40_000 });
      await conferirSuperficie(page, `visão geral ${largura}`);
    }
    await page.context().close();
  });
});
