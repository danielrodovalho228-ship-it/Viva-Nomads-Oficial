import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { TAMANHOS, abrirComoConta, lerMassa, temContaVarredura, type ChaveConta, type Massa } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T768 — VARREDURA DA PÁGINA INTEIRA, BLOCO 100 (Pista C, 31/10): abre a 2ª volta do ciclo (o 1º, blocos 72–98, cobriu
  todas as telas do registro com conteúdo próprio). O protocolo do bloco 21 (t385): seis classes (imagem pelo
  carregamento real, elemento fixo sobre conteúdo, cartão sem foto, estouro horizontal, texto cortado, grade), página
  toda rolada, 390 e 1280 px, HTTP abaixo de 400. Começa pelas telas varridas há mais tempo no ciclo (blocos 72–75), que
  são também as que os merges recentes mexeram — a página do imóvel (#1668, chamada para ação), a /buscar (#1670 e
  #1675), a conta (#1678) —, pelas contas da massa da varredura:
   - visitante: início, /buscar, a página do imóvel da massa (17 fotos), /ajuda, dois temas da ajuda e "Fale com a Viva";
   - proprietário (DONO17): interessados, notificações, novo anúncio, conta, meus imóveis e editar o anúncio.
  Defeito novo entra como test.fail ligado a um item (L-83 / D-V10 são os próximos livres).
*/
type Conta = ChaveConta | "VISITANTE" | "SOCIO";
interface Tela {
  conta: Conta;
  papel: string;
  nome: string;
  rota: (m: Massa) => string;
}

const TELAS: Tela[] = [
  { conta: "VISITANTE", papel: "visitante", nome: "Início", rota: () => "/" },
  { conta: "VISITANTE", papel: "visitante", nome: "Buscar", rota: () => "/buscar" },
  { conta: "VISITANTE", papel: "visitante", nome: "Página do imóvel (17 fotos)", rota: (m) => `/imoveis/${m.imovel17}` },
  { conta: "VISITANTE", papel: "visitante", nome: "Ajuda", rota: () => "/ajuda" },
  { conta: "VISITANTE", papel: "visitante", nome: "Ajuda: segurança", rota: () => "/ajuda/seguranca" },
  { conta: "VISITANTE", papel: "visitante", nome: "Ajuda: contratos", rota: () => "/ajuda/contratos" },
  { conta: "VISITANTE", papel: "visitante", nome: "Fale com a Viva", rota: () => "/ajuda/fale-com-a-viva" },
  { conta: "DONO17", papel: "proprietário", nome: "Interessados", rota: () => "/dashboard/leads" },
  { conta: "DONO17", papel: "proprietário", nome: "Notificações", rota: () => "/dashboard/notificacoes" },
  { conta: "DONO17", papel: "proprietário", nome: "Novo anúncio", rota: () => "/dashboard/imoveis/novo" },
  { conta: "DONO17", papel: "proprietário", nome: "Conta", rota: () => "/dashboard/conta" },
  { conta: "DONO17", papel: "proprietário", nome: "Meus imóveis", rota: () => "/dashboard/imoveis" },
  { conta: "DONO17", papel: "proprietário", nome: "Editar o anúncio", rota: (m) => `/dashboard/imoveis/${m.imovel17}/editar` },
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

const CODIGO_SOCIOS = process.env.SOCIOS_ACCESS_CODE;
const MASSA = lerMassa();
const SAIDA = "tests/laboratorio/saida/varredura-bloco100";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

test.describe("T768 — varredura da página inteira, bloco 100 (2ª volta: início, busca, imóvel, ajuda e o painel do proprietário) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (contas da massa da varredura)");
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
    expect(MASSA, "laboratório sem a massa da varredura (scripts/lab/massa-varredura.mjs)").not.toBeNull();
  });

  for (const t of TELAS) {
    test(`${t.papel} — ${t.nome}: as seis classes, rolando a página inteira`, async ({ browser }) => {
      test.setTimeout(180_000);
      test.skip(t.conta !== "VISITANTE" && t.conta !== "SOCIO" && !temContaVarredura(t.conta), `sem a conta ${t.conta} na massa`);
      test.skip(t.conta === "SOCIO" && !CODIGO_SOCIOS, "SOCIOS_ACCESS_CODE não definido neste ambiente");
      const rota = t.rota(MASSA!);
      const rotulo = rota.replace(/[0-9a-f-]{36}/g, ":id");
      const relatorio: Record<string, Record<string, string[]>> = {};
      mkdirSync(SAIDA, { recursive: true });
      for (const tam of TAMANHOS) {
        let page: Page;
        if (t.conta === "VISITANTE" || t.conta === "SOCIO") {
          const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: tam.width, height: tam.height } });
          page = await ctx.newPage();
          if (t.conta === "SOCIO") {
            // A porta única dos sócios: o código grava o cookie vn_socios e devolve para a página pedida (como na t307).
            await page.goto(`/acesso-socios?next=${encodeURIComponent(rota)}`, { waitUntil: "domcontentloaded", timeout: 40_000 });
            await page.locator('input[name="codigo"]').fill(CODIGO_SOCIOS!);
            await page.getByRole("button", { name: "Entrar" }).click();
            await page.waitForURL((u) => u.pathname === rota, { timeout: 30_000 });
          }
        } else {
          page = (await abrirComoConta(browser, t.conta, tam.nome)).page;
        }
        try {
          const respostas = escutarImagens(page);
          const resposta = await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 40_000 });
          expect(resposta?.status() ?? 0, `${t.papel} — ${t.nome} @${tam.nome}: HTTP`).toBeLessThan(400);
          expect(new URL(page.url()).pathname, `${t.papel} — ${t.nome} @${tam.nome}: caiu fora da tela (login ou redirecionamento)`).toBe(rota.split(/[?#]/)[0]);
          await page.locator("main").first().waitFor({ timeout: 20_000 }).catch(() => {});
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
          const achados = await varrerPagina(page, respostas);
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
