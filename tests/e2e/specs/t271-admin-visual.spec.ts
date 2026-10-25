import { test, expect, type Locator, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T271 — regressão visual do admin no Prompt 46 (D5): mesma escala, cores e raios do sistema, decisões primeiro e
  números em lista com divisor fino. Desktop (1280): /admin, /admin/financeiro, /admin/documentos, /admin/atendimento,
  /admin/parceiros, /admin/contratos (lista e [id]) e /admin/usuarios. Celular (390): só /admin e as filas
  (documentos, atendimento) — o admin é web, fora do app.
  O que muda de uma base para outra (números, datas, nomes, linhas das tabelas) vai mascarado: a imagem guarda a
  anatomia da tela (título, decisões, herói, listas, filtros, cabeçalhos), não os dados.
  Rodada L-33/L-4 (Pista C, 23/10 à noite): roda no lab-crítico do PR da vigia só para publicar o diff (esperado, obtido, diferença) para o QA do Muse; a linha de base só muda com o OK registrado.
*/
const DESKTOP = ["/admin", "/admin/financeiro", "/admin/documentos", "/admin/atendimento", "/admin/parceiros", "/admin/contratos", "CONTRATO", "/admin/usuarios"];
const CELULAR = ["/admin", "/admin/documentos", "/admin/atendimento"];
const nome = (rota: string) => (rota === "CONTRATO" ? "admin-contrato-id" : rota.replace(/^\//, "").replace(/\W+/g, "-"));

function mascaras(page: Page): Locator[] {
  return [
    page.locator("main [data-valor], main time, main td, main [data-decisao], main [data-precisa]"),
    page.locator("main ul li, main ol li, main dl dd"),
    page.locator('main [data-testid="admin-decisoes"] h1, main [data-testid="cartao-backup"], main [data-testid="aviso-atendimento-admin"]'),
    page.locator("main img, main canvas, main svg image, main textarea, main input, main select"),
    page.locator('[data-visual="muda"], [aria-label$="aguardando"], nav [aria-label$="não lidas"], nav [aria-label$="novos"]'),
  ];
}

test.describe("T271 — admin: regressão visual (Prompt 46)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
  test.use({ storageState: authFile("admin") });
  const ids: Record<string, string | undefined> = {};

  // Um contrato só do spec, para /admin/contratos/[id] ter o que mostrar em qualquer base.
  test.beforeAll(async () => {
    const senha = novaSenha();
    const sufixo = novoSufixo();
    ids.dono = await criarConta({ email: `dono.t271.${sufixo}@lab.vivanomads.test`, nome: "Vera Visual Lima", role: "owner" }, senha);
    ids.inq = await criarConta({ email: `inq.t271.${sufixo}@lab.vivanomads.test`, nome: "Otto Visual Lima", role: "tenant" }, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio visual do admin ${sufixo}`, { ativo: true, preco: 2600 });
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel, true);
    const { data } = await adm()
      .from("contratos")
      .insert({
        owner_plan: "free", faixa: "media_estadia", tamanho_bloco_meses: 2, comissao_percent: 0.1, qtd_ocupantes: 1, status: "ativo",
        lead_id: ids.lead, property_id: ids.imovel, tenant_id: ids.inq, prazo_total_dias: 90, aluguel_mensal: 2600, comissao_valor: 780,
      })
      .select("id")
      .single();
    ids.contrato = data?.id as string | undefined;
  });
  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    if (ids.lead) await adm().from("leads").delete().eq("id", ids.lead);
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const [largura, rotas] of [[1280, DESKTOP], [390, CELULAR]] as const) {
    for (const rota of rotas) {
      test(`${largura}px — ${rota === "CONTRATO" ? "/admin/contratos/[id]" : rota}`, async ({ page }) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
        let alvo = rota;
        if (rota === "CONTRATO") {
          test.skip(!ids.contrato, "contrato do spec não foi criado");
          alvo = `/admin/contratos/${ids.contrato}`;
        }
        await page.goto(alvo, { waitUntil: "networkidle" });
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 25_000 });
        await page.evaluate(() => document.fonts.ready);
        // Geometria estável em qualquer base: no máximo 1 linha por tabela e 2 itens por lista (o resto do dado não muda
        // a anatomia que a imagem guarda).
        await page.addStyleTag({ content: "main tbody tr:nth-child(n+2), main ul > li:nth-child(n+3), main ol > li:nth-child(n+3) { display: none !important; }" });
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
        await expect(page).toHaveScreenshot(`t271-${nome(rota)}-${largura}.png`, { mask: mascaras(page), maxDiffPixelRatio: 0.03, animations: "disabled" });
      });
    }
  }
});
