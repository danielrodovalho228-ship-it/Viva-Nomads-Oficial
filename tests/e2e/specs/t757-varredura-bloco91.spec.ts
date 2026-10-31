import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm } from "../fixtures/laboratorio";
import { TAMANHOS, abrirComoConta, lerMassa, temContaVarredura, type ChaveConta, type Massa } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T757 — VARREDURA DA PÁGINA INTEIRA, BLOCO 91 (Pista C, 31/10). O protocolo do bloco 21 (t385): seis classes (imagem
  pelo carregamento real, elemento fixo sobre conteúdo, cartão sem foto, estouro horizontal, texto cortado, grade),
  página toda rolada, 390 e 1280 px, HTTP abaixo de 400. Rodízio pelo registro de cobertura (main + rascunhos da Pista
  C): as telas PÚBLICAS com parâmetro na URL (e a /como-funciona) que o ciclo (blocos 72–90) ainda não varreu, como
  visitante — guias, polos de Uberlândia, imóveis perto de um destino (um destino ativo do banco), perfil público do proprietário (DONO17 da massa),
  página do parceiro (o da massa, com 6 fotos na galeria; o slug sai do banco) e o novo pedido de moradia.
  Fica de fora /avaliadores/[numero] (precisa de avaliador credenciado; a t591 semeia um). Defeito novo entra como
  test.fail ligado a um item (L-82 / D-V9 são os próximos livres).
*/
type Conta = ChaveConta | "VISITANTE" | "SOCIO";
interface Tela {
  conta: Conta;
  papel: string;
  nome: string;
  rota: (m: Massa) => string;
}

let slugParceiro = "";
/** Um destino ATIVO do banco do laboratório (o hc-ufu só fica ativo durante a t261); sem nenhum, o caso pula. */
let destino = "";
const TELAS: Tela[] = [
  { conta: "VISITANTE", papel: "visitante", nome: "Como funciona", rota: () => "/como-funciona" },
  { conta: "VISITANTE", papel: "visitante", nome: "Guia: o que é a caução", rota: () => "/guias/o-que-e-a-caucao" },
  { conta: "VISITANTE", papel: "visitante", nome: "Guia: como precificar estadia de meses", rota: () => "/guias/como-precificar-estadia-de-meses" },
  { conta: "VISITANTE", papel: "visitante", nome: "Polo: Centro", rota: () => "/cidades/uberlandia/centro" },
  { conta: "VISITANTE", papel: "visitante", nome: "Polo: HC-UFU Umuarama", rota: () => "/cidades/uberlandia/hc-ufu-umuarama" },
  { conta: "VISITANTE", papel: "visitante", nome: "Imóveis perto de um destino", rota: () => `/imoveis-perto-de/${destino}` },
  { conta: "VISITANTE", papel: "visitante", nome: "Perfil público do proprietário", rota: (m) => `/proprietario/${m.ids.DONO17}` },
  { conta: "VISITANTE", papel: "visitante", nome: "Página do parceiro", rota: () => `/parceiros/${slugParceiro}` },
  { conta: "VISITANTE", papel: "visitante", nome: "Novo pedido de moradia", rota: () => "/pedidos/novo" },
];

/** Achados já registrados como defeito de produto (L-*) ou que são o desenho pedido: ficam anotados e não derrubam o teste. */
const CONHECIDOS: { rota: RegExp; achado: RegExp; l: string; classe?: Classe }[] = [
  // Desenho do E248 (#1536): o "›" sólido da fileira que rola senta sobre o item da borda (t662).
  { rota: /^\/dashboard(\/|\?|$)/, classe: "fixo", achado: /coberto por button "Ver mais itens"$/, l: "E248-desenho" },
];
const conhecido = (rotulo: string, a: string, classe?: Classe) => CONHECIDOS.find((c) => c.classe === classe && c.rota.test(rotulo) && c.achado.test(a));

const CODIGO_SOCIOS = process.env.SOCIOS_ACCESS_CODE;
const MASSA = lerMassa();
const SAIDA = "tests/laboratorio/saida/varredura-bloco91";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

test.describe("T757 — varredura da página inteira, bloco 91 (públicas com parâmetro) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (contas da massa da varredura)");
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
    expect(MASSA, "laboratório sem a massa da varredura (scripts/lab/massa-varredura.mjs)").not.toBeNull();
  });
  test.beforeAll(async () => {
    if (!MASSA) return;
    const { data } = await adm().from("parceiros").select("slug").eq("id", MASSA.parceiro).maybeSingle();
    slugParceiro = String(data?.slug ?? "");
    const { data: d } = await adm().from("destinos").select("slug").eq("ativo", true).limit(1).maybeSingle();
    destino = String((d as { slug?: string } | null)?.slug ?? "");
  });

  for (const t of TELAS) {
    test(`${t.papel} — ${t.nome}: as seis classes, rolando a página inteira`, async ({ browser }) => {
      test.setTimeout(180_000);
      test.skip(t.conta !== "VISITANTE" && t.conta !== "SOCIO" && !temContaVarredura(t.conta), `sem a conta ${t.conta} na massa`);
      test.skip(t.conta === "SOCIO" && !CODIGO_SOCIOS, "SOCIOS_ACCESS_CODE não definido neste ambiente");
      const rota = t.rota(MASSA!);
      if (rota === "/parceiros/") throw new Error("a massa não trouxe o slug do parceiro");
      test.skip(rota === "/imoveis-perto-de/", "o laboratório não tem destino ativo");
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
