import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo, cnpjAleatorio } from "../fixtures/laboratorio";

/*
  T1485 — E717 (#3396): a página pública do avaliador de CONTA DE TESTE mostra a faixa "Avaliador de teste: esta é uma conta de teste
  da plataforma e não é um avaliador real" (data-testid="avaliador-teste"), como o "Documento de teste" do /conferir. O avaliador de
  conta real não mostra a faixa (nada inventado). Visitante, 390 e 1280 px, sem estouro horizontal.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const contas = {
  teste: { email: `aval.teste.t1485.${sufixo}@lab.vivanomads.test`, nome: "Tereza Teste", role: "tenant" as const },
  real: { email: `aval.real.t1485.${sufixo}@lab.vivanomads.test`, nome: "Rita Real", role: "tenant" as const },
};
const ids: Record<string, string> = {};
const numeros: Record<string, string> = {};
const creds: string[] = [];

async function semearAvaliador(quem: "teste" | "real", ehTeste: boolean) {
  ids[quem] = await criarConta(contas[quem], senha);
  await adm().from("profiles").update({ is_teste: ehTeste }).eq("id", ids[quem]);
  const { data: p, error: eP } = await adm()
    .from("parceiros")
    .insert({ user_id: ids[quem], tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: contas[quem].nome, slug: `aval-t1485-${quem}-${sufixo}`, categorias: ["fotografia"], cidades: ["Uberlândia"], status: "publicado", publicado_em: new Date().toISOString() })
    .select("id")
    .single();
  if (eP) throw eP;
  const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
  const { data: c, error: eC } = await adm()
    .from("avaliadores_credenciamento")
    .insert({ parceiro_id: p.id, cidade: "Uberlândia", numero_credenciado: n as string, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1485", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
    .select("id, numero_credenciado")
    .single();
  if (eC) throw eC;
  creds.push(c.id as string);
  numeros[quem] = c.numero_credenciado as string;
}

test.describe("T1485 — E717: faixa de teste na página pública do avaliador", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(async () => {
    await semearAvaliador("teste", true);
    await semearAvaliador("real", false);
  });
  test.afterAll(async () => {
    if (creds.length) await adm().from("avaliadores_credenciamento").delete().in("id", creds);
    await apagarContas([ids.teste, ids.real].filter(Boolean));
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: conta de teste mostra a faixa; conta real não`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      const r = await page.goto(`/avaliadores/${numeros.teste}`, { waitUntil: "domcontentloaded" });
      expect(r?.status() ?? 0).toBeLessThan(400);
      const faixa = page.getByTestId("avaliador-teste");
      await expect(faixa).toBeVisible({ timeout: 30_000 });
      await expect(faixa).toContainText("conta de teste");
      await expect(faixa).toContainText("não é um avaliador real");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);

      await page.goto(`/avaliadores/${numeros.real}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("avaliador-numero")).toHaveText(numeros.real, { timeout: 30_000 });
      await expect(page.getByTestId("avaliador-teste")).toHaveCount(0);
    });
  }
});
