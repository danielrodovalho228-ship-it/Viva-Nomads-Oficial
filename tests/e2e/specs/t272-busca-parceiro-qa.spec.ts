import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T272 — Defeito de produção (QA 22/10): a busca de parceiros não achava o parceiro publicado de fotografia em
 * Uberlândia/MG do QA. A conta dele é de TESTE, e a busca escondia conta de teste de todo mundo — inclusive do próprio
 * QA. Agora: o público continua sem ver; conta de teste (e admin) vê. E o texto da busca vazia sai com os espaços.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t272.${sufixo}@lab.vivanomads.test`, nome: "Dalva Busca", role: "owner" as const };
const foto = { email: `foto.t272.${sufixo}@lab.vivanomads.test`, nome: "Paulo Fotos", role: "owner" as const };
const slug = `paulo-fotos-t272-${sufixo}`;
const ids: { dono?: string; foto?: string; parceiro?: string } = {};
const BUSCA = "/parceiros/buscar?categoria=fotografia&cidade=Uberl%C3%A2ndia&uf=MG";

test.describe("T272 — parceiro publicado de fotografia em Uberlândia/MG aparece na busca", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.foto = await criarConta(foto, senha);
    // As duas são contas de teste, como no QA de produção.
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.foto]);
    const { data, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.foto, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: "Paulo Fotos — TESTE QA", slug, categorias: ["fotografia"], cidades: ["Uberlândia"], descricao_curta: "Fotos de imóvel para anúncio.", status: "publicado", publicado_em: new Date().toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    ids.parceiro = data.id as string;
  });

  test.afterAll(async () => {
    if (ids.parceiro) await adm().from("parceiros").delete().eq("id", ids.parceiro);
    await apagarContas([ids.dono, ids.foto]);
  });

  test("conta de teste acha o parceiro de teste por categoria + cidade (formulário e /parceiros/fotografos); o público não", async ({ browser }) => {
    test.setTimeout(120_000);
    const cartao = `[data-testid="cartao-parceiro"][data-slug="${slug}"]`;

    const d = await entrar(browser, dono.email, senha);
    await d.goto(BUSCA, { waitUntil: "domcontentloaded" });
    await expect(d.locator(cartao)).toBeVisible({ timeout: 20_000 });
    // Sem acento e pela página de fotógrafos também.
    await d.goto("/parceiros/buscar?categoria=fotografia&cidade=Uberlandia&uf=MG", { waitUntil: "domcontentloaded" });
    await expect(d.locator(cartao)).toBeVisible({ timeout: 20_000 });
    await d.goto("/parceiros/fotografos?cidade=Uberl%C3%A2ndia&uf=MG", { waitUntil: "domcontentloaded" });
    await expect(d.locator(cartao)).toBeVisible({ timeout: 20_000 });
    await d.context().close();

    // Visitante: o parceiro de conta de teste continua fora da busca pública.
    const ctx = await browser.newContext();
    const v = await ctx.newPage();
    await v.goto(BUSCA, { waitUntil: "domcontentloaded" });
    await expect(v.getByTestId("busca-parceiros-resultado")).toBeVisible({ timeout: 20_000 });
    await expect(v.locator(cartao)).toHaveCount(0);
    await ctx.close();
  });

  test("busca vazia: a frase sai inteira, com os espaços", async ({ browser }) => {
    const ctx = await browser.newContext();
    const v = await ctx.newPage();
    await v.goto("/parceiros/buscar?categoria=fotografia&cidade=Monte%20Carmelo&uf=MG", { waitUntil: "domcontentloaded" });
    const texto = v.getByTestId("busca-parceiros-vazia-texto");
    await expect(texto).toHaveText("Ainda não temos parceiro de fotografia em Monte Carmelo.", { timeout: 20_000 });
    // Um texto só dentro do parágrafo (sem pedaços que um leitor possa colar).
    expect(await texto.evaluate((p) => Array.from(p.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).length)).toBe(1);
    await ctx.close();
  });
});
