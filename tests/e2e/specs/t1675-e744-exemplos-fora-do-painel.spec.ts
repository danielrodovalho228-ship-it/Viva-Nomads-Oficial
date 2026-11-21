import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";

/*
  T1675 — E744, varredura dos dados de exemplo (família do E975/E980). Decisão do Gerente (16/11/2026): a vitrine pública
  com anúncios de exemplo é decisão do E131 e fica; o PAINEL logado não carrega anúncios de exemplo como conteúdo.
  Depois do E980 ainda chegavam ao painel: os 15 anúncios de exemplo inteiros e a candidatura fictícia do Fechamento
  (em /dashboard/fechamento), e os proprietários e avaliações de exemplo (em /dashboard/imoveis, puxados por um rótulo).
  Cobra, para o morador e para o proprietário, que nenhuma resposta do painel (HTML, dados e todo arquivo JavaScript)
  traz esses dados.
  Fica de fora, de propósito:
   - a resposta de /api/properties: é a lista PÚBLICA de anúncios (a mesma da /buscar, E131), que Favoritos e Comparar
     leem para mostrar o que a pessoa guardou — e um anúncio de exemplo pode ser guardado;
   - a busca antecipada de OUTRAS páginas (o Next baixa de antemão o código das páginas para onde a tela tem link).
     "Meus imóveis" tem o link "Ver anúncio", e o código da página pública do anúncio traz os proprietários de exemplo
     da vitrine. Isso é código de outra página, não conteúdo do painel; o teste bloqueia a busca antecipada e mede só o
     que cada tela carrega para si. Medido em 16/11/2026: com ela livre, 1 arquivo com a proprietária de exemplo em
     /dashboard/imoveis; bloqueada, nenhum.
*/

const MARCAS = [
  /home office no Santa M[ôo]nica/, // título do ube-001: os anúncios de exemplo inteiros (src/lib/properties.ts)
  /airbnbMonthlyPrice/, // campo que só os anúncios de exemplo trazem preenchido no JavaScript
  /CTR-2026-0042/, // a candidatura fictícia do Fechamento
  /Helena M\. \(exemplo\)/, // proprietária de exemplo (src/config/exemplo-proprietarios.ts)
];
const LISTA_PUBLICA = /^\/api\/properties$/;

async function tudoQueChega(page: Page, rotas: string[]): Promise<{ url: string; corpo: string }[]> {
  const respostas: Promise<{ url: string; corpo: string } | null>[] = [];
  // Busca antecipada de outras páginas: fora (ver o cabeçalho deste arquivo).
  await page.route("**/*", (rota) => (rota.request().headers()["next-router-prefetch"] ? rota.abort() : rota.continue()));
  page.on("response", (r) => {
    const tipo = r.headers()["content-type"] ?? "";
    if (!/javascript|html|json|x-component|text\/plain/.test(tipo)) return;
    // Resposta que fica aberta (o painel mantém conexões) não segura o teste: vale o que chegou em 8 s.
    const texto = Promise.race([r.text(), new Promise<never>((_, recusa) => setTimeout(() => recusa(new Error("lenta")), 8_000))]);
    respostas.push(texto.then((corpo) => ({ url: r.url(), corpo }), () => null));
  });
  for (const rota of rotas) {
    await page.goto(rota, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined); // o painel mantém conexão aberta
  }
  return (await Promise.all(respostas)).filter((r): r is { url: string; corpo: string } => r !== null);
}

for (const [papel, rotas] of [
  ["inquilino", ["/dashboard", "/dashboard/fechamento", "/dashboard/favoritos", "/dashboard/mensagens", "/dashboard/conta/perfil"]],
  ["proprietario", ["/dashboard", "/dashboard/fechamento", "/dashboard/imoveis", "/dashboard/leads", "/dashboard/contratos", "/dashboard/favoritos"]],
] as const) {
  test.describe(`T1675 — painel do ${papel} sem os anúncios de exemplo`, () => {
    test.skip(!hasAccount(papel), `Sem a conta de teste ${papel}.`);
    test.use({ storageState: authFile(papel), viewport: { width: 1280, height: 900 } });

    test(`nenhuma resposta do painel (${papel}) traz anúncio, candidatura ou proprietário de exemplo`, async ({ page }) => {
      test.setTimeout(180_000);
      const respostas = (await tudoQueChega(page, [...rotas])).filter((r) => !LISTA_PUBLICA.test(new URL(r.url).pathname));
      const js = respostas.filter((r) => /\.js(\?|$)/.test(r.url));
      expect(js.length, "os arquivos JavaScript foram lidos").toBeGreaterThan(5);
      const achados = respostas.flatMap((r) => MARCAS.filter((m) => m.test(r.corpo)).map((m) => `${String(m)} em ${new URL(r.url).pathname}`));
      expect([...new Set(achados)], "dados de exemplo no que o navegador recebeu").toEqual([]);
    });
  });
}
