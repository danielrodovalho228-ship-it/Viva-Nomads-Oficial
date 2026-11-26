import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { provarA0365, type ProvaDa0365 } from "../fixtures/prova-0365";
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
   2. (ORDENS-DUET 1020, 1024 e 1027) A própria 0365 e o rollback de produção, corridos no banco do laboratório num
      esquema de rascunho desfeito no fim (cópias das duas tabelas, com as mesmas chaves únicas), um universo por caso,
      nos cinco casos do coordenador: liga pelo mesmo número; reaplicada, não muda nada; número diferente não liga;
      credenciamento já ligado não liga uma 2.ª linha (e a 0365 não rebenta); o rollback desliga só a ligação por número
      e deixa nome, cidade, selo e publicação. Uma 0365 adulterada cai na asserção do caso que fere.
   3. Ligada pela 0365 (o arquivo corrido de verdade, porque a massa nasce depois da migração no banco do laboratório):
      o nome curado, o selo curado, a cidade curada e os três preços; o "Sobre" continua o do credenciamento.
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
// ORDEM-DUET-1020: a ligação prova-se pelo PRÓPRIO arquivo da 0365, corrido no banco do laboratório pelo cliente JS do
// Postgres (a imagem do Playwright não tem psql; o padrão da t1680). Sem os comentários, é uma instrução só.
const DB = process.env.LAB_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const MIGRACAO_0365 = readFileSync("supabase/migrations/0365_avaliador_perfil_curado_ligado_e1208.sql", "utf8").replace(/--[^\n]*/g, "").trim();
// ORDEM-DUET-1024 (caso 5): o rollback de produção, sem o begin/commit dele (corre dentro da transação desfeita do caso 2).
const ROLLBACK_0365 = readFileSync("supabase/producao/rollback/0365_rollback.sql", "utf8")
  .replace(/--[^\n]*/g, "")
  .replace(/^\s*(begin|commit);\s*$/gim, "")
  .trim();

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

  test("2. a 0365 executada: os cinco casos do coordenador (liga, reaplicada não muda, nº diferente não liga, credenciamento já ligado não liga outra, rollback só desliga)", async () => {
    expect(MIGRACAO_0365, "a 0365 tem a instrução da ligação").toMatch(/update public\.avaliadores_perfil_publico/);
    expect(ROLLBACK_0365, "o rollback tem a instrução que desliga").toMatch(/set credenciamento_id = null/);
    // ORDEM-DUET-1027: cada caso no seu universo, num esquema de rascunho desfeito no fim (tests/e2e/fixtures/prova-0365.ts),
    // com o 3.º credenciamento livre nos casos 3 e 4: uma 0365 adulterada cai na asserção do caso que fere.
    const sql = postgres(DB, { max: 1, onnotice: () => undefined });
    let p: ProvaDa0365;
    try {
      p = await provarA0365(sql, MIGRACAO_0365, ROLLBACK_0365);
    } finally {
      await sql.end();
    }
    // Asserções brandas: o relatório nomeia TODOS os casos que uma 0365 adulterada fere, não só o primeiro.
    // 1. linha curada sem ligação + credenciamento do mesmo número → fica ligada.
    expect.soft(p.caso1.antes, "caso 1, antes: a linha curada sem ligação").toBeNull();
    expect.soft(p.caso1.depois, "caso 1: ligada ao credenciamento do mesmo número").toBe(p.caso1.credenciamento);
    // 2. rodar de novo → nada muda.
    expect.soft(p.caso2.reaplicada, "caso 2: reaplicada, nenhuma linha muda").toBe(0);
    // 3. número diferente → não liga (há um credenciamento livre ao lado).
    expect.soft(p.caso3.ligada, "caso 3: número sem credenciamento igual não liga").toBeNull();
    // 4. credenciamento que já tem uma linha ligada → a 2.ª linha com o mesmo número não é ligada (e a 0365 não rebenta).
    expect.soft(p.caso4.erro, "caso 4: a 0365 corre sem erro (nunca tenta ligar o mesmo credenciamento duas vezes)").toBeNull();
    expect.soft(p.caso4.jaLigada, "caso 4: a linha já ligada continua ligada ao credenciamento dela").toBe(p.caso4.credenciamento);
    expect.soft(p.caso4.segunda, "caso 4: a 2.ª linha com o número do credenciamento já ligado não é ligada").toBeNull();
    // 5. rollback → desliga só a ligação por número; nome, cidade, selo e publicação ficam como estavam.
    expect.soft(p.caso5.erro, "caso 5: o rollback corre sem erro").toBeNull();
    expect.soft(p.caso5.depois.credenciamento_id, "caso 5: o rollback desliga a ligação por número").toBeNull();
    const conteudo = (l: typeof p.caso5.antes) => ({ nome: l.nome_publico, cidade: l.cidade, selo: l.selo, publicado: l.publicado });
    expect.soft(conteudo(p.caso5.depois), "caso 5: o conteúdo curado fica").toEqual(conteudo(p.caso5.antes));
    expect.soft(p.caso5.outraLigacao, "caso 5: a ligação que não é por número fica").toBe(p.caso5.credenciamentoDaOutra);
  });

  test("3. ligada pela 0365: o nome, o selo, a cidade e os preços curados; o Sobre continua o do credenciamento", async ({ page }) => {
    const sql = postgres(DB, { max: 1, onnotice: () => undefined });
    try {
      await sql.unsafe(MIGRACAO_0365);
    } finally {
      await sql.end();
    }
    const { data: ligada } = await adm().from("avaliadores_perfil_publico").select("credenciamento_id").eq("numero", numero).single();
    expect(ligada?.credenciamento_id, "a 0365 ligou a linha curada").toBe(ids.cred);
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
