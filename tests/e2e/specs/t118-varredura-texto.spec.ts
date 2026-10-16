import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrar, fotosReais, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { achadosNoTexto, rotaVarreTermos } from "../../../src/lib/varredura-texto";

/**
 * T118 — VARREDURA DE TEXTO (ordem 0569d129, item 6). Percorre as rotas públicas do sitemap e as telas do
 * inquilino e do proprietário a 390 px e FALHA se aparecer termo proibido (aluguel, comissão, vistoria,
 * corretagem, intermediação, temporada, art. 48), código de status cru (pendente_aceite), data ISO,
 * UUID inteiro ou "undefined/null/NaN". /termos, /privacidade e contratos (parecer jurídico) ficam fora só
 * da parte de termos. Admin fica de fora (2FA). Todos os achados saem juntos (expect.soft).
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const inq = { email: `inq.txt.${sufixo}@lab.vivanomads.test`, nome: "Tânia Texto Inquilina", role: "tenant" as const };
const dono = { email: `dono.txt.${sufixo}@lab.vivanomads.test`, nome: "Túlio Texto Dono", role: "owner" as const };
const ids: { inq?: string; dono?: string; imovel?: string } = {};

const TELAS_LOGADAS = [
  "/dashboard",
  "/dashboard/mensagens",
  "/dashboard/candidaturas",
  "/dashboard/pedidos",
  "/dashboard/garantias",
  "/dashboard/locacoes",
  "/dashboard/contratos",
  "/dashboard/reembolsos",
  "/dashboard/solicitacoes",
  "/dashboard/simulador",
  "/dashboard/conta",
  "/dashboard/imoveis",
  "/dashboard/leads",
  "/dashboard/ferramentas",
  "/dashboard/viabilidade",
  "/dashboard/roi-imovel",
];

async function textoDaTela(page: Page, rota: string): Promise<string[]> {
  try {
    const resp = await page.goto(rota, { waitUntil: "networkidle", timeout: 40_000 });
    if ((resp?.status() ?? 0) >= 400) return [`HTTP ${resp?.status()}`];
    const texto = await page.locator("body").innerText();
    return achadosNoTexto(texto, { termos: rotaVarreTermos(rota) });
  } catch (e) {
    return [`não abriu: ${String(e).slice(0, 160)}`];
  }
}

test.describe("T118 — Varredura de texto", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeAll(async () => {
    ids.inq = await criarConta(inq, senha);
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio do texto ${sufixo}`, { ativo: true });
    await fotosReais(ids.imovel, ids.dono);
  });

  test.afterAll(async () => {
    await apagarContas([ids.inq, ids.dono]);
  });

  test("visitante: rotas públicas do sitemap sem texto proibido", async ({ page, request }) => {
    test.setTimeout(600_000);
    const xml = await (await request.get("/sitemap.xml")).text();
    const rotas = [...new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname))];
    expect(rotas.length, "o sitemap lista rotas").toBeGreaterThan(10);
    for (const rota of [...rotas, "/404-inexistente-t118"]) {
      expect.soft(await textoDaTela(page, rota), rota).toEqual([]);
    }
  });

  for (const [nome, conta, extra] of [
    ["inquilino", inq, [] as string[]],
    ["proprietário", dono, () => [`/dashboard/imoveis/${ids.imovel}/editar`]],
  ] as const) {
    test(`${nome}: telas do painel sem texto proibido`, async ({ browser }) => {
      test.setTimeout(600_000);
      const page = await entrar(browser, conta.email, senha);
      const mais = typeof extra === "function" ? extra() : extra;
      for (const rota of [...TELAS_LOGADAS, ...mais]) {
        expect.soft(await textoDaTela(page, rota), rota).toEqual([]);
      }
      await page.context().close();
    });
  }
});
