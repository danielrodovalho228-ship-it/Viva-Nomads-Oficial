import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T894 — achado nº 21 (#1938, Pista B): os documentos do morador passaram a ler com `exigir`; se a leitura falha, a tela
  mostra "docs-inquilino-erro" com "Tentar de novo" em vez de "nenhum documento". A falha do banco não se provoca no
  laboratório sem quebrar a massa compartilhada (fica com os testes unitários do PR); aqui, o caminho NORMAL: candidatura
  ACEITA → em /dashboard/candidaturas o bloco dos documentos do morador aparece (docs-inquilino) e o aviso de erro não,
  a 1280 e a 390 px.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t894.${sufixo}@lab.vivanomads.test`, nome: "Dora Docs", role: "owner" as const };
const inq = { email: `inq.t894.${sufixo}@lab.vivanomads.test`, nome: "Ivo Docs", role: "tenant" as const };
const ids: { dono?: string; inq?: string; lead?: string } = {};

test.describe("T894 — achado nº 21: documentos do morador carregam sem aviso falso (1280 e 390 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    const imovel = await criarImovelPronto(ids.dono, `Studio docs t894 ${sufixo}`, { ativo: true, preco: 3200 });
    ids.lead = await criarLead(ids.dono, ids.inq, imovel, true);
  });
  test.afterAll(async () => {
    if (ids.lead) await adm().from("leads").delete().eq("id", ids.lead);
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const largura of [1280, 390] as const) {
    test(`candidatura aceita @${largura}: o bloco dos documentos aparece, sem 'docs-inquilino-erro'`, async ({ browser }) => {
      const page = await entrar(browser, inq.email, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/dashboard/candidaturas", { waitUntil: "domcontentloaded" });
      const docs = page.getByTestId("docs-inquilino").first();
      await expect(docs, "o bloco dos documentos do morador carregou").toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("docs-inquilino-erro"), "sem o aviso de falha").toHaveCount(0);
      console.log(`t894|${largura}|docs|${(await docs.innerText()).replace(/\s+/g, " ").slice(0, 200)}`);
      await docs.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t894-docs-${largura}.png` });
      await page.context().close();
    });
  }
});
