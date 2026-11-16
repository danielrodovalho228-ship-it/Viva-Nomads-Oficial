import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";

/*
  T1673 — E980: os dados FICTÍCIOS do modo demonstração (src/lib/demo/seed.ts) iam no JavaScript de todas as telas do
  painel, para toda conta. Foi por eles que o t193 passou a falhar: o piso da proposta do teste (R$ 2.900) coincidia
  com `valorMensal:2900` e `monthlyPrice:2900` do seed, dentro de um pacote estático.
  Cobra, para o morador e para o proprietário, que NENHUMA resposta recebida ao navegar pelo painel (HTML, dados e
  todo arquivo JavaScript) traz os dados de exemplo.
*/

/** Trechos que só existem no seed do modo demonstração. */
const MARCAS_DO_SEED = [/valorMensal:\s*2900/, /monthlyPrice:\s*2900/, /Studio Granja Marileusa/, /Cobertura Tabajaras/, /Apto Jardim Kara[ií]ba/, /exemplo · fict[ií]cio/];

async function tudoQueChega(page: Page, rotas: string[]): Promise<{ url: string; corpo: string }[]> {
  const respostas: Promise<{ url: string; corpo: string } | null>[] = [];
  page.on("response", (r) => {
    const tipo = r.headers()["content-type"] ?? "";
    if (!/javascript|html|json|x-component|text\/plain/.test(tipo)) return;
    respostas.push(r.text().then((corpo) => ({ url: r.url(), corpo }), () => null));
  });
  for (const rota of rotas) {
    await page.goto(rota, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined); // o painel mantém conexão aberta
  }
  return (await Promise.all(respostas)).filter((r): r is { url: string; corpo: string } => r !== null);
}

for (const [papel, rotas] of [
  ["inquilino", ["/dashboard", "/dashboard/mensagens", "/dashboard/locacoes", "/dashboard/contratos"]],
  ["proprietario", ["/dashboard", "/dashboard/imoveis", "/dashboard/leads", "/dashboard/contratos", "/dashboard/garantias", "/dashboard/carteira", "/dashboard/mensagens"]],
] as const) {
  test.describe(`T1673 — E980: painel do ${papel} sem os dados de demonstração`, () => {
    test.skip(!hasAccount(papel), `Sem a conta de teste ${papel}.`);
    test.use({ storageState: authFile(papel), viewport: { width: 1280, height: 900 } });

    test(`nenhuma resposta do painel (${papel}) traz os dados de exemplo`, async ({ page }) => {
      test.setTimeout(180_000);
      const respostas = await tudoQueChega(page, [...rotas]);
      const js = respostas.filter((r) => /\.js(\?|$)/.test(r.url));
      expect(js.length, "os arquivos JavaScript foram lidos").toBeGreaterThan(5);
      const achados = respostas.flatMap((r) => MARCAS_DO_SEED.filter((m) => m.test(r.corpo)).map((m) => `${String(m)} em ${new URL(r.url).pathname}`));
      expect(achados, "dados do modo demonstração no que o navegador recebeu").toEqual([]);
    });
  });
}
