import { test, expect, type Page, type Locator } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1624 — E899 (Daniel, 13/11): cartão de imóvel enxuto em todas as superfícies, e cartão = página.
  T4: home, /buscar, página de cidade, /dashboard/favoritos (conta de teste com 1 favorito) e visão geral do painel, a 390 e 1280.
      Em cada cartão visível: nenhum dos três testids removidos; no máximo 6 linhas lógicas de texto (local, título, preço,
      total + aviso, especificações, disponível), sem contar "Visto" nem o selo do exemplo; local e título em 1 linha; nada
      estoura a largura do cartão.
  T5: na busca, para o ube-001 e para o ube-003 (contas medidas): o /mês, o total e o aviso do cartão são os MESMOS números da
      página, e a página mostra as duas composições.
*/
const SAIDA = "tests/laboratorio/saida";
const REMOVIDOS = ["cartao-mes-composicao", "cartao-total-composicao", "cartao-total-rotulo"];
const LINHAS = ["cartao-local-linha", "cartao-titulo", "cartao-total-mes", "cartao-linha-total", "cartao-sintese", "cartao-disponivel"];
const sem = (s: string) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();

async function conferirCartoes(page: Page, onde: string) {
  const cartoes = page.getByTestId("cartao-imovel");
  await expect(cartoes.first()).toBeVisible({ timeout: 30_000 });
  for (const id of REMOVIDOS) await expect(page.getByTestId(id), `${onde}: ${id}`).toHaveCount(0);
  const n = Math.min(await cartoes.count(), 8);
  for (let i = 0; i < n; i++) await conferirCartao(cartoes.nth(i), `${onde} #${i}`);
}

async function conferirCartao(c: Locator, onde: string) {
  await c.scrollIntoViewIfNeeded();
  const r = await c.evaluate((el, linhas) => {
    const px = (s: string) => Number.parseFloat(s);
    const linhasDe = (n: HTMLElement) => Math.round(n.getBoundingClientRect().height / (px(getComputedStyle(n).lineHeight) || 1));
    const texto = el.querySelector<HTMLElement>("a > div:last-child")!;
    const presentes = linhas.filter((id) => {
      const n = el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      return n && n.offsetParent !== null;
    });
    // As linhas de texto do cartão (filhos diretos do bloco), fora "Visto"/"Você já contatou" e o selo do exemplo.
    const filhos = Array.from(texto.children).filter((n) => (n as HTMLElement).offsetParent !== null && !n.matches('[data-testid="marca-imovel"], [data-testid="cartao-selo-exemplo"]') && (n.textContent ?? "").trim() !== "");
    return {
      presentes,
      filhos: filhos.map((n) => n.getAttribute("data-testid") ?? n.tagName),
      local: linhasDe(el.querySelector<HTMLElement>('[data-testid="cartao-local"]')!),
      titulo: linhasDe(el.querySelector<HTMLElement>('[data-testid="cartao-titulo"]')!),
      estouro: texto.scrollWidth - texto.clientWidth,
      estouroCartao: el.scrollWidth - el.clientWidth,
    };
  }, LINHAS);
  expect(r.filhos.length, `${onde}: no máximo 6 linhas de texto (${r.filhos.join(", ")})`).toBeLessThanOrEqual(6);
  expect(r.filhos.every((id) => LINHAS.includes(id)), `${onde}: só as linhas do cartão enxuto (${r.filhos.join(", ")})`).toBe(true);
  expect(r.local, `${onde}: local em 1 linha`).toBe(1);
  expect(r.titulo, `${onde}: título em 1 linha`).toBe(1);
  expect(r.estouro, `${onde}: o texto não estoura a largura`).toBeLessThanOrEqual(0);
  expect(r.estouroCartao, `${onde}: o cartão não estoura`).toBeLessThanOrEqual(0);
  // O aviso curto: um dos dois, nunca nenhum.
  await expect(c.getByTestId("cartao-aviso")).toHaveText(/^(tudo incluído|água, luz e gás à parte)$/);
}

