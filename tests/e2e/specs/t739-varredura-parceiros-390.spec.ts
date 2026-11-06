import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T739 — varredura visual das páginas públicas de parceiros a 390 px (Muse, 30/10): em cada página, nenhum estouro
  horizontal, toda imagem visível carregada (rolando até o fim, para o carregamento sob demanda) e nenhum texto ou
  controle por cima de outro (elementos fixos — barra de baixo, "Fale com a Viva" — ficam de fora). Inclui a busca com
  um parceiro publicado (cartão) e a página pública dele.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = { email: `parc.t739.${sufixo}@lab.vivanomads.test`, nome: "Lia Limpeza", role: "owner" as const };
const slug = `lia-limpeza-t739-${sufixo}`;
const ids: { conta?: string; parceiro?: string } = {};

async function varrer(p: Page) {
  const altura = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < altura; y += 600) {
    await p.evaluate((v) => window.scrollTo(0, v), y);
    await p.waitForTimeout(120);
  }
  await p.evaluate(() => window.scrollTo(0, 0));
  await expect
    .poll(() => p.evaluate(() => [...document.images].filter((i) => i.getBoundingClientRect().width > 0 && !(i.complete && i.naturalWidth > 0)).length), { timeout: 15_000 })
    .toBe(0);
  const largura = await p.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
  expect(largura.s, "sem estouro horizontal").toBeLessThanOrEqual(largura.c);
  const sobre = await p.evaluate(() => {
    const fixo = (e: Element) => {
      for (let n: Element | null = e; n; n = n.parentElement) {
        const s = getComputedStyle(n).position;
        if (s === "fixed" || s === "sticky") return true;
      }
      return false;
    };
    const els = [...document.querySelectorAll("h1,h2,h3,h4,p,a,button,label,input,select,textarea,img")].filter((e) => {
      const b = e.getBoundingClientRect();
      return b.width > 2 && b.height > 2 && !fixo(e) && getComputedStyle(e).visibility !== "hidden" && !e.closest('[aria-hidden="true"]');
    });
    const caixas = els.map((e) => ({ e, b: e.getBoundingClientRect() }));
    const achados: string[] = [];
    for (let i = 0; i < caixas.length; i++)
      for (let j = i + 1; j < caixas.length; j++) {
        const a = caixas[i];
        const c = caixas[j];
        if (a.e.contains(c.e) || c.e.contains(a.e)) continue;
        // A foto de fundo do banner sob o título é de propósito.
        if ((a.e.tagName === "IMG") !== (c.e.tagName === "IMG")) continue;
        const ix = Math.min(a.b.right, c.b.right) - Math.max(a.b.left, c.b.left);
        const iy = Math.min(a.b.bottom, c.b.bottom) - Math.max(a.b.top, c.b.top);
        if (ix > 4 && iy > 4) achados.push(`${a.e.tagName} × ${c.e.tagName}`);
      }
    return achados;
  });
  expect(sobre, "nada por cima de nada").toEqual([]);
}

test.describe("T739 — varredura das páginas de parceiros a 390 px", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000, viewport: { width: 390, height: 844 } });

  test.beforeAll(async () => {
    ids.conta = await criarConta(conta, senha);
    const { data, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.conta, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: `Lia Limpeza ${sufixo}`, slug, categorias: ["limpeza"], cidades: ["Uberlândia"], descricao_curta: "Faxina de imóvel mobiliado.", status: "publicado", publicado_em: new Date().toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    ids.parceiro = data.id as string;
  });
  test.afterAll(async () => {
    if (ids.parceiro) await adm().from("parceiros").delete().eq("id", ids.parceiro);
    await apagarContas([ids.conta]);
  });

  const rotas: [string, () => string][] = [
    ["parceiros", () => "/parceiros"],
    ["buscar-todas", () => "/parceiros/buscar"],
    ["buscar-montagem-vazia", () => "/parceiros/buscar?categoria=montagem&cidade=Uberl%C3%A2ndia&uf=MG"],
    ["buscar-limpeza-cartao", () => "/parceiros/buscar?categoria=limpeza&cidade=Uberl%C3%A2ndia&uf=MG"],
    ["parceiro-publico", () => `/parceiros/${slug}`],
    ["fotografos", () => "/parceiros/fotografos"],
    ["avaliadores", () => "/parceiros/avaliadores"],
    ["ativar", () => "/parceiros/ativar"],
  ];
  for (const [nome, rota] of rotas) {
    test(`390 px: ${nome}`, async ({ page: p }) => {
      const resp = await p.goto(rota(), { waitUntil: "domcontentloaded" });
      expect(resp?.status()).toBeLessThan(400);
      await p.waitForLoadState("networkidle").catch(() => {});
      if (nome === "buscar-limpeza-cartao") await expect(p.locator(`[data-testid="cartao-parceiro"][data-slug="${slug}"]`)).toBeVisible({ timeout: 20_000 });
      await varrer(p);
      await p.screenshot({ path: `${SAIDA}/t739-${nome}-390.png` });
    });
  }
});
