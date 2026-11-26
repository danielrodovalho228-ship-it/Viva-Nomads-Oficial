import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import postgres from "postgres";
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
   2. (ORDEM-DUET-1020 e 1024) A própria 0365 e o rollback de produção, corridos no banco do laboratório numa transação
      desfeita no fim, nos cinco casos do coordenador: liga pelo mesmo número; reaplicada, não muda nada; número
      diferente não liga; credenciamento já ligado não liga uma 2ª linha; o rollback desliga só a ligação por número e
      deixa nome, cidade, selo e publicação. Com o `update` revertido, cai.
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
const conta2 = { email: `aval2.t1793.${sufixo}@lab.vivanomads.test`, nome: "Rita Outra Sobrenome", role: "tenant" as const };
const avulso = (sigla: string) => `${sigla}-${String(Math.floor(100000 + Math.random() * 899999))}`;
class Desfazer extends Error {}

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
    // ORDEM-DUET-1024 (caso 4): um 2º credenciamento, para a linha já ligada a ele.
    ids.conta2 = await criarConta(conta2, senha);
    const { data: p2, error: eP2 } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.conta2, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: conta2.nome, slug: `aval2-t1793-${sufixo}`, categorias: ["fotografia"], cidades: ["Uberlândia"], status: "publicado", publicado_em: new Date().toISOString() })
      .select("id")
      .single();
    if (eP2) throw eP2;
    ids.parceiro2 = p2.id as string;
    const { data: n2 } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    ids.numero2 = n2 as string;
    const { data: c2, error: eC2 } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: p2.id, cidade: "Uberlândia", numero_credenciado: ids.numero2, status: "em_teste", experiencia_link: "https://portfolio.lab.vivanomads.test/t1793b", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
      .select("id")
      .single();
    if (eC2) throw eC2;
    ids.cred2 = c2.id as string;
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
    for (const c of [ids.cred, ids.cred2].filter(Boolean)) await adm().from("avaliadores_credenciamento").delete().eq("id", c);
    for (const p of [ids.parceiro, ids.parceiro2].filter(Boolean)) await adm().from("parceiros").delete().eq("id", p);
    await apagarContas([ids.conta, ids.conta2].filter(Boolean));
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
    const N3 = avulso("ZZZ"); // caso 3: uma linha curada cujo número não tem credenciamento
    const N4 = avulso("ZZY"); // caso 4: a linha já ligada ao 2º credenciamento (por outro número)
    type Linha = { numero: string; credenciamento_id: string | null; nome_publico: string; cidade: string; selo: string; publicado: boolean };
    const v: { antes?: Linha; depois?: Linha; reaplicada?: number; n3?: string | null; p1?: string | null; p2?: string | null; rollback?: Linha; p1DepoisDoRollback?: string | null } = {};
    const sql = postgres(DB, { max: 1, onnotice: () => undefined });
    try {
      // Tudo numa transação desfeita no fim: semeia, corre a 0365 e o rollback de verdade, e não deixa efeito (o caso 3
      // aplica a 0365 de verdade para a tela).
      await sql
        .begin(async (tx) => {
          const linha = async (n: string) => (await tx<Linha[]>`select numero, credenciamento_id, nome_publico, cidade, selo, publicado from public.avaliadores_perfil_publico where numero = ${n}`)[0];
          await tx`insert into public.avaliadores_perfil_publico (numero, nome_publico, cidade, selo) values (${N3}, 'Sem Credenciamento', 'Curadopolis', 'Selo de prova')`;
          await tx`insert into public.avaliadores_perfil_publico (numero, nome_publico, cidade, selo, credenciamento_id) values (${N4}, 'Ja Ligada', 'Curadopolis', 'Selo de prova', ${ids.cred2})`;
          await tx`insert into public.avaliadores_perfil_publico (numero, nome_publico, cidade, selo) values (${ids.numero2}, 'Segunda do Mesmo Numero', 'Curadopolis', 'Selo de prova')`;
          v.antes = await linha(numero);
          await tx.unsafe(MIGRACAO_0365);
          v.depois = await linha(numero);
          v.reaplicada = (await tx.unsafe(MIGRACAO_0365)).count;
          v.n3 = (await linha(N3)).credenciamento_id;
          v.p1 = (await linha(N4)).credenciamento_id;
          v.p2 = (await linha(ids.numero2)).credenciamento_id;
          await tx.unsafe(ROLLBACK_0365);
          v.rollback = await linha(numero);
          v.p1DepoisDoRollback = (await linha(N4)).credenciamento_id;
          throw new Desfazer();
        })
        .catch((e) => {
          if (!(e instanceof Desfazer)) throw e;
        });
    } finally {
      await sql.end();
    }
    // 1. linha curada sem ligação + credenciamento do mesmo número → fica ligada.
    expect(v.antes?.credenciamento_id, "caso 1, antes: a linha curada sem ligação").toBeNull();
    expect(v.depois?.credenciamento_id, "caso 1: ligada ao credenciamento do mesmo número").toBe(ids.cred);
    // 2. rodar de novo → nada muda.
    expect(v.reaplicada, "caso 2: reaplicada, nenhuma linha muda").toBe(0);
    // 3. número diferente → não liga.
    expect(v.n3, "caso 3: número sem credenciamento igual não liga").toBeNull();
    // 4. credenciamento que já tem uma linha ligada → a 2ª linha com o mesmo número não é ligada.
    expect(v.p1, "caso 4: a linha já ligada continua ligada ao 2º credenciamento").toBe(ids.cred2);
    expect(v.p2, "caso 4: a 2ª linha com o número do 2º credenciamento não é ligada").toBeNull();
    // 5. rollback → desliga só a ligação por número; nome, cidade, selo e publicação ficam como estavam.
    expect(v.rollback?.credenciamento_id, "caso 5: o rollback desliga a ligação por número").toBeNull();
    expect({ nome: v.rollback?.nome_publico, cidade: v.rollback?.cidade, selo: v.rollback?.selo, publicado: v.rollback?.publicado }, "caso 5: o conteúdo curado fica").toEqual({
      nome: v.antes?.nome_publico,
      cidade: v.antes?.cidade,
      selo: v.antes?.selo,
      publicado: v.antes?.publicado,
    });
    expect(v.p1DepoisDoRollback, "caso 5: a ligação que não é por número fica").toBe(ids.cred2);
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
