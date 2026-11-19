import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2111 — E687 (Pista 3; varredura "sem spec" das 142, lote H) @E687 — sem @ao-vivo-seguro: precisa de sessão e do
  laboratório (VERMELHO PENDENTE DE LABORATÓRIO).
  Regra decidida (E687; unitário e687-dados-da-categoria.test.ts): a empresa e o veículo pedidos no cadastro de
  Mudança/frete chegam ao parceiro aprovado (parceiros.dados_categoria) e aparecem no painel dele, na aba Dados:
  "Empresa de mudança" e "Veículo". Parceiro de outra categoria não mostra essas linhas, mesmo com os dados gravados.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const mudanca = { email: `mud.t2111.${sufixo}@lab.vivanomads.test`, nome: "Marcos Mudanca", role: "tenant" as const };
const limpeza = { email: `limp.t2111.${sufixo}@lab.vivanomads.test`, nome: "Lara Limpeza", role: "tenant" as const };
const ids: Record<string, string> = {};
const DADOS = { empresa: `Carretos Silva ${sufixo}`, veiculo: "Baú 3/4" };

async function parceiro(userId: string, categoria: string, slug: string, nome: string): Promise<string> {
  const { data, error } = await adm()
    .from("parceiros")
    .insert({
      user_id: userId, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: nome, slug, categorias: [categoria], cidades: ["Uberlândia"],
      descricao_curta: "Parceiro de laboratório.", status: "publicado", publicado_em: new Date().toISOString(), dados_categoria: DADOS,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

test.describe("T2111 — E687: Mudança mostra a empresa e o veículo no painel do parceiro; outras categorias, não @E687", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.mudanca = await criarConta(mudanca, senha);
    ids.limpeza = await criarConta(limpeza, senha);
    ids.pMudanca = await parceiro(ids.mudanca, "mudanca", `mud-t2111-${sufixo}`, `Marcos Mudanças ${sufixo}`);
    ids.pLimpeza = await parceiro(ids.limpeza, "limpeza", `limp-t2111-${sufixo}`, `Lara Limpezas ${sufixo}`);
  });

  test.afterAll(async () => {
    await adm().from("parceiros").delete().in("id", [ids.pMudanca ?? "", ids.pLimpeza ?? ""]);
    await apagarContas([ids.mudanca, ids.limpeza]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — Mudança: Empresa de mudança e Veículo na aba Dados; Limpeza: nenhuma das duas`, async ({ browser }) => {
      const p = await entrar(browser, mudanca.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
      await p.getByTestId("parceiro-aba-dados").click({ timeout: 30_000 });
      const linhas = p.getByTestId("parceiro-dado-categoria");
      await expect(linhas).toHaveCount(2, { timeout: 15_000 });
      await expect(linhas.nth(0)).toContainText("Empresa de mudança");
      await expect(linhas.nth(0)).toContainText(DADOS.empresa);
      await expect(linhas.nth(1)).toContainText("Veículo");
      await expect(linhas.nth(1)).toContainText(DADOS.veiculo);
      await p.context().close();

      const q = await entrar(browser, limpeza.email, senha);
      await q.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await q.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
      await q.getByTestId("parceiro-aba-dados").click({ timeout: 30_000 });
      await expect(q.getByTestId("parceiro-documento"), "a aba Dados abriu").toBeVisible();
      await expect(q.getByTestId("parceiro-dado-categoria"), "Limpeza não mostra empresa nem veículo").toHaveCount(0);
      await expect(q.locator("main")).not.toContainText(DADOS.empresa);
      await q.context().close();
    });
  }
});
