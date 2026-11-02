import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1039 — #2331 (Relay 46, irmãos do vínculo; ordem do Daniel, 02/11: "nunca apagar, nunca rebaixar"): com a
 * documentação do imóvel APROVADA, a tela /qualificar não oferece mais o envio de outro arquivo — o campo dá lugar a
 * "A documentação deste imóvel já foi conferida. Para trocar o documento, fale com a equipe: o conferido continua
 * valendo até lá." (documento-conferido-mantido). Antes, o arquivo novo virava a linha mais recente ("em análise") e
 * rebaixava o imóvel. 390 e 1280:
 *   1. imóvel com o documento aprovado: a mensagem aparece, nenhum campo de arquivo do documento, e o banco continua
 *      com uma linha só, aprovada;
 *   2. controle — imóvel com o documento em análise: o campo de envio segue lá e a mensagem não aparece.
 * O selo do LinkedIn (o outro fluxo do #2331) só ganhou teste de unidade da regra que já valia: nada muda na tela.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1039.${sufixo}@lab.vivanomads.test`, nome: "Dalila Documento Souza", role: "owner" as const };
const MSG = "A documentação deste imóvel já foi conferida. Para trocar o documento, fale com a equipe: o conferido continua valendo até lá.";
const ids: { dono?: string; aprovado?: string; pendente?: string } = {};

test.describe("T1039 — #2331: documento conferido nunca é rebaixado por um arquivo novo", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.aprovado = await criarImovelPronto(ids.dono, `Studio conferido t1039 ${sufixo}`);
    ids.pendente = await criarImovelPronto(ids.dono, `Studio em análise t1039 ${sufixo}`, { documentoPendente: dono.nome });
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`aprovado: a mensagem no lugar do envio; em análise: o envio segue (${w})`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });

      await p.goto(`/qualificar?imovel=${ids.aprovado}`, { waitUntil: "domcontentloaded" });
      const mantido = p.getByTestId("documento-conferido-mantido");
      await expect(mantido).toHaveText(MSG, { timeout: 30_000 });
      await expect(p.locator('input[type="file"]')).toHaveCount(0);
      expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      const { data: linhas } = await adm().from("qualification_checklists").select("document_status").eq("property_id", ids.aprovado!);
      expect((linhas ?? []).map((l) => (l as { document_status: string }).document_status), "uma linha só, aprovada").toEqual(["approved"]);

      await p.goto(`/qualificar?imovel=${ids.pendente}`, { waitUntil: "domcontentloaded" });
      await expect(p.locator('input[type="file"]').first()).toBeAttached({ timeout: 30_000 });
      await expect(p.getByTestId("documento-conferido-mantido")).toHaveCount(0);
      await p.context().close();
    });
  }
});
