import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { prepararRascunho } from "../fixtures/rascunho-cadastro";
import { TAMANHOS } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T718 — VARREDURA DA PÁGINA INTEIRA, BLOCO 75 (Pista C, 30/10). O protocolo do bloco 21 (t385): seis classes, página
  toda rolada, carregamento real de cada imagem, 390 e 1280 px, HTTP abaixo de 400. As telas dos merges da tarde:
    · #1613 (conformidade da home), #1615 (conformidade da Central de ajuda e do "Fale com a Viva"), #1616
      (conformidade da busca), para o visitante;
    · #1621 (E277): a busca de parceiros com foto — com resultado e o vazio, para o visitante;
    · #1620 (E276): os serviços do morador em cartões com foto; #1609 (E269-B): Minhas visitas do morador;
    · #1612 (P0): Meus anúncios com a pendência do rascunho e o editor do anúncio, para o dono.
  O #1611 (0264), o #1608 (0263) e o #1610 (E274, e-mail) não têm tela nova; o #1622 (E283) muda só o papel.
  Rascunho semeado aqui e apagado no fim. Sem clique no primário. Só no laboratório.
*/
type Conta = "DONO" | "MORADOR" | "VISITANTE";
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
const EMAIL_DONO = `dono.t718.${sufixo}@lab.vivanomads.test`;
const EMAIL_MOR = `mor.t718.${sufixo}@lab.vivanomads.test`;
const BASE = { street: "Rua Santos Dumont", numero: "100", neighborhood: "Centro", city: "Uberlândia", uf: "MG", cep: "", minPeriod: "30", maxPeriod: "180", monthlyPrice: "3200", bathrooms: "1", areaM2: "40", bedrooms: "1", etapaMax: 9 };

const TELAS: Tela[] = [
  { conta: "VISITANTE", papel: "visitante", nome: "Home (#1613)", rota: () => "/" },
  { conta: "VISITANTE", papel: "visitante", nome: "Central de ajuda (#1615)", rota: () => "/ajuda" },
  { conta: "VISITANTE", papel: "visitante", nome: "Fale com a Viva (#1615)", rota: () => "/ajuda/fale-com-a-viva" },
  { conta: "VISITANTE", papel: "visitante", nome: "Busca de imóveis (#1616)", rota: () => "/buscar" },
  { conta: "VISITANTE", papel: "visitante", nome: "Busca de parceiros (#1621)", rota: () => "/parceiros/buscar" },
  { conta: "VISITANTE", papel: "visitante", nome: "Busca de parceiros sem resultado (#1621)", rota: () => `/parceiros/buscar?q=${encodeURIComponent("nenhum parceiro t718")}` },
  { conta: "MORADOR", papel: "morador", nome: "Serviços do morador (#1620)", rota: () => "/dashboard/servicos" },
  { conta: "MORADOR", papel: "morador", nome: "Minhas visitas (#1609)", rota: () => "/dashboard/visitas" },
  { conta: "DONO", papel: "proprietário", nome: "Meus anúncios com rascunho pendente (#1612)", rota: () => "/dashboard/imoveis" },
  { conta: "DONO", papel: "proprietário", nome: "Editor do anúncio (#1612)", rota: () => `/dashboard/imoveis/${ids.rascunho}/editar` },
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

const SAIDA = "tests/laboratorio/saida/varredura-bloco75";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

async function abrir(browser: Browser, t: Tela): Promise<Page> {
  if (t.conta === "DONO") return entrar(browser, EMAIL_DONO, senha);
  if (t.conta === "MORADOR") return entrar(browser, EMAIL_MOR, senha);
  return (await browser.newContext()).newPage();
}

test.describe("T718 — varredura da página inteira, bloco 75 (home, ajuda, buscas, serviços e visitas do morador, anúncios do dono) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "default" });
  test.beforeAll(async ({}, info) => {
    if (info.project.name !== "chromium") return;
    test.setTimeout(120_000);
    ids.dono = await criarConta({ email: EMAIL_DONO, nome: "Bia Pendencia Varredura Setenta e Cinco", role: "owner" }, senha);
    ids.mor = await criarConta({ email: EMAIL_MOR, nome: "Davi Servicos Varredura Setenta e Cinco", role: "tenant" }, senha);
    await adm().from("profiles").update({ is_teste: true, intencao: ["anunciar"], preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    await adm().from("profiles").update({ is_teste: true, preferred_mode: "tenant", papel_ativo: "morador" }).eq("id", ids.mor);
    // Sem CEP e sem data de início: o Passo 10 mostra as duas notas do E258 e o Passo 5, o aviso do "por perto".
    ids.rascunho = await prepararRascunho(ids.dono, `Studio pendente t718 ${sufixo}`, BASE);
  });
  test.afterAll(async ({}, info) => {
    if (info.project.name !== "chromium") return;
    await apagarContas([ids.dono, ids.mor].filter(Boolean));
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
