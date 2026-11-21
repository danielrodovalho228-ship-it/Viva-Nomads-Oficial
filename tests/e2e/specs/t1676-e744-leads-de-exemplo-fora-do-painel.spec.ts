import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";

/*
  T1676 — E744, varredura dos dados de exemplo (família do E975/E980): os LEADS fictícios do modo demonstração
  ("Rafael L.", "Júlia M."…) iam no JavaScript da tela Interessados (/dashboard/leads), para toda conta. A tela importa
  só as funções puras do Lead, mas elas moravam no mesmo arquivo dos leads de exemplo, e o arquivo inteiro ia junto.
  Os exemplos ganharam um arquivo só deles, que só o servidor e o seed do modo demonstração (sob demanda) importam.
  Trava: para o morador, o proprietário e o admin, NENHUMA resposta recebida ao abrir Interessados e as telas vizinhas
  (HTML, dados e todo arquivo JavaScript) traz os nomes fictícios.
*/

/** Os leads de exemplo, pelos nomes (as contas do laboratório não têm ninguém com esses nomes). */
const MARCAS_DOS_LEADS_DE_EXEMPLO = [/Rafael L\./, /J[úu]lia M\./];

async function tudoQueChega(page: Page, rotas: string[]): Promise<{ url: string; corpo: string }[]> {
  const respostas: Promise<{ url: string; corpo: string } | null>[] = [];
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
  ["inquilino", ["/dashboard", "/dashboard/leads", "/dashboard/candidaturas"]],
  ["proprietario", ["/dashboard", "/dashboard/leads", "/dashboard/imoveis", "/dashboard/mensagens"]],
  ["admin", ["/dashboard", "/dashboard/leads"]],
] as const) {
  test.describe(`T1676 — painel do ${papel} sem os leads de exemplo`, () => {
    test.skip(!hasAccount(papel), `Sem a conta de teste ${papel}.`);
    test.use({ storageState: authFile(papel), viewport: { width: 1280, height: 900 } });

    test(`nenhuma resposta do painel (${papel}) traz os leads fictícios`, async ({ page }) => {
      test.setTimeout(180_000);
      const respostas = await tudoQueChega(page, [...rotas]);
      const js = respostas.filter((r) => /\.js(\?|$)/.test(r.url));
      expect(js.length, "os arquivos JavaScript foram lidos").toBeGreaterThan(5);
      const achados = respostas.flatMap((r) => MARCAS_DOS_LEADS_DE_EXEMPLO.filter((m) => m.test(r.corpo)).map((m) => `${String(m)} em ${new URL(r.url).pathname}`));
      expect(achados, "leads de exemplo no que o navegador recebeu").toEqual([]);
    });
  });
}
