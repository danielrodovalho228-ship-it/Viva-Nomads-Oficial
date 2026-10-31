import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";
import { TAMANHOS } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T782 — VARREDURA DA PÁGINA INTEIRA, BLOCO 105 (Pista C, 31/10), 2ª volta do ciclo. O protocolo do bloco 21 (t385):
  seis classes, página toda rolada, carregamento real de cada imagem, elemento fixo sobre conteúdo, 390 e 1280 px, HTTP
  abaixo de 400. As telas varridas há mais tempo depois do bloco 104 (registro de cobertura: última varredura no bloco
  88, t752): as do ADMIN sem id na URL — ajuda da publicação, encerramentos de contratos, dados de teste, fotos de
  perfil, marketing, pedidos de parceiros, retenção, serviços, sócios e solicitações. Sessão de admin do laboratório,
  sem massa própria. Defeito novo entra como test.fail ligado a um item (L-83 / D-V10 são os próximos livres).
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

const TELAS: Tela[] = [
  ...[
    ["Ajuda da publicação", "/admin/ajuda-publicacao"],
    ["Encerramentos de contratos", "/admin/contratos/encerramentos"],
    ["Dados de teste", "/admin/dados-de-teste"],
    ["Fotos de perfil", "/admin/fotos-perfil"],
    ["Marketing", "/admin/marketing"],
    ["Pedidos de parceiros", "/admin/parceiros/pedidos"],
    ["Retenção", "/admin/retencao"],
    ["Serviços", "/admin/servicos"],
    ["Sócios", "/admin/socios"],
    ["Solicitações", "/admin/solicitacoes"],
  ].map(([nome, rota]) => ({ conta: "ADMIN" as const, papel: "admin", nome, rota: () => rota })),
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

const SAIDA = "tests/laboratorio/saida/varredura-bloco105";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

async function abrir(browser: Browser, t: Tela): Promise<Page> {
  if (t.conta === "ADMIN") return (await browser.newContext({ storageState: authFile("admin") })).newPage();
  return (await browser.newContext()).newPage();
}

test.describe("T782 — varredura da página inteira, bloco 105 (2ª volta, admin: ajuda da publicação, encerramentos, dados de teste, fotos de perfil, marketing, pedidos de parceiros, retenção, serviços, sócios, solicitações) (390 e 1280 px)", () => {
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
