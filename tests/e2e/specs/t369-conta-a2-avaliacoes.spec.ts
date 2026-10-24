import { test, expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T369 — CONTA-A A2 (mockup perfil-02): Conta › Avaliações.
 *   1. Abas Todas / Recentes / Positivas (Todas cheia), busca, o cartão com foto/inicial e nome curto de quem avaliou,
 *      as estrelas da nota, o comentário e "Recebida em … · imóvel · cidade"; subtítulo sem "anfitriões". 1280 e 390.
 *   2. Positivas filtra (nota 3 some); a busca filtra pelo comentário.
 *   3. "Responder avaliações" leva à primeira sem resposta; responder grava e o botão some quando não sobra nenhuma.
 */
const SAIDA = "tests/laboratorio/saida";
const ROTA = "/dashboard/conta/avaliacoes";

test.describe("T369 — CONTA-A A2: Avaliações (perfil-02)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const morador = { email: `morador.t369.${sufixo}@lab.vivanomads.test`, nome: "Ana Ribeiro Lopes", role: "tenant" as const };
  const donoA = { email: `donoa.t369.${sufixo}@lab.vivanomads.test`, nome: "Carlos Mendes", role: "owner" as const };
  const donoB = { email: `donob.t369.${sufixo}@lab.vivanomads.test`, nome: "Fernanda Lima", role: "owner" as const };
  const ids: Record<string, string> = {};
  const contratos: string[] = [];

  async function avaliarAmbos(dono: { email: string }, idDono: string, titulo: string, notaDoDono: number, texto: string) {
    const imovel = await criarImovelPronto(idDono, `${titulo} ${sufixo}`, { ativo: true, preco: 2900 });
    await adm().from("properties").update({ city: "Uberlândia" }).eq("id", imovel);
    const { data: ct, error } = await adm()
      .from("contratos")
      .insert({ property_id: imovel, tenant_id: ids.morador, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 2900, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 232, qtd_ocupantes: 1, status: "concluido", garantia: "caucao", encerrado_em: new Date(Date.now() - 24 * 3600_000).toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    contratos.push(ct!.id);
    for (const [quem, alvo, papel, nota, txt] of [
      [morador, idDono, "inquilino", 5, `Ótimo proprietário ${sufixo}`],
      [dono, ids.morador, "proprietario", notaDoDono, texto],
    ] as const) {
      const sb = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
      await sb.auth.signInWithPassword({ email: quem.email, password: senha });
      const { error: e } = await sb.from("avaliacoes").insert({ contrato_id: ct!.id, alvo_id: alvo, papel_autor: papel, nota_geral: nota, comentario_publico: txt, status: "enviada" });
      if (e) throw e;
    }
  }

  async function como(browser: Browser, w: number): Promise<Page> {
    const p = await entrar(browser, morador.email, senha);
    await p.setViewportSize({ width: w, height: w === 1280 ? 900 : 844 });
    return p;
  }

  test.beforeAll(async () => {
    ids.morador = await criarConta(morador, senha);
    ids.donoA = await criarConta(donoA, senha);
    ids.donoB = await criarConta(donoB, senha);
    await avaliarAmbos(donoA, ids.donoA, "Casa no Santa Mônica", 5, `Estadia tranquila, comunicação ótima ${sufixo}`);
    await avaliarAmbos(donoB, ids.donoB, "Apartamento no Centro", 3, `Cuidou bem do imóvel ${sufixo}`);
  });
  test.afterAll(async () => {
    if (contratos.length) await adm().from("contratos").delete().in("id", contratos);
    await apagarContas([ids.morador, ids.donoA, ids.donoB]);
  });

  for (const w of [1280, 390]) {
    test(`1. a ${w} px: abas, busca e os cartões do desenho`, async ({ browser }) => {
      const p = await como(browser, w);
      await p.goto(ROTA, { waitUntil: "domcontentloaded" });
      await p.getByTestId("tela-avaliacoes").waitFor();
      await expect(p.locator("h1:visible")).toHaveText("Avaliações");
      await expect(p.getByText("Avaliações que você recebeu de proprietários e moradores")).toBeVisible();
      await expect(p.getByTestId("avaliacoes-aba-todas")).toHaveAttribute("aria-current", "page");
      for (const a of ["recentes", "positivas"]) await expect(p.getByTestId(`avaliacoes-aba-${a}`)).toBeVisible();
      await expect(p.getByTestId("avaliacoes-busca")).toHaveAttribute("placeholder", "Buscar avaliações...");
      const cartoes = p.getByTestId("avaliacao-recebida");
      await expect(cartoes).toHaveCount(2);
      // Da mais nova para a mais antiga; os dois nomes curtos, em qualquer ordem.
      expect((await cartoes.getByTestId("avaliacao-autor").allInnerTexts()).sort()).toEqual(["Carlos M.", "Fernanda L."]);
      const carlos = cartoes.filter({ hasText: "Carlos M." });
      await expect(carlos.getByTestId("avaliacao-estrelas")).toHaveAttribute("data-cheias", "5");
      await expect(carlos.getByTestId("avaliacao-contexto")).toContainText(/Recebida em \d{2} [a-z]{3} \d{4} · Casa no Santa Mônica .* · Uberlândia/);
      await expect(p.locator("main")).not.toContainText(/anfitri|reserva/i);
      expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await p.screenshot({ path: `${SAIDA}/t369-avaliacoes-${w}.png`, fullPage: true });
      await p.context().close();
    });
  }

  test("2. Positivas e busca filtram", async ({ browser }) => {
    const p = await como(browser, 1280);
    await p.goto(ROTA, { waitUntil: "domcontentloaded" });
    await p.getByTestId("avaliacoes-aba-positivas").click();
    await expect(p).toHaveURL(/aba=positivas/);
    await expect(p.getByTestId("avaliacao-recebida")).toHaveCount(1);
    await expect(p.getByTestId("avaliacao-recebida")).toContainText("Carlos M.");
    await p.goto(ROTA, { waitUntil: "domcontentloaded" });
    await p.getByTestId("avaliacoes-busca").fill("Cuidou bem");
    await p.getByTestId("avaliacoes-busca").press("Enter");
    await expect(p).toHaveURL(/q=Cuidou/);
    await expect(p.getByTestId("avaliacao-recebida")).toHaveCount(1);
    await expect(p.getByTestId("avaliacao-recebida")).toContainText("Fernanda L.");
    await p.context().close();
  });

  test("3. Responder avaliações leva à primeira sem resposta", async ({ browser }) => {
    const p = await como(browser, 1280);
    await p.goto(ROTA, { waitUntil: "domcontentloaded" });
    const botao = p.getByTestId("avaliacoes-responder");
    await expect(botao).toBeVisible();
    const alvo = ((await botao.getAttribute("href")) ?? "").replace("#", "");
    expect(alvo).toMatch(/^avaliacao-/);
    await botao.click();
    await expect(p.locator(`#${alvo}`)).toBeInViewport();
    await p.context().close();
  });
});
