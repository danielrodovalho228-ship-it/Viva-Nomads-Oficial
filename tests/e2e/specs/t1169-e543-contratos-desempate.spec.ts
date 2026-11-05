import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { numeroPublicoContrato } from "../../../src/lib/contrato-ref";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1169 — E543 (#2648, 05/11): na lista de contratos do admin, dois contratos com o MESMO número público (os 8 primeiros
 * hex do id coincidem — o par da massa 0268) pareciam "o mesmo contrato duas vezes". Agora a linha mostra o desempate
 * pelo fim do id ("VN-CT-A0268B00 · id …0011"); o número público em si não muda. O E543 entrou só com teste de unidade;
 * aqui é a tela, com a sessão de admin do laboratório, 390 e 1280, e dois contratos semeados com ids de mesmo prefixo:
 *   1. a lista filtrada pelo imóvel do teste tem as duas linhas;
 *   2. cada linha traz o número público seguido do desempate com os 4 últimos do SEU id — e os dois são diferentes;
 *   3. sem estouro horizontal.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const PREFIXO = randomBytes(4).toString("hex");
const idDe = () => `${PREFIXO}-0000-4000-8000-${randomBytes(6).toString("hex")}`;
const TITULO = `Studio desempate ${sufixo}`;
const dono = { email: `dono.t1169.${sufixo}@lab.vivanomads.test`, nome: "Rui Contratos", role: "owner" as const };
const inq = (k: number) => ({ email: `inq.t1169.${k}.${sufixo}@lab.vivanomads.test`, nome: `Inquilina ${k} T1169`, role: "tenant" as const });
const ids: { dono?: string; imovel?: string; inqs: string[]; contratos: string[] } = { inqs: [], contratos: [] };

test.describe("T1169 — E543: contratos com o mesmo número público ganham o desempate na lista do admin", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true, preco: 3200 });
    for (const k of [1, 2]) {
      const tenant = await criarConta(inq(k), senha);
      ids.inqs.push(tenant);
      const id = idDe();
      const { error } = await adm()
        .from("contratos")
        .insert({
          id, property_id: ids.imovel, tenant_id: tenant, owner_plan: "free", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3200,
          tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 768, qtd_ocupantes: 1, status: "ativo", garantia: "caucao",
        });
      expect(error, error?.message).toBeNull();
      ids.contratos.push(id);
    }
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    if (ids.contratos.length) await adm().from("contratos").delete().in("id", ids.contratos);
    await apagarContas([...ids.inqs, ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`as duas linhas com o desempate pelo fim do id (${w})`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      try {
        await page.goto(`/admin/contratos?tipo=todos&q=${encodeURIComponent(TITULO)}`, { waitUntil: "domcontentloaded" });
        const linhas = page.getByTestId("contrato-linha").filter({ hasText: TITULO });
        await expect(linhas).toHaveCount(2, { timeout: 30_000 });
        const numero = numeroPublicoContrato(ids.contratos[0]);
        expect(numeroPublicoContrato(ids.contratos[1]), "os dois têm o mesmo número público").toBe(numero);
        for (const id of ids.contratos) await expect(linhas.filter({ hasText: `${numero} · id …${id.slice(-4)}` }), id).toHaveCount(1);
        expect(ids.contratos[0].slice(-4)).not.toBe(ids.contratos[1].slice(-4));
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await ctx.close();
      }
    });
  }
});
