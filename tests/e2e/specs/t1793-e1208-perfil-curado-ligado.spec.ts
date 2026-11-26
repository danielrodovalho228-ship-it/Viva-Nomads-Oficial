import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo, cnpjAleatorio } from "../fixtures/laboratorio";

/*
  T1793 — E1208 @E1208 (ORDEM-DUET-986/989; trava dada na ORDEM-DUET-989). Parceiros, página pública do avaliador.
  Antes: /avaliadores/UDI-003 mostrava só o primeiro nome da conta, o selo genérico "Avaliador credenciado" e nenhum
  preço. O número passou a existir em avaliadores_credenciamento (em_teste, cidade "Uberlandia, Araguari, Ituiutaba"), a
  página abre o ramo do credenciado, e a linha curada (avaliadores_perfil_publico) só entra por credenciamento_id, que
  estava NULL.
  Massa só no laboratório, com a MESMA forma: uma conta real (não de teste) com credenciamento em_teste, cidade com três
  cidades numa frase e um "Sobre" escrito; uma linha curada com o MESMO número, nome completo, cidade própria e selo
  próprio, por ligar; a tabela de preços da cidade curada (150/250/350).
   1. Sem ligação (o estado de produção hoje): o primeiro nome, o selo genérico, nenhum preço.
   2. Ligada como a migração 0365 liga (credenciamento_id = o credenciamento do mesmo número; feito aqui pela spec,
      porque a massa nasce depois da migração no banco do laboratório): o nome curado, o selo curado, a cidade curada e
      os três preços; o "Sobre" continua o do credenciamento (ORDEM-989 §2).
  Visitante sem sessão, 1280 px. Laboratório; não é prova ao vivo no site.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = { email: `aval.t1793.${sufixo}@lab.vivanomads.test`, nome: "Rosa Conta Sobrenome", role: "tenant" as const };
const CIDADE_CURADA = `Curadopolis ${sufixo}`;
const CURADO = { nome: "Rosa Curada Silva", selo: "Selo curado da t1793" };
const SOBRE = "Sobre escrito pela avaliadora da t1793.";
const ids: Record<string, string> = {};
let numero = "";

test.describe("T1793 — E1208: a linha curada ligada manda no nome, no selo, na cidade e nos preços @E1208", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(async () => {
    ids.conta = await criarConta(conta, senha);
    await adm().from("profiles").update({ is_teste: false }).eq("id", ids.conta);
    const { data: p, error: eP } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.conta, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: conta.nome, slug: `aval-t1793-${sufixo}`, categorias: ["fotografia"], cidades: ["Uberlândia"], status: "publicado", publicado_em: new Date().toISOString() })
      .select("id")
      .single();
    if (eP) throw eP;
    ids.parceiro = p.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    numero = n as string;
    const { data: c, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: p.id, cidade: "Uberlandia, Araguari, Ituiutaba", numero_credenciado: numero, status: "em_teste", sobre: SOBRE, experiencia_link: "https://portfolio.lab.vivanomads.test/t1793", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
      .select("id")
      .single();
    if (eC) throw eC;
    ids.cred = c.id as string;
    const { error: eL } = await adm().from("avaliadores_perfil_publico").insert({ numero, nome_publico: CURADO.nome, cidade: CIDADE_CURADA, selo: CURADO.selo, publicado: true });
    if (eL) throw eL;
    const { error: eT } = await adm()
      .from("vistoria_precos")
      .insert([["estudio", 150], ["q1_2", 250], ["q3_mais", 350]].map(([porte, valor]) => ({ cidade: CIDADE_CURADA, porte, valor })));
    if (eT) throw eT;
  });

  test.afterAll(async () => {
    if (numero) await adm().from("avaliadores_perfil_publico").delete().eq("numero", numero);
    await adm().from("vistoria_precos").delete().eq("cidade", CIDADE_CURADA);
    if (ids.cred) await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    if (ids.parceiro) await adm().from("parceiros").delete().eq("id", ids.parceiro);
    await apagarContas([ids.conta].filter(Boolean));
  });

  test("1. sem ligação (o estado de produção): o primeiro nome da conta, o selo genérico, nenhum preço", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const r = await page.goto(`/avaliadores/${numero}`, { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(200);
    await expect(page.getByTestId("avaliador-nome")).toHaveText("Rosa", { timeout: 30_000 });
    await expect(page.getByTestId("avaliador-rotulo")).toHaveText("Avaliador credenciado");
    await expect(page.getByTestId("avaliador-preco")).toHaveCount(0);
  });

  test("2. ligada como a 0365 liga: o nome, o selo, a cidade e os preços curados; o Sobre continua o do credenciamento", async ({ page }) => {
    const { error } = await adm().from("avaliadores_perfil_publico").update({ credenciamento_id: ids.cred }).eq("numero", numero).is("credenciamento_id", null);
    expect(error).toBeNull();
    await page.setViewportSize({ width: 1280, height: 900 });
    const r = await page.goto(`/avaliadores/${numero}`, { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(200);
    await expect(page.getByTestId("avaliador-nome")).toHaveText(CURADO.nome, { timeout: 30_000 });
    await expect(page.getByTestId("avaliador-rotulo")).toHaveText(CURADO.selo);
    await expect(page.getByTestId("avaliador-cidade")).toHaveText(CIDADE_CURADA);
    await expect(page.getByTestId("avaliador-numero")).toHaveText(numero);
    const precos = page.getByTestId("avaliador-preco-linha");
    await expect(precos).toHaveCount(3);
    await expect(precos.nth(0)).toContainText("R$ 150");
    await expect(precos.nth(1)).toContainText("R$ 250");
    await expect(precos.nth(2)).toContainText("R$ 350");
    await expect(page.getByTestId("avaliador-sobre")).toContainText(SOBRE);
    await page.screenshot({ path: `${SAIDA}/t1793-perfil-ligado-1280.png`, fullPage: true });
  });
});
