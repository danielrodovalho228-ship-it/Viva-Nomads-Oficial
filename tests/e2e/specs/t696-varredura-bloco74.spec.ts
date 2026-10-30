import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { prepararRascunho } from "../fixtures/rascunho-cadastro";
import { TAMANHOS } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T696 — VARREDURA DA PÁGINA INTEIRA, BLOCO 74 (Pista C, 30/10). O protocolo do bloco 21 (t385): seis classes, página
  toda rolada, carregamento real de cada imagem, 390 e 1280 px, HTTP abaixo de 400. As telas dos merges do E259 de hoje:
    · #1583 (E259 2): o Passo 5 sem "Tipo de acesso", o Passo 6 com "Como se entra no imóvel?" e o editor do anúncio
      (a seção "Regras da casa" traz a mesma pergunta);
    · #1586 (E259 3/4): o Passo 2, com a contagem das fotos;
    · #1588 (E259 9/10): a página pública do anúncio (destaques das comodidades, "Aceita crianças", o bloco de
      privacidade com o acesso do Passo 6 e a galeria), para o visitante e para o dono.
  O #1584 (0260) e o #1585 (t688) só trazem massa de produção e uma spec, sem tela. O #1587 entra quando mergear.
  Rascunho e anúncio semeados aqui e apagados no fim. Sem clique no primário. Só no laboratório.
*/
type Conta = "DONO" | "VISITANTE";
interface Tela {
  conta: Conta;
  papel: string;
  nome: string;
  rota: () => string;
  /** testid que a tela tem de mostrar (a prova de que é a tela do merge, não um estado vazio); por largura quando muda. */
  marca?: string | ((largura: number) => string);
}

const sufixo = novoSufixo();
const senha = novaSenha();
const ids: Record<string, string> = {};
const EMAIL_DONO = `dono.t696.${sufixo}@lab.vivanomads.test`;
const BASE = { street: "Rua Santos Dumont", numero: "100", neighborhood: "Centro", city: "Uberlândia", uf: "MG", cep: "38400-000", minPeriod: "30", maxPeriod: "180", monthlyPrice: "3200", bathrooms: "1", areaM2: "40", bedrooms: "1", etapaMax: 9 };

const cadastro = (etapa: string) => () => `/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=${etapa}`;
const TELAS: Tela[] = [
  { conta: "DONO", papel: "proprietário", nome: "Passo 2, a contagem das fotos (#1586)", rota: cadastro("fotos"), marca: "fotos-contagem" },
  { conta: "DONO", papel: "proprietário", nome: "Passo 5, sem o tipo de acesso (#1583)", rota: cadastro("comodidades"), marca: "privacidade-campos" },
  { conta: "DONO", papel: "proprietário", nome: "Passo 6, como se entra no imóvel (#1583)", rota: cadastro("regras"), marca: "chegada-e-pedido" },
  { conta: "DONO", papel: "proprietário", nome: "Editor do anúncio, com a seção Regras da casa (#1583)", rota: () => `/dashboard/imoveis/${ids.anuncio}/editar`, marca: "secao-regras" },
  { conta: "VISITANTE", papel: "visitante", nome: "Anúncio público, destaques e privacidade (#1588)", rota: () => `/imoveis/${ids.anuncio}`, marca: "destaques-imovel" },
  { conta: "DONO", papel: "proprietário", nome: "Anúncio público visto pelo dono (#1588)", rota: () => `/imoveis/${ids.anuncio}`, marca: "destaques-imovel" },
];

/** Achados já registrados como defeito de produto (L-*) ou que são o desenho pedido: ficam anotados e não derrubam o teste. */
const CONHECIDOS: { rota: RegExp; achado: RegExp; l: string; classe?: Classe }[] = [
  // L-63 (Pista A + Daniel): as fotos dos cartões de tipo do #1312 ainda não estão em public/images/imoveis/.
  { rota: /^\/dashboard\/imoveis\/novo(\?|$)/, classe: "imagem", achado: /\/images\/imoveis\/(tipo-(casa|studio|loft|cobertura|casa-condominio|flat)|placeholder-imovel-chacara)\.webp/, l: "L-63" },
  { rota: /^\/dashboard\/imoveis\/novo(\?|$)/, classe: "foto", achado: /área de foto vazia \(aspect-ratio 4 \/ 3\).*"Imagem ilustrativa"/, l: "L-63" },
  // Desenho do E248 (#1536): o "›" sólido da fileira que rola senta sobre o item da borda (t662).
  { rota: /^\/dashboard(\/|\?|$)/, classe: "fixo", achado: /coberto por button "Ver mais itens"$/, l: "E248-desenho" },
];
const conhecido = (rotulo: string, a: string, classe?: Classe) => CONHECIDOS.find((c) => c.classe === classe && c.rota.test(rotulo) && c.achado.test(a));

const SAIDA = "tests/laboratorio/saida/varredura-bloco74";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

async function abrir(browser: Browser, t: Tela): Promise<Page> {
  if (t.conta === "DONO") return entrar(browser, EMAIL_DONO, senha);
  return (await browser.newContext()).newPage();
}

test.describe("T696 — varredura da página inteira, bloco 74 (E259: Passos 2, 5 e 6, editor e anúncio público) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "default" });
  test.beforeAll(async ({}, info) => {
    if (info.project.name !== "chromium") return;
    test.setTimeout(120_000);
    ids.dono = await criarConta({ email: EMAIL_DONO, nome: "Bia Entrada Varredura Setenta e Quatro", role: "owner" }, senha);
    await adm().from("profiles").update({ is_teste: true, intencao: ["anunciar"], preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    ids.rascunho = await prepararRascunho(ids.dono, `Studio Bloco 74 ${sufixo}`, BASE);
    // Anúncio no ar com o que o #1583/#1588 mostram: entrada pela fechadura com a senha trocada, crianças, vaga e as
    // comodidades que viram destaque. Gravado antes de qualquer visita (a página pública guarda cache).
    ids.anuncio = await criarImovelPronto(ids.dono, `Apartamento Bloco 74 ${sufixo}`, { ativo: true });
    const { error } = await adm()
      .from("properties")
      .update({ tipo_entrada: "fechadura_com_codigo", senha_trocada_estadia: true, sem_cameras_interior: true, children_allowed: true, parking_spots: 1, internet_mbps: 500 })
      .eq("id", ids.anuncio);
    if (error) throw error;
    await adm().from("property_amenities").delete().eq("property_id", ids.anuncio);
    const { error: e2 } = await adm()
      .from("property_amenities")
      .insert([
        { property_id: ids.anuncio, category: "trabalho", label: "Home office / escritório dedicado", sort_order: 1 },
        { property_id: ids.anuncio, category: "trabalho", label: "Internet fibra de alta velocidade", sort_order: 2 },
        { property_id: ids.anuncio, category: "conforto", label: "Ar-condicionado", sort_order: 3 },
      ]);
    if (e2) throw e2;
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
