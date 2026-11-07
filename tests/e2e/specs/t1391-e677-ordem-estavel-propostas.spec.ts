import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1391 — E677 (draft Pista B, branch claude-b/e677-numero-orcamento): a lista de propostas (Orçamentos) ordena pelo ENVIO
  (criada_em), não pela última atualização. Duas propostas do mesmo dono para a mesma moradora, no mesmo imóvel: a A foi
  enviada antes, a B depois; depois a A é "atualizada" (vista/resposta). A lista da moradora segue com a B em cima e a A
  embaixo — a linha de uma posição não vira outra proposta. 390 e 1280 px. Spec preparada sobre a branch do draft.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1391.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona Ordem", role: "owner" as const };
const inq = { email: `inq.t1391.${sufixo}@lab.vivanomads.test`, nome: "Ivo Inquilino Ordem", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; a?: string; b?: string } = {};

async function proposta(criadaEm: string): Promise<string> {
  const { data: numero } = await adm().rpc("next_document_number", { p_type: "orcamento", p_year: new Date().getFullYear() });
  const { data, error } = await adm()
    .from("propostas")
    .insert({ numero, lead_id: null, property_id: ids.imovel, owner_id: ids.dono, tenant_id: ids.inq, status: "enviada", versao_atual: 1, validade_dias: 7, valida_ate: new Date(Date.now() + 7 * 86_400_000).toISOString(), criada_em: criadaEm, atualizada_em: criadaEm })
    .select("id")
    .single();
  if (error) throw error;
  const id = data.id as string;
  const { error: ev } = await adm().from("proposta_versoes").insert({ proposta_id: id, versao: 1, autor: "owner", valor_base: 3200, valor_mensal: 3200, meses: 2, data_entrada: new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10), total_mensal: 3200, total_contrato: 6400, mensagem: "Proposta de teste da ordem." });
  if (ev) throw ev;
  return id;
}

test.describe("T1391 — E677: a lista de propostas segue a ordem do envio", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio T1391 ${sufixo}`, { ativo: true });
    ids.a = await proposta("2026-11-01T12:00:00Z");
    ids.b = await proposta("2026-11-05T12:00:00Z");
    // A proposta A (a mais antiga) é "atualizada" agora: antes do E677 ela subia para o topo.
    const { error } = await adm().from("propostas").update({ atualizada_em: new Date().toISOString() }).eq("id", ids.a);
    if (error) throw error;
  });
  test.afterAll(async () => {
    await adm().from("proposta_versoes").delete().in("proposta_id", [ids.a ?? "", ids.b ?? ""]);
    await adm().from("propostas").delete().in("id", [ids.a ?? "", ids.b ?? ""]);
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: a proposta enviada depois fica em cima, mesmo com a mais antiga atualizada`, async ({ browser }) => {
      const p = await entrar(browser, inq.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto("/dashboard/propostas", { waitUntil: "domcontentloaded" });
      const links = p.getByTestId("proposta-inquilino-abrir");
      await expect(links).toHaveCount(2, { timeout: 30_000 });
      const hrefs = await links.evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href")));
      expect(hrefs).toEqual([`/dashboard/propostas/${ids.b}`, `/dashboard/propostas/${ids.a}`]);
      expect(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await p.context().close();
    });
  }
});
