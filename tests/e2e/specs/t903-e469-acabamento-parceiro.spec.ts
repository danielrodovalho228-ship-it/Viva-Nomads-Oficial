import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo, cnpjAleatorio } from "../fixtures/laboratorio";

/*
  T903 — E469 (PC13), acabamento do painel do parceiro, 390 e 1280, sessão real:
    1) no computador, o cartão Pedidos tem a altura do conteúdo (não estica até a coluna de Agenda + Ganhos);
    2) as fotos públicas do editor (galeria) entram nítidas: a moldura chega a "pronta" e a foto fica opaca;
    3) "Cartão para divulgar": as duas prévias saem do estado "Gerando a prévia…" para a imagem 1080 px inteira.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const pessoa = { email: `acab.t903.${sufixo}@lab.vivanomads.test`, nome: "Alba Acabamento", role: "owner" as const };
const ids: Record<string, string> = {};
const slug = `alba-t903-${sufixo}`;

test.describe("T903 — E469: acabamento do painel do parceiro", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.beforeAll(async () => {
    ids.pessoa = await criarConta(pessoa, senha);
    const { data, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.pessoa, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: `[TESTE QA] Alba Limpeza T903 ${sufixo}`, slug, categorias: ["limpeza"], cidades: ["Uberlândia"], descricao_curta: "Parceiro de laboratório.", status: "publicado", publicado_em: new Date().toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    ids.parceiro = data.id as string;
    await adm().from("profiles").update({ papel_ativo: "parceiro" }).eq("id", ids.pessoa);
    const arquivos = ["public/images/parceiros-categorias/manutencao.webp", "public/images/parceiros-categorias/lavanderia.webp"];
    for (const i of [0, 1]) {
      const path = `${ids.parceiro}/galeria-t903-${i}.webp`;
      const { error: eUp } = await adm().storage.from("parceiros").upload(path, readFileSync(arquivos[i]), { contentType: "image/webp", upsert: true });
      if (eUp) throw eUp;
      const { error: eIns } = await adm().from("parceiro_galeria").insert({ parceiro_id: ids.parceiro, path, ordem: i });
      if (eIns) throw eIns;
    }
  });
  test.afterAll(async () => {
    if (ids.parceiro) {
      await adm().storage.from("parceiros").remove([0, 1].map((i) => `${ids.parceiro}/galeria-t903-${i}.webp`));
      await adm().from("parceiros").delete().eq("id", ids.parceiro);
    }
    await apagarContas([ids.pessoa]);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: Pedidos na altura do conteúdo, fotos nítidas e prévias do cartão sem branco`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390, hasTouch: w === 390 });
      const p = await entrarNaPagina(await ctx.newPage(), pessoa.email, senha);
      await p.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });

      // 1) Pedidos x coluna lateral.
      const pedidos = p.getByTestId("parceiro-pedidos");
      await expect(pedidos).toBeVisible({ timeout: 30_000 });
      const alturas = await p.evaluate(() => {
        const ped = document.querySelector('[data-testid="parceiro-pedidos"]')!.getBoundingClientRect();
        const col = document.querySelector('[data-testid="parceiro-agenda"]')!.parentElement!.getBoundingClientRect();
        return { pedidos: ped.height, coluna: col.height };
      });
      if (w === 1280) expect(alturas.pedidos, JSON.stringify(alturas)).toBeLessThan(alturas.coluna - 100);

      // 2) Galeria do editor: as duas fotos entram nítidas (moldura "pronta", foto opaca).
      const molduras = p.getByTestId("parceiro-galeria-lista").locator("[data-imagem-fase]");
      await expect(molduras).toHaveCount(2, { timeout: 30_000 });
      for (const i of [0, 1]) {
        await expect(molduras.nth(i)).toHaveAttribute("data-imagem-fase", "pronta", { timeout: 30_000 });
        // A foto entra com uma transição curta de opacidade: espera ela terminar.
        await expect.poll(() => molduras.nth(i).locator("img").evaluate((el) => getComputedStyle(el).opacity), { timeout: 5_000 }).toBe("1");
      }
      await p.getByTestId("parceiro-galeria-lista").scrollIntoViewIfNeeded();
      await p.screenshot({ path: `tests/laboratorio/saida/t903-galeria-${w}.png` });

      // 3) Cartão para divulgar: as duas prévias chegam à imagem inteira.
      await p.getByTestId("parceiro-aba-cartao").click();
      await p.getByTestId("parceiro-gerar-cartao").click();
      const previas = p.getByTestId("cartao-previas").locator("[data-imagem-fase]");
      await expect(previas).toHaveCount(2, { timeout: 45_000 });
      for (const i of [0, 1]) await expect(previas.nth(i)).toHaveAttribute("data-imagem-fase", "pronta", { timeout: 45_000 });
      await expect(p.getByTestId("cartao-previas").getByText("Gerando a prévia…")).toHaveCount(0);
      expect(await p.getByTestId("cartao-previa").evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(1080);
      await p.getByTestId("cartao-previas").scrollIntoViewIfNeeded();
      await p.screenshot({ path: `tests/laboratorio/saida/t903-cartao-${w}.png` });
      expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await ctx.close();
    });
  }
});
