import { test, expect, type Locator } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2230 — E1112 (ORDEM-DUET-561, linha foco Parceiros; trava de TELA que faltava) @E1112 — só no laboratório.
  O E1112 (#4144) tem trava de unidade (e1112-pagina-sem-contacto.test.ts, que lê a action e a 0357) e a t2228 prova o
  gatilho do banco. Faltava a prova pela tela que o parceiro e o visitante usam:
   1. o parceiro escreve um telefone ou um e-mail no nome, na descrição curta ou na descrição da página e toca em
      "Salvar apresentação" → a tela mostra o aviso da casa e NADA é gravado (o banco fica com o texto limpo);
   2. a página pública (/parceiros/<slug>) continua sem o contacto;
   3. o texto limpo continua a gravar (sem falso positivo);
   4. o pedido de parceria ("Seja parceiro") com telefone no nome é recusado com o mesmo aviso, no campo do nome.
  Antes do E1112 (main sem o #4144) os casos 1 e 4 caem: a página grava o telefone e o pedido segue.
  E1137 (ORDEM-DUET-601): no caso 1 o botão "Salvar apresentação" vai para o FUNDO do ecrã (390×844) antes do toque — o
  aviso nasce abaixo dele, e só fica à vista se a página rolar até ele (a rolagem do E1131). Com o botão a meio do ecrã o
  aviso já se via sem rolar, e a rolagem não estava guardada. Sem a rolagem, o aviso nasce por trás da barra fixa de baixo:
  ainda "no ecrã" para o toBeInViewport, por isso o caso confere também que o meio do aviso não está tapado.
  E1139 (ORDEM-DUET-601): o aviso do pedido de parceria (caso 4) também tem de estar dentro do ecrã.
*/
const AVISO = "Para sua segurança e registro, o contato acontece pela plataforma — remova telefone, e-mail ou apps de mensagem do texto.";
const senha = novaSenha();
const sufixo = novoSufixo();
const parceira = { email: `parc.t2230.${sufixo}@lab.vivanomads.test`, nome: "Paula Parceira", role: "owner" as const };
const candidata = { email: `cand.t2230.${sufixo}@lab.vivanomads.test`, nome: "Clara Candidata", role: "owner" as const };
const slug = `t2230-${sufixo}`;
const NOME = "Paula Limpeza e Cuidado";
const CURTA = "Limpeza pós-obra e de rotina em Uberlândia";
const DESCRICAO = "Atendo a cidade toda com hora marcada e material próprio.";
const ids: Record<string, string> = {};

const CONTACTOS: { campo: "#pp-nome" | "#pp-curta" | "#pp-descricao"; coluna: "nome_publico" | "descricao_curta" | "descricao"; texto: string }[] = [
  { campo: "#pp-nome", coluna: "nome_publico", texto: "Paula 34 99876-5432" },
  { campo: "#pp-curta", coluna: "descricao_curta", texto: "Chama no zap (34) 99876-5432" },
  { campo: "#pp-descricao", coluna: "descricao", texto: "Orçamento pelo e-mail paula.limpeza@exemplo.com.br" },
];

/**
 * Desce só até o botão ficar no fundo do ecrã, logo acima de uma barra fixa de baixo (se houver): como quem rola até ele.
 * Rolagem instantânea (o site tem scroll-behavior: smooth: um scrollBy ainda ia a meio quando o toque chegava, e o click()
 * rolava o botão para o meio do ecrã — ensaio 45290848453), repetida até a posição assentar (a página ainda cresce
 * enquanto carrega — ensaio 45292565104).
 */
async function botaoNoFimDoEcra(botao: Locator) {
  await expect
    .poll(
      () =>
        botao.evaluate((el) => {
          const barras = [...document.querySelectorAll<HTMLElement>("body *")].filter((n) => {
            const st = getComputedStyle(n);
            return st.position === "fixed" && n.getBoundingClientRect().bottom >= window.innerHeight - 1 && n.getBoundingClientRect().height < window.innerHeight / 3;
          });
          const limite = Math.min(window.innerHeight, ...barras.map((b) => b.getBoundingClientRect().top));
          const r = el.getBoundingClientRect();
          if (r.top >= 0 && r.bottom <= limite && limite - r.bottom < 40) return true;
          window.scrollTo({ top: window.scrollY + r.bottom - limite + 2, behavior: "instant" });
          return false;
        }),
      { message: "o botão está no fundo do ecrã", timeout: 10_000, intervals: [100, 250, 500] },
    )
    .toBe(true);
}

/** O aviso está à vista de quem salvou: o ponto do meio dele está no ecrã e não está tapado (ex.: pela barra de baixo). */
async function avisoAVista(aviso: Locator): Promise<boolean> {
  return aviso.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    if (y < 0 || y > window.innerHeight || x < 0 || x > window.innerWidth) return false;
    const noPonto = document.elementFromPoint(x, y);
    return !!noPonto && (noPonto === el || el.contains(noPonto));
  });
}

async function lerPagina() {
  const { data, error } = await adm().from("parceiros").select("nome_publico, descricao_curta, descricao").eq("id", ids.parceiro).single();
  if (error) throw error;
  return data as { nome_publico: string; descricao_curta: string | null; descricao: string | null };
}

