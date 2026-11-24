import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1729 — E1092 @E1092 (ORDEM-DUET-446): a página web do laudo assinado, na vista do AVALIADOR, mostra o nível — a mesma
  linha do PDF ("Nível sustentado: Conforto") e o mesmo valor que o dono vê. Massa própria, só contas de teste: um
  avaliador ativo e dois laudos emitidos por ele (um com o nível Conforto, um sem nível sustentado).
   1. Laudo com o nível Conforto: a vista do avaliador diz "Nível sustentado: Conforto", junto do resultado.
   2. Laudo sem nível sustentado: "Nível sustentado: em adequação" (o texto que o dono lê), nunca um nível inventado.
  As procuras são pelo texto que a tela mostra. Laboratório; não é prova ao vivo no site.
*/
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Uberlândia";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1729.${sufixo}@lab.vivanomads.test`, nome: "Dora Nivel Sobrenome", role: "owner" as const };
const aval = { email: `av.t1729.${sufixo}@lab.vivanomads.test`, nome: "Renato Teste Avaliador", role: "tenant" as const };
const ids: { dono?: string; aval?: string; cred?: string } = {};
const imoveis: string[] = [];
const pedidos: { conforto?: string; adequacao?: string } = {};

/** Uma avaliação com o laudo já emitido e assinado, com o nível gravado dado. */
async function laudoEmitido(nome: string, resultado: string, nivel: string): Promise<string> {
  const imovel = await criarImovelPronto(ids.dono!, `[TESTE QA] Laudo ${nome} ${sufixo}`, { ativo: true, preco: 2500 });
  imoveis.push(imovel);
  const agora = new Date().toISOString();
  const { data, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ property_id: imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 250, status: "laudo_emitido", avaliador_id: ids.cred, designado_em: agora, agendado_para: agora, visita_concluida_em: agora })
    .select("id")
    .single();
  if (error) throw error;
  const id = data.id as string;
  await adm().from("vistoria_designacoes").insert({ pedido_id: id, avaliador_id: ids.cred, resposta: "aceita", respondido_em: agora });
  const { error: e2 } = await adm()
    .from("vistoria_laudos")
    .insert({ pedido_id: id, pedido_versao_id: id, property_id: imovel, owner_id: ids.dono, avaliador_id: ids.cred, numero: `VIS-T1729-${nome}-${sufixo}`, resultado, nivel_sustentado: nivel, assinado_por: ids.aval, assinado_em: agora, assinatura_hash: "a".repeat(64) });
  if (e2) throw e2;
  return id;
}
async function noLaudo(browser: Browser, pedido: string): Promise<Page> {
  const page = await entrar(browser, aval.email, senha);
  await page.setViewportSize({ width: 390, height: 844 });
  // A chave da avaliação liga pelo cookie do teste no laboratório (como na t344).
  await page.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(page.url()).origin }]);
  await page.goto(`/dashboard/parceiro/avaliacao/${pedido}`, { waitUntil: "domcontentloaded" });
  return page;
}

test.describe("T1729 — E1092: a vista do avaliador mostra o nível do laudo assinado @E1092", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.aval = await criarConta(aval, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.aval]);
    const { data: parc, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.aval, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: aval.nome, slug: `aval-t1729-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (error) throw error;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: c, error: e2 } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: parc.id, user_id: ids.aval, cidade: CIDADE, numero_credenciado: n, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test", conduta_versao: "2026-10-23", ativado_em: "2026-01-01T00:00:00Z" })
      .select("id")
      .single();
    if (e2) throw e2;
    ids.cred = c.id as string;
    pedidos.conforto = await laudoEmitido("conforto", "aprovado", "conforto");
    pedidos.adequacao = await laudoEmitido("adequacao", "reprovado", "em_adequacao");
  });

  test.afterAll(async () => {
    if (imoveis.length) {
      await adm().from("vistoria_laudos").delete().in("property_id", imoveis);
      await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    }
    if (ids.cred) {
      await adm().from("vistoria_designacoes").delete().eq("avaliador_id", ids.cred);
      await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    }
    if (ids.aval) await adm().from("parceiros").delete().eq("user_id", ids.aval);
    if (imoveis.length) await adm().from("properties").delete().in("id", imoveis);
    await apagarContas([ids.dono, ids.aval].filter(Boolean) as string[]);
  });

  test("1. Laudo com o nível Conforto: a vista do avaliador diz 'Nível sustentado: Conforto', junto do resultado", async ({ browser }) => {
    const p = await noLaudo(browser, pedidos.conforto!);
    const laudo = p.getByTestId("avaliador-laudo");
    await expect(laudo).toBeVisible({ timeout: 30_000 });
    await expect(laudo.getByText(/^Resultado: /)).toBeVisible();
    await expect(laudo.getByTestId("avaliador-laudo-nivel")).toHaveText("Nível sustentado: Conforto");
    await laudo.scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${SAIDA}/t1729-1-laudo-conforto-390.png`, fullPage: true });
    await p.context().close();
  });

  test("2. Laudo sem nível sustentado: 'Nível sustentado: em adequação', nunca um nível inventado", async ({ browser }) => {
    const p = await noLaudo(browser, pedidos.adequacao!);
    const laudo = p.getByTestId("avaliador-laudo");
    await expect(laudo.getByTestId("avaliador-laudo-nivel")).toHaveText("Nível sustentado: em adequação", { timeout: 30_000 });
    await expect(laudo).not.toContainText(/Nível sustentado: (Essencial|Conforto|Premium)/);
    await p.context().close();
  });
});
