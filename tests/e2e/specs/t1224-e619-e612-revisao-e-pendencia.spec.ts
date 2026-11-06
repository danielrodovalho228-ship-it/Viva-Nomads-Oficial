import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1224 — E619 (#2781) e E612 (#2780), 05/11. Os dois entraram só com teste de unidade; aqui é a tela do assistente, a 390
 * e 1280, com um rascunho do laboratório sem fotos, sem descrição e sem o padrão mínimo:
 *   E619 — a Revisão faz a conta do "Faltam N itens" à vista: logo abaixo do título da lista, "A conta: …" soma os itens
 *          dos passos e as seções do "Antes de publicar", e a soma tem de ser o MESMO N do motivo do botão.
 *   E612 — sair de um passo com bloqueador de publicação (aqui o Passo 5, o padrão mínimo) avança livre, mas o passo
 *          seguinte abre com "Ficou pendente no Passo 5 — …", a lista do que falta, "Você pode seguir; sem isso o anúncio
 *          não publica." e o atalho "Voltar ao Passo 5", que leva de volta ao Passo 5.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1224.${sufixo}@lab.vivanomads.test`, nome: "Rita Revisão", role: "owner" as const };
const ids: { dono?: string } = {};

async function rascunhoSemPadrao(titulo: string): Promise<string> {
  const imovel = await criarImovelPronto(ids.dono!, titulo, { semConforto: true, semInternet: true });
  // O rascunho real mora no draft_data, com as chaves que o assistente grava (a fixture não grava draft_data).
  const draft = {
    title: titulo, propertyType: "Studio", description: "", bedrooms: "1", bathrooms: "1", areaM2: "40", maxGuests: "2",
    minPeriod: "30", maxPeriod: "180", monthlyPrice: "", street: "Rua do Laboratório", numero: "102", cep: "38400-100",
    neighborhood: "Centro", city: "Uberlândia", uf: "MG", privacidade: { semCamerasInterior: true }, garantias: { caucao_avista: true }, photos: [],
  };
  expect((await adm().from("property_photos").delete().eq("property_id", imovel)).error).toBeNull();
  expect((await adm().from("properties").update({ description: "", monthly_price: 0, photo_count: 0, draft_data: draft }).eq("id", imovel)).error).toBeNull();
  return imovel;
}
const semRolagem = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.describe("T1224 — E619 (a conta da Revisão) e E612 (a pendência ao sair do passo)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`E619: a conta da Revisão fecha com o N do botão (${w})`, async ({ browser }) => {
      const imovel = await rascunhoSemPadrao(`Rascunho conta t1224 ${w} ${sufixo}`);
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
      try {
        const p = await entrarNaPagina(await ctx.newPage(), dono.email, senha);
        await p.goto(`/dashboard/imoveis/novo?draft=${imovel}&etapa=revisao`, { waitUntil: "domcontentloaded" });
        await expect(p.getByTestId("etapa-revisar")).toBeVisible({ timeout: 30_000 });
        const motivo = p.getByTestId("publicar-motivo").first();
        await expect(motivo).toContainText(/Faltam? \d+ ite(m|ns) antes de publicar/, { timeout: 20_000 });
        const n = Number((await motivo.innerText()).match(/Faltam? (\d+) ite/)![1]);
        const conta = p.getByTestId("conferencia-conta");
        await expect(conta).toBeVisible({ timeout: 20_000 });
        const texto = (await conta.innerText()).replace(/\s+/g, " ").trim();
        expect(texto, "a conta começa por 'A conta:'").toMatch(/^A conta: /);
        // Com duas parcelas a soma vem depois do "="; com uma só, o total é a própria parcela.
        const total = Number(texto.match(/= (\d+)\./)?.[1] ?? texto.match(/^A conta: (\d+) /)?.[1]);
        expect(total, `A conta ("${texto}") tem de fechar com o N do botão ("${await motivo.innerText()}")`).toBe(n);
        expect(await semRolagem(p)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });

    test(`E612: sair do Passo 5 com o padrão mínimo pendente mostra o que ficou (${w})`, async ({ browser }) => {
      const imovel = await rascunhoSemPadrao(`Rascunho pendência t1224 ${w} ${sufixo}`);
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
      try {
        const p = await entrarNaPagina(await ctx.newPage(), dono.email, senha);
        await p.goto(`/dashboard/imoveis/novo?draft=${imovel}&etapa=comodidades`, { waitUntil: "domcontentloaded" });
        await expect(p.getByTestId("passo-texto")).toHaveText("Passo 5 de 10", { timeout: 30_000 });
        await p.getByTestId("cadastro-continuar").click();
        // O avanço é livre: o passo seguinte abre, com o aviso do que ficou pendente no 5.
        await expect(p.getByTestId("passo-texto")).toHaveText("Passo 6 de 10", { timeout: 20_000 });
        const aviso = p.getByTestId("pendencia-ao-sair");
        await expect(aviso).toBeVisible({ timeout: 15_000 });
        await expect(aviso).toContainText(/Ficou pendente no Passo 5 — /);
        await expect(aviso).toContainText("Você pode seguir; sem isso o anúncio não publica.");
        expect(await aviso.locator("li").count(), "a lista diz o que falta").toBeGreaterThanOrEqual(1);
        // O atalho volta ao Passo 5.
        await p.getByTestId("pendencia-ao-sair-voltar").click();
        await expect(p.getByTestId("passo-texto")).toHaveText("Passo 5 de 10", { timeout: 20_000 });
        expect(await semRolagem(p)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });
  }
});