test.describe("T2230 — E1112: a página do parceiro e o pedido de parceria recusam contacto, pela tela @E1112", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (cria parceiro com a chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.parceira = await criarConta(parceira, senha);
    ids.candidata = await criarConta(candidata, senha);
    const p = await adm()
      .from("parceiros")
      .insert({
        user_id: ids.parceira, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: NOME, slug,
        categorias: ["limpeza"], cidades: ["Uberlândia"], descricao: DESCRICAO, descricao_curta: CURTA,
        status: "publicado", publicado_em: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (p.error) throw p.error;
    ids.parceiro = p.data.id;
  });
  test.afterAll(async () => {
    await apagarContas([ids.parceira, ids.candidata]);
  });

  test("1. telefone ou e-mail no nome, na descrição curta ou na descrição: a tela mostra o aviso e nada é gravado", async ({ browser }) => {
    const page = await entrar(browser, parceira.email, senha);
    await page.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("painel-parceiro")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("parceiro-aba-pagina").click();
    for (const c of CONTACTOS) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator(c.campo)).toBeVisible({ timeout: 30_000 });
      await page.locator(c.campo).fill(c.texto);
      // E1137: o botão no fundo do ecrã — o aviso, que nasce abaixo dele, só se vê se a página rolar até ele.
      await botaoNoFimDoEcra(page.getByTestId("parceiro-salvar-pagina"));
      // O toque no sítio onde o botão está, sem a rolagem que o click() do Playwright faz antes de tocar (ela movia a
      // página e escondia a falta da rolagem do E1131 — ensaio 45294887174). O dedo não rola a página.
      await page.getByTestId("parceiro-salvar-pagina").dispatchEvent("click");
      await expect(page.getByTestId("parceiro-msg"), `${c.coluna}: o aviso da casa`).toHaveText(AVISO, { timeout: 20_000 });
      // E1131 (ORDEM-DUET-572): o aviso aparece junto do botão — dentro do ecrã de quem acabou de salvar, não no topo do painel.
      await expect(page.getByTestId("parceiro-msg"), `${c.coluna}: o aviso está à vista`).toBeInViewport();
      // E1137: e não fica tapado pela barra de baixo — sem a rolagem do E1131, o aviso nasce por trás dela (toBeInViewport
      // não vê sobreposições).
      await expect.poll(() => avisoAVista(page.getByTestId("parceiro-msg")), { message: `${c.coluna}: o aviso não está tapado`, timeout: 5_000 }).toBe(true);
      const lida = await lerPagina();
      expect(lida, `${c.coluna}: nada gravado`).toEqual({ nome_publico: NOME, descricao_curta: CURTA, descricao: DESCRICAO });
    }
    await page.context().close();
  });

  test("2. a página pública continua sem o contacto", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(`/parceiros/${slug}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("pagina-parceiro")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("parceiro-nome")).toHaveText(NOME);
    const corpo = await page.getByTestId("pagina-parceiro").innerText();
    expect(corpo, "o telefone não aparece").not.toMatch(/99876-5432/);
    expect(corpo, "o e-mail não aparece").not.toMatch(/paula\.limpeza@/);
    await ctx.close();
  });

  test("3. o texto limpo continua a gravar (sem falso positivo)", async ({ browser }) => {
    const page = await entrar(browser, parceira.email, senha);
    await page.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
    await page.getByTestId("parceiro-aba-pagina").click();
    const nova = "Limpeza de rotina e pós-obra, com hora marcada";
    await page.locator("#pp-curta").fill(nova);
    await page.getByTestId("parceiro-salvar-pagina").click();
    await expect(page.getByTestId("parceiro-msg")).not.toHaveText(AVISO, { timeout: 20_000 });
    await expect.poll(async () => (await lerPagina()).descricao_curta, { timeout: 20_000 }).toBe(nova);
    await page.context().close();
  });

  test("4. o pedido de parceria com telefone no nome é recusado com o aviso, no campo do nome", async ({ browser }) => {
    const page = await entrar(browser, candidata.email, senha);
    await page.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("seja-parceiro-form")).toBeVisible({ timeout: 30_000 });
    await page.locator("#sp-nome").fill("Clara Mudanças 34 99876-5432");
    await page.locator("#sp-doc").fill(cnpjAleatorio());
    await page.getByTestId("seja-parceiro-enviar").click();
    await expect(page.getByTestId("sp-erro-nome")).toHaveText(AVISO, { timeout: 20_000 });
    // E1139: o aviso junto do campo do nome está dentro do ecrã de quem tocou em enviar.
    await expect(page.getByTestId("sp-erro-nome"), "o aviso do nome está à vista").toBeInViewport();
    await expect(page.getByTestId("seja-parceiro-recebido")).toHaveCount(0);
    const { count } = await adm().from("parceiro_solicitacoes").select("id", { count: "exact", head: true }).eq("user_id", ids.candidata);
    expect(count ?? 0, "nenhum pedido gravado").toBe(0);
    await page.context().close();
  });
});
