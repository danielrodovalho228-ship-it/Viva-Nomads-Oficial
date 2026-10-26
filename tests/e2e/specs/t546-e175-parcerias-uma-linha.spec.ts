import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T546 — E175 (#1400), guarda permanente da Pista C: as parcerias pendentes viram UMA linha no "Precisa da sua atenção"
  do admin (antes, "parcerias para aprovar" e "parcerias sem resposta há mais de 1 dia útil" contavam a mesma parceria
  duas vezes — "Ver todas (8)" com 5 itens distintos). Com 2 pedidos de parceria antigos (7 dias) e 1 novo:
   - nenhuma linha "parceiros_sem_resposta_1_dia" na tela inicial do admin;
   - a linha "parceiros_para_aprovar" tem o número da aba Pendentes (o mesmo filtro no banco) e o atraso no detalhe
     ("N sem resposta há mais de 1 dia útil");
   - nenhum link de parcerias repetido entre as linhas.
  A 1280 e 390 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const pedidos = [0, 1, 2].map((i) => ({ email: `parc.t546.${i}.${sufixo}@lab.vivanomads.test`, nome: `Parceira T546 ${i}`, role: "tenant" as const }));
const ids: string[] = [];
const SETE_DIAS = 7 * 86_400_000;

async function pendentesNoBanco(): Promise<number> {
  const { data, error } = await adm().from("parceiro_solicitacoes").select("id").in("status", ["pendente", "aguardando_email"]).not("categorias", "cs", "{vistoria}");
  if (error) throw error;
  return data?.length ?? 0;
}

test.describe("T546 — E175: parcerias pendentes numa linha só no admin", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    for (const p of pedidos) ids.push(await criarConta(p, senha));
    const { error } = await adm()
      .from("parceiro_solicitacoes")
      .insert(
        pedidos.map((p, i) => ({
          user_id: ids[i],
          email: p.email,
          nome: p.nome,
          tipo_pessoa: "pf",
          documento: cpfAleatorio(),
          categorias: ["fotografia"],
          cidades: ["Uberlândia"],
          status: "pendente",
          origem: "site",
          criado_em: new Date(Date.now() - (i < 2 ? SETE_DIAS : 0)).toISOString(),
        })),
      );
    if (error) throw error;
  });
  test.afterAll(async () => {
    await adm().from("parceiro_solicitacoes").delete().in("user_id", ids);
    await apagarContas(ids);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: uma linha de parcerias com o atraso no detalhe`, async ({ browser }) => {
      test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
      const page = await (await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: w === 390 ? 844 : 900 } })).newPage();
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
      const painel = page.getByTestId("admin-atencao");
      await expect(painel).toBeVisible({ timeout: 30_000 });
      const linhas = painel.getByTestId("admin-atencao-item");
      const chaves = await linhas.evaluateAll((els) => els.map((e) => e.getAttribute("data-chave")));
      const hrefs = await linhas.locator("a[data-href]").evaluateAll((els) => els.map((e) => e.getAttribute("data-href")));
      console.log(`t546 ${w}: linhas ${JSON.stringify(chaves)}`);
      await page.screenshot({ path: `tests/laboratorio/saida/t546-admin-${w}.png`, fullPage: true });
      expect(chaves, "a linha antiga das parcerias atrasadas voltou").not.toContain("parceiros_sem_resposta_1_dia");
      expect(new Set(hrefs).size, `links repetidos entre as linhas: ${JSON.stringify(hrefs)}`).toBe(hrefs.length);

      const linha = painel.locator('[data-testid="admin-atencao-item"][data-chave="parceiros_para_aprovar"]');
      await expect(linha, `a linha das parcerias está entre as primeiras: ${JSON.stringify(chaves)}`).toHaveCount(1);
      const n = Number(await linha.locator("a[data-valor]").getAttribute("data-valor"));
      expect(n, "o número da linha = pedidos pendentes no banco (a aba Pendentes)").toBe(await pendentesNoBanco());
      await expect(linha).toContainText(/\d+ sem resposta há mais de 1 dia útil/);
      await page.context().close();
    });
  }
});
