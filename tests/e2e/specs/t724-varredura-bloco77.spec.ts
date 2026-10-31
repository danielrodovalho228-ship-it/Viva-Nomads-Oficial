import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";
import { TAMANHOS } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T724 — VARREDURA DA PÁGINA INTEIRA, BLOCO 77 (Pista C, 31/10). O protocolo do bloco 21 (t385): seis classes, página
  toda rolada, carregamento real de cada imagem, 390 e 1280 px, HTTP abaixo de 400. As telas dos merges recentes:
    · #1632 (E286) e #1633 (a varredura de parceiros da Pista A, que só olhou 390): as páginas de parceiros — /parceiros,
      a busca em "Todas", Montagem (vazia, com cidade), Limpeza (com cidade), fotógrafos, avaliadores e ativar — agora
      também a 1280;
    · #1635 (E288-B): o Início do admin, /admin/eventos e /admin/funil, com a linha "fora da contagem".
  Sem massa própria além da sessão de admin do laboratório. Sem clique no primário. Só no laboratório.
*/
type Conta = "ADMIN" | "VISITANTE";
interface Tela {
  conta: Conta;
  papel: string;
  nome: string;
  rota: () => string;
  /** testid que a tela tem de mostrar (a prova de que é a tela do merge, não um estado vazio); por largura quando muda. */
  marca?: string | ((largura: number) => string);
}

const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

const TELAS: Tela[] = [
  { conta: "VISITANTE", papel: "visitante", nome: "Parceiros (#1633)", rota: () => "/parceiros" },
  { conta: "VISITANTE", papel: "visitante", nome: "Busca de parceiros, Todas (#1632)", rota: () => "/parceiros/buscar", marca: "topo-todas" },
  { conta: "VISITANTE", papel: "visitante", nome: "Busca de parceiros, Montagem vazia (#1632)", rota: () => "/parceiros/buscar?categoria=montagem&cidade=Uberl%C3%A2ndia&uf=MG", marca: "busca-parceiros-vazia" },
  { conta: "VISITANTE", papel: "visitante", nome: "Busca de parceiros, Limpeza (#1632)", rota: () => "/parceiros/buscar?categoria=limpeza&cidade=Uberl%C3%A2ndia&uf=MG" },
  { conta: "VISITANTE", papel: "visitante", nome: "Fotógrafos parceiros (#1633)", rota: () => "/parceiros/fotografos" },
  { conta: "VISITANTE", papel: "visitante", nome: "Avaliadores parceiros (#1633)", rota: () => "/parceiros/avaliadores" },
  { conta: "VISITANTE", papel: "visitante", nome: "Ativar parceria (#1633)", rota: () => "/parceiros/ativar" },
  { conta: "ADMIN", papel: "admin", nome: "Início do admin (#1635)", rota: () => "/admin" },
  { conta: "ADMIN", papel: "admin", nome: "Eventos com fora da contagem (#1635)", rota: () => `/admin/eventos?tipo=busca&de=${hoje()}&ate=${hoje()}`, marca: "lista-total" },
  { conta: "ADMIN", papel: "admin", nome: "Funil (#1635)", rota: () => "/admin/funil", marca: "admin-funil" },
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

const SAIDA = "tests/laboratorio/saida/varredura-bloco77";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

async function abrir(browser: Browser, t: Tela): Promise<Page> {
  if (t.conta === "ADMIN") return (await browser.newContext({ storageState: authFile("admin") })).newPage();
  return (await browser.newContext()).newPage();
}

test.describe("T724 — varredura da página inteira, bloco 77 (parceiros a 1280 e 390; admin: início, eventos e funil) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "default" });
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