test.describe("T1624 — E899: cartão enxuto", () => {
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  for (const [largura, altura] of [[390, 844], [1280, 900]] as const) {
    test(`T4 público a ${largura} px: home, /buscar e página de cidade`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: altura });
      for (const [rota, nome] of [["/", "home"], ["/buscar", "buscar"], ["/cidades/uberlandia", "cidade"]] as const) {
        await page.goto(rota, { waitUntil: "domcontentloaded" });
        await conferirCartoes(page, `${nome} ${largura}`);
        await page.getByTestId("cartao-imovel").first().screenshot({ path: `${SAIDA}/t1624-${nome}-${largura}.png` });
      }
    });
  }

  test("T5: na busca, cartão = página (ube-001 e ube-003, contas medidas), e a página mostra as duas composições", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const id of ["ube-001", "ube-003"]) {
      await page.goto("/buscar?exemplos=1", { waitUntil: "domcontentloaded" });
      const cartao = page.getByTestId("cartao-imovel").filter({ has: page.locator(`a[href="/imoveis/${id}"]`) }).first();
      await expect(cartao).toBeVisible({ timeout: 30_000 });
      const mes = sem(await cartao.getByTestId("cartao-preco-mes").innerText());
      const total = sem(await cartao.getByTestId("cartao-total-estadia").innerText());
      const aviso = sem(await cartao.getByTestId("cartao-aviso").innerText());
      if (id === "ube-003") {
        expect(aviso).toBe("água, luz e gás à parte");
        await expect(cartao).not.toContainText("tudo incluído");
      } else expect(aviso).toBe("tudo incluído");
      await cartao.locator(`a[href="/imoveis/${id}"]`).first().click();
      await expect(page).toHaveURL(new RegExp(`/imoveis/${id}`), { timeout: 30_000 });
      const lateral = page.locator("#cartao-preco");
      await expect(lateral.getByTestId("cartao-lateral-mes")).toBeVisible({ timeout: 30_000 });
      expect(sem(await lateral.getByTestId("cartao-lateral-mes").innerText()), `${id}: /mês`).toBe(mes);
      expect(sem(await lateral.getByTestId("cartao-lateral-estadia").innerText()), `${id}: total da estadia`).toContain(total);
      expect(sem(await lateral.getByTestId("cartao-lateral-mes-composicao").innerText())).toMatch(/^Por mês: /);
      if (id === "ube-003") expect(sem(await lateral.getByTestId("cartao-lateral-mes-composicao").innerText())).toContain("água, luz e gás medidos à parte");
      expect(sem(await lateral.getByTestId("cartao-lateral-estadia-conta").innerText())).toMatch(/\d+ × R\$ [\d.]+ \+ limpeza de preparação R\$ [\d.]+ \+ limpeza de saída R\$ [\d.]+/);
      await page.screenshot({ path: `${SAIDA}/t1624-pagina-${id}.png` });
    }
  });

  test.describe("logado", () => {
    test.skip(!NO_LABORATORIO, "Só no laboratório.");
    const senha = novaSenha();
    const inq = { email: `inq.t1624.${novoSufixo()}@lab.vivanomads.test`, nome: "Iara Cartão", role: "tenant" as const };
    const ids: string[] = [];
    test.beforeAll(async () => {
      ids.push(await criarConta(inq, senha));
      await adm().from("profiles").update({ is_teste: true }).in("id", ids);
      const { data: imovel } = await adm().from("properties").select("id").eq("status", "active").limit(1).single();
      expect((await adm().from("favorites").insert({ tenant_id: ids[0], property_id: imovel!.id })).error).toBeNull();
    });
    test.afterAll(async () => {
      await adm().from("favorites").delete().in("tenant_id", ids);
      await apagarContas(ids);
    });

    for (const [largura, altura] of [[390, 844], [1280, 900]] as const) {
      test(`T4 logado a ${largura} px: /dashboard/favoritos (1 favorito) e visão geral do painel`, async ({ browser }) => {
        const p = await entrar(browser, inq.email, senha);
        await p.setViewportSize({ width: largura, height: altura });
        await p.goto("/dashboard/favoritos", { waitUntil: "domcontentloaded" });
        await conferirCartoes(p, `favoritos ${largura}`);
        await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await conferirCartoes(p, `visão geral ${largura}`);
        await p.context().close();
      });
    }
  });
});
