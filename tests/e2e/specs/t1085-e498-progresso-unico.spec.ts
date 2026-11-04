import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { doTipoAoEndereco } from "../fixtures/cadastro";

/**
 * T1085 — E498 (#2425, 04/11): o progresso do MESMO rascunho é um número só no Início, em Meus imóveis e em todos os
 * passos do assistente. Antes, o Início dizia 25%, e o assistente mostrava 30, 40, 70 conforme a POSIÇÃO do passo. Pela
 * tela real, proprietário novo com um rascunho criado pelo próprio assistente (tipo, fotos e endereço), 390 e 1280:
 *   1. Início ("Continue seu anúncio"): o número N de inicio-dono-pct, com "N% pronto";
 *   2. Meus imóveis: o cartão do rascunho diz "Anúncio N% completo" (o mesmo N);
 *   3. o assistente, reaberto no Endereço e no Detalhes: o rodapé diz "N% pronto" com a barra igual, e o número é o
 *      mesmo nos dois passos (não anda com a posição do passo).
 * L-94 (defeito de produto do E498, achado nesta spec, 04/11): o número do assistente NÃO é o do Início/Meus imóveis —
 * 29% × 43% para o mesmo rascunho salvo, sem nada digitado (e sem qualificação injetada). Fica no teste "L-94",
 * test.fail; a lista de passos do Início sai anotada no relatório para achar o item que diverge.
 * As regras (ordem da lista, qualificacaoDoRascunho, a barra ligada ao pct) ficam com o e498-progresso-unico.test.ts;
 * a barra = "N% pronto" num passo só, com a t450/t386.
 * Sem qualificação injetada na sessionStorage (como a t8 faz): o assistente contaria a qualificação que o servidor não
 * vê (não foi gravada no draft_data) — o rascunho aqui é o de quem respondeu "depois", pelo caminho real da tela.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1085.${sufixo}@lab.vivanomads.test`, nome: "Paula Progresso Reis", role: "owner" as const };
const ids: Record<string, string> = {};
let rascunho = "";

async function criarRascunho(browser: Browser): Promise<string> {
  const p = await entrar(browser, dono.email, senha);
  await p.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
  const qualificacao = p.getByTestId("qualificacao");
  await p.getByTestId("passo-titulo").or(qualificacao).first().waitFor({ state: "visible", timeout: 30_000 });
  if (await qualificacao.isVisible()) await p.getByTestId("qualificacao-depois").click();
  await doTipoAoEndereco(p);
  await p.getByTestId("cadastro-rua").fill(`Rua do Progresso ${sufixo}`);
  await p.getByTestId("cadastro-numero").fill("200");
  await p.locator('input[list="novo-bairros"]').fill(`Centro t1085 ${sufixo}`);
  await p.waitForTimeout(2_500);
  await expect(p.getByText("Salvando…")).toHaveCount(0, { timeout: 15_000 });
  await expect(p).toHaveURL(/\/dashboard\/imoveis\/novo\?draft=/, { timeout: 20_000 });
  const id = new URL(p.url()).searchParams.get("draft")!;
  await p.context().close();
  return id;
}

async function prontoNoAssistente(p: Page, etapa: string): Promise<{ texto: number; barra: number }> {
  await p.goto(`/dashboard/imoveis/novo?draft=${rascunho}&etapa=${etapa}`, { waitUntil: "domcontentloaded" });
  const rodape = p.getByTestId("assistente-rodape");
  const detalhe = rodape.getByTestId("passo-detalhe");
  await expect(detalhe).toHaveText(/^\d+% pronto$/, { timeout: 30_000 });
  const texto = parseInt((await detalhe.textContent()) ?? "", 10);
  const barra = Number(await rodape.getByRole("progressbar", { name: "Progresso do cadastro" }).getAttribute("aria-valuenow"));
  return { texto, barra };
}

test.describe("T1085 — E498: o progresso do rascunho é um número só (Início, Meus imóveis, assistente)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000);
    ids.dono = await criarConta(dono, senha);
    rascunho = await criarRascunho(browser);
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  /** O N do Início ("Continue seu anúncio") e a lista de passos (✓/○), para o relatório. */
  async function nDoInicio(p: Page): Promise<number> {
    await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const bloco = p.locator('[data-testid="inicio-dono-principal"][data-tipo="rascunho"]');
    const pct = bloco.getByTestId("inicio-dono-pct");
    await expect(pct).toBeVisible({ timeout: 30_000 });
    const lista = (await bloco.getByTestId("inicio-dono-passos").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
    test.info().annotations.push({ type: "inicio-dono-passos", description: lista });
    return Number(await pct.getAttribute("data-pct"));
  }

  for (const w of [390, 1280] as const) {
    test(`o mesmo N no Início e em Meus imóveis; o assistente diz "N% pronto" com a barra igual (${w})`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });

      // 1. Início.
      const n = await nDoInicio(p);
      expect(n, "um rascunho com tipo, fotos e endereço não está vazio nem pronto").toBeGreaterThan(0);
      expect(n).toBeLessThan(100);
      await expect(p.getByTestId("inicio-dono-pct").first()).toContainText(`${n}% pronto`);

      // 2. Meus imóveis.
      await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      await expect(p.locator("main")).toContainText(`Anúncio ${n}% completo`, { timeout: 30_000 });

      // 3. No assistente o texto e a barra são o mesmo número, e não andam com a posição do passo (Endereço = Detalhes).
      const a2 = await prontoNoAssistente(p, "2");
      const a3 = await prontoNoAssistente(p, "3");
      expect(a2.barra, "Endereço: a barra = o texto").toBe(a2.texto);
      expect(a3.barra, "Detalhes: a barra = o texto").toBe(a3.texto);
      expect(a3.texto, "o número não anda com a posição do passo").toBe(a2.texto);
      test.info().annotations.push({ type: "numeros", description: `Início/Meus imóveis ${n}% · assistente ${a2.texto}%` });
      const sobra = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(sobra).toBeLessThanOrEqual(1);
      await p.context().close();
    });

    test(`L-94: o assistente diz o MESMO N do Início e de Meus imóveis (${w})`, async ({ browser }) => {
      test.fail(true, "L-94: o mesmo rascunho salvo (tipo, fotos, endereço) dá 29% no Início e em Meus imóveis e 43% no assistente — um item conta como feito no assistente e não no servidor");
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      try {
        const n = await nDoInicio(p);
        const a = await prontoNoAssistente(p, "2");
        test.info().annotations.push({ type: "L-94", description: `Início ${n}% · assistente ${a.texto}%` });
        expect(a.texto, "assistente = Início").toBe(n);
      } finally {
        await p.context().close();
      }
    });
  }
});
