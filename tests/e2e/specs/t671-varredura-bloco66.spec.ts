import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, fotosReais, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { TAMANHOS } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T671 — VARREDURA DA PÁGINA INTEIRA, BLOCO 66 (Pista C, 30/10). O protocolo do bloco 21 (t385): seis classes, página
  toda rolada, carregamento real de cada imagem, 390 e 1280 px, HTTP abaixo de 400. As telas dos merges depois do bloco 65:
    · E252-B (#1546): /precos com a faixa sem teto "31+ · taxa negociável" na tabela (computador) e nos cartões (celular);
    · #1549 / #1550: o início com o rodapé novo, a Central de Ajuda e "Fale com a Viva" (com o caminho dos parceiros);
    · E225-A (#1548): o Passo 5 do cadastro com a estrutura de acessibilidade LIGADA (os 8 itens à vista) e o anúncio
      público com "Estrutura informada pelo proprietário".
  Sem clique no primário. Semeado aqui e apagado no fim. Só no laboratório.
*/
type Conta = "DONO" | "VISITANTE";
interface Tela {
  conta: Conta;
  papel: string;
  nome: string;
  rota: () => string;
  /** testid que a tela tem de mostrar; por largura quando muda. */
  marca?: string | ((largura: number) => string);
  /** Deixa a tela no estado a varrer (depois de abrir). */
  preparar?: (p: Page) => Promise<void>;
}

const sufixo = novoSufixo();
const senha = novaSenha();
const ids: Record<string, string> = {};
const EMAIL_DONO = `dono.t671.${sufixo}@lab.vivanomads.test`;
const ACESSIVEL = ["entradaSemDegrauOuRampa", "elevadorOuTerreo", "portas80cm", "banheiroAdaptado"];

const TELAS: Tela[] = [
  { conta: "VISITANTE", papel: "visitante", nome: "Preços com a faixa 31+ negociável (E252-B)", rota: () => "/precos", marca: (l) => (l < 640 ? "faixas-taxa-cartoes" : "faixas-taxa") },
  { conta: "VISITANTE", papel: "visitante", nome: "Início com o rodapé novo (#1549/#1550)", rota: () => "/" },
  { conta: "VISITANTE", papel: "visitante", nome: "Central de Ajuda (#1549)", rota: () => "/ajuda" },
  { conta: "VISITANTE", papel: "visitante", nome: "Fale com a Viva, com o caminho dos parceiros (#1550)", rota: () => "/ajuda/fale-com-a-viva" },
  {
    conta: "DONO",
    papel: "proprietário",
    nome: "Passo 5 com a estrutura de acessibilidade ligada (E225-A)",
    rota: () => `/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=comodidades`,
    marca: "estrutura-acessibilidade",
    preparar: async (p) => {
      const bloco = p.getByTestId("bloco-estrutura");
      await bloco.scrollIntoViewIfNeeded();
      if ((await bloco.getAttribute("data-ligado")) !== "sim") await p.getByTestId("bloco-estrutura-toggle").click();
      await expect(p.getByTestId("estrutura-grupo-acessibilidade")).toBeVisible({ timeout: 10_000 });
      await p.evaluate(() => window.scrollTo(0, 0));
    },
  },
  { conta: "VISITANTE", papel: "visitante", nome: "Anúncio com a estrutura informada pelo proprietário (E225-A)", rota: () => `/imoveis/${ids.ativo}`, marca: "estrutura-informada" },
];

/** Achados já registrados como defeito de produto (L-*) ou que são o desenho pedido: ficam anotados e não derrubam o teste. */
const CONHECIDOS: { rota: RegExp; achado: RegExp; l: string; classe?: Classe }[] = [
  // L-63 (Pista A + Daniel): as 7 fotos dos cartões de tipo do #1312 ainda não estão em public/images/imoveis/.
  { rota: /^\/dashboard\/imoveis\/novo(\?|$)/, classe: "imagem", achado: /\/images\/imoveis\/(tipo-(casa|studio|loft|cobertura|casa-condominio|flat)|placeholder-imovel-chacara)\.webp/, l: "L-63" },
  { rota: /^\/dashboard\/imoveis\/novo(\?|$)/, classe: "foto", achado: /área de foto vazia \(aspect-ratio 4 \/ 3\).*"Imagem ilustrativa"/, l: "L-63" },
];
const conhecido = (rotulo: string, a: string, classe?: Classe) => CONHECIDOS.find((c) => c.classe === classe && c.rota.test(rotulo) && c.achado.test(a));

const SAIDA = "tests/laboratorio/saida/varredura-bloco66";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

async function abrir(browser: Browser, t: Tela): Promise<Page> {
  if (t.conta === "DONO") return entrar(browser, EMAIL_DONO, senha);
  return (await browser.newContext()).newPage();
}

test.describe("T671 — varredura da página inteira, bloco 66 (faixa 31+ negociável, rodapé e ajuda, estrutura de acessibilidade) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "default" });
  test.beforeAll(async ({}, info) => {
    if (info.project.name !== "chromium") return;
    test.setTimeout(120_000);
    ids.dono = await criarConta({ email: EMAIL_DONO, nome: "Lia Estrutura Varredura Sessenta e Seis", role: "owner" }, senha);
    await adm().from("profiles").update({ is_teste: true, intencao: ["anunciar"], preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    ids.rascunho = await criarImovelPronto(ids.dono, `[Varredura] Studio com estrutura t671 ${sufixo}`);
    ids.ativo = await criarImovelPronto(ids.dono, `[Varredura] Apartamento com rampa e portas largas t671 ${sufixo}`, { ativo: true });
    await fotosReais(ids.ativo, ids.dono);
    // Antes de qualquer visita: a página pública guarda cache (revalidate de 60 s), como na t668.
    const checklist = { ...Object.fromEntries(ACESSIVEL.map((k) => [k, true])), boxSemDegrau: true, pisoAntiderrapante: false };
    const { error } = await adm().from("imovel_estrutura").upsert({ property_id: ids.ativo, checklist }, { onConflict: "property_id" });
    if (error) throw error;
  });
  test.afterAll(async ({}, info) => {
    if (info.project.name !== "chromium") return;
    await apagarContas([ids.dono].filter(Boolean));
  });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
  });

  for (const t of TELAS) {
    test(`${t.papel} — ${t.nome}: as seis classes, rolando a página inteira`, async ({ browser }) => {
      test.setTimeout(180_000);
      const relatorio: Record<string, Record<string, string[]>> = {};
      mkdirSync(SAIDA, { recursive: true });
      for (const tam of TAMANHOS) {
        const rota = t.rota();
        const page = await abrir(browser, t);
        await page.setViewportSize({ width: tam.width, height: tam.height });
        try {
          const respostas = escutarImagens(page);
          const resposta = await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 40_000 });
          expect(resposta?.status() ?? 0, `${t.papel} — ${t.nome} @${tam.nome}: HTTP`).toBeLessThan(400);
          expect(new URL(page.url()).pathname, `${t.papel} — ${t.nome} @${tam.nome}: caiu fora da tela (login ou redirecionamento)`).toBe(rota.split(/[?#]/)[0]);
          await page.locator("main").first().waitFor({ timeout: 20_000 }).catch(() => {});
          const marca = typeof t.marca === "function" ? t.marca(tam.width) : t.marca;
          if (marca) {
            await expect.soft(page.getByTestId(marca).filter({ visible: true }).first(), `${t.nome} @${tam.nome}: a tela do merge aparece (${marca})`).toBeVisible({ timeout: 20_000 });
          }
          if (t.preparar) await t.preparar(page);
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
          const achados = await varrerPagina(page, respostas);
          const rotulo = rota.replace(/[0-9a-f-]{36}/g, ":id");
          for (const classe of Object.keys(CLASSES) as Classe[]) {
            await test.step(`${classe} @${tam.nome}`, async () => {
              for (const a of achados[classe]) console.log(`VARREDURA|${classe}|${tam.nome}|${t.papel}|${rotulo}|${a}`);
              for (const a of achados[classe]) {
                const c = conhecido(rotulo, a, classe);
                if (c) test.info().annotations.push({ type: c.l, description: `${rotulo} @${tam.nome} (${classe}): ${a}` });
              }
              const novos = achados[classe].filter((a) => !conhecido(rotulo, a, classe));
              expect.soft(novos, `${t.papel} — ${t.nome} @${tam.nome} — ${classe}: ${CLASSES[classe]}`).toEqual([]);
            });
          }
          await page.screenshot({ path: `${SAIDA}/${slug(`${t.papel}-${t.nome}`)}-${tam.width}.png`, fullPage: true }).catch(() => {});
          relatorio[tam.nome] = achados;
        } finally {
          await page.context().close();
        }
      }
      writeFileSync(`${SAIDA}/${slug(`${t.papel}-${t.nome}`)}.json`, JSON.stringify({ papel: t.papel, tela: t.nome, achados: relatorio }, null, 2));
    });
  }
});
