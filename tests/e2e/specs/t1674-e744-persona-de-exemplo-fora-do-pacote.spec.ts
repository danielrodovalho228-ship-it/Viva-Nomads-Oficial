import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";

/*
  T1674 — E744, varredura dos dados de exemplo (família do E975/E980): a persona FICTÍCIA do modo demonstração
  ("Marcos Andrade", marcos@exemplo.com) ia no JavaScript de todas as telas do painel, para toda conta, porque morava
  no arquivo do store da sessão, que toda tela importa. Decisão do Gerente (16/11/2026): a persona saiu do produto.
  Trava de que não volta: para o morador, o proprietário e o admin, NENHUMA resposta recebida ao navegar pelo painel
  (HTML, dados e todo arquivo JavaScript) traz o nome ou o e-mail fictícios.
*/

/** A persona que saiu do produto. */
const MARCAS_DA_PERSONA = [/Marcos Andrade/, /marcos@exemplo\.com/];

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
  ["inquilino", ["/dashboard", "/dashboard/mensagens", "/dashboard/locacoes", "/dashboard/conta/perfil", "/dashboard/favoritos"]],
  ["proprietario", ["/dashboard", "/dashboard/imoveis", "/dashboard/leads", "/dashboard/contratos", "/dashboard/conta/perfil", "/dashboard/solicitacoes"]],
  ["admin", ["/dashboard", "/admin", "/admin/usuarios"]],
] as const) {
  test.describe(`T1674 — painel do ${papel} sem a persona de demonstração`, () => {
    test.skip(!hasAccount(papel), `Sem a conta de teste ${papel}.`);
    test.use({ storageState: authFile(papel), viewport: { width: 1280, height: 900 } });

    test(`nenhuma resposta do painel (${papel}) traz o nome ou o e-mail fictícios`, async ({ page }) => {
      test.setTimeout(180_000);
      const respostas = await tudoQueChega(page, [...rotas]);
      const js = respostas.filter((r) => /\.js(\?|$)/.test(r.url));
      expect(js.length, "os arquivos JavaScript foram lidos").toBeGreaterThan(5);
      const achados = respostas.flatMap((r) => MARCAS_DA_PERSONA.filter((m) => m.test(r.corpo)).map((m) => `${String(m)} em ${new URL(r.url).pathname}`));
      expect(achados, "persona do modo demonstração no que o navegador recebeu").toEqual([]);
    });
  });
}
