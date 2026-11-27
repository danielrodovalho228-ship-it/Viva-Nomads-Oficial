import { test, expect, type Browser, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { provarA0367, type ProvaDa0367 } from "../fixtures/prova-0367";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1798 — E1225: a caução por bloco (ORDEM-DUET-1120; regra da casa: a trava que afirma comportamento é EXECUTADA num
  banco descartável).
  Parte 1 — a 0367 executada: a própria 0367, o aplicar e o rollback de produção, TAL COMO ESTÃO, corridos num banco
  descartável criado no servidor do laboratório e apagado no fim (tests/e2e/fixtures/prova-0367.ts), sobre
  pagamentos_bloco na forma de ANTES da 0367 e com a massa dos 4 contratos de teste (2 blocos com caução cada; a caução
  de antes registada no contrato pela soma). O índice único passa de "uma caução ativa por contrato" a "uma por bloco",
  e nenhuma linha que já existia muda.
  A trava que lê o texto (tests/migracoes/caucao-por-bloco-0367.test.ts) fica como complemento.
  Parte 2 — a tela do dono (/dashboard/contratos), pelos casos do coordenador, em dois contratos de 2 blocos × R$ 3.750
  com a caução de ANTES registada no contrato (sem bloco), gravada pelo laboratório (simulação declarada):
   - com R$ 7.500 registados → o 2.º bloco mostra "nada a registrar" e não há botão;
   - com R$ 3.750 registados → o 2.º bloco mostra R$ 3.750 em aberto; um registro acima do teto é recusado, dizendo o
     que falta; R$ 3.750 entram, com o bloco 2 gravado;
   - nenhuma linha que já existia muda (conferência antes/depois das linhas do contrato).
  Laboratório; não é prova ao vivo no site.
  Vizinha do E1229 (ORDENS-DUET 1143 e 1160): corre também no portão desse PR, porque a tela do contrato ganhou a
  anulação dos registros e a conferência passou a dizer 'Anulado em {data}: {motivo}'.
*/
const DB = process.env.LAB_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const MIGRACAO_0367 = readFileSync("supabase/migrations/0367_caucao_por_bloco_e1225.sql", "utf8");
const APLICAR_0367 = readFileSync("supabase/producao/aplicar-0367.sql", "utf8");
const ROLLBACK_0367 = readFileSync("supabase/producao/rollback/0367_rollback.sql", "utf8");

test.describe("T1798 — E1225: a 0367 executada (caução por bloco) @E1225", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 180_000 });

  test("a 0367, o aplicar e o rollback corridos de verdade: uma caução por bloco, as linhas de antes intactas, o rollback falha fechado", async () => {
    const p: ProvaDa0367 = await provarA0367(DB, MIGRACAO_0367, APLICAR_0367, ROLLBACK_0367);
    // Asserções brandas: o relatório nomeia TODOS os casos que uma 0367 (ou um rollback) adulterada fere.
    expect.soft(p.migracao.erro, "a 0367 aplica-se sem erro na forma de antes").toBeNull();
    expect.soft(p.migracao.linhas, "a massa: 4 contratos × (a caução de antes + 1 aluguel)").toBe(8);
    expect.soft(p.migracao.linhasDepois, "nenhuma linha que já existia muda (conferência antes/depois)").toBe(p.migracao.linhasAntes);
    expect.soft(p.reaplicar.erro, "reaplicada, sem erro").toBeNull();
    expect.soft(p.reaplicar.linhasIguais, "reaplicada, as linhas não mudam").toBe(true);
    expect.soft(p.reaplicar.indicesIguais, "reaplicada, os índices não mudam").toBe(true);
    expect.soft(p.aplicar.erro1, "o aplicar de produção aplica").toBeNull();
    expect.soft(p.aplicar.erro2, "o aplicar de produção reaplica sem erro").toBeNull();
    expect.soft(p.aplicar.registos, "regista-se uma só vez").toBe(1);
    expect.soft(p.aplicar.nome, "com o nome da migração").toBe("0367_caucao_por_bloco_e1225");
    // Por bloco.
    expect.soft(p.porBloco.erroMigracao).toBeNull();
    expect.soft(p.porBloco.bloco1, "com a caução de antes pela soma, a caução do bloco 1 entra").toBeNull();
    expect.soft(p.porBloco.bloco2, "e a do bloco 2 também (antes, o índice por contrato recusava)").toBeNull();
    expect.soft(p.porBloco.ativasNoContrato, "três cauções ativas no contrato: a de antes e uma por bloco").toBe(3);
    expect.soft(p.mesmoBloco.erroMigracao).toBeNull();
    expect.soft(p.mesmoBloco.segunda, "a 2.ª caução ativa no mesmo bloco é recusada").toMatch(/pagamentos_bloco_uma_caucao_por_bloco|duplicate key/);
    expect.soft(p.mesmoBloco.anular, "a do bloco 1 anula-se").toBeNull();
    expect.soft(p.mesmoBloco.depoisDeAnular, "o anulado não ocupa o bloco: uma nova entra").toBeNull();
    expect.soft(p.mesmoBloco.ativasNoBloco1, "uma só caução ativa no bloco 1").toBe(1);
    expect.soft(p.semBloco.erroMigracao).toBeNull();
    expect.soft(p.semBloco.segundaSemBloco, "duas cauções sem bloco no mesmo contrato: continua recusado").toMatch(/pagamentos_bloco_uma_caucao_sem_bloco|duplicate key/);
    expect.soft(p.aluguelSemBloco.erroMigracao).toBeNull();
    expect.soft(p.aluguelSemBloco.erro, "aluguel sem bloco: continua recusado").toMatch(/pagamentos_bloco_bloco_por_tipo/);
    // A política do dono.
    expect.soft(p.politica.antesDaMigracao, "antes da 0367, a caução com bloco não passava").not.toBeNull();
    expect.soft(p.politica.erroMigracao).toBeNull();
    expect.soft(p.politica.doSeuContrato, "o dono regista a caução num bloco do seu contrato").toBeNull();
    expect.soft(p.politica.deOutroContrato, "num bloco de outro contrato, a política recusa").toMatch(/row-level security|policy/);
    // Rollback.
    expect.soft(p.rollbackComDuas.erroMigracao).toBeNull();
    expect.soft(p.rollbackComDuas.erroRollback, "com duas cauções ativas no mesmo contrato, o rollback FALHA").not.toBeNull();
    expect.soft(p.rollbackComDuas.linhasIguais, "e nada muda nas linhas").toBe(true);
    expect.soft(p.rollbackComDuas.temIndicePorBloco, "o índice por bloco continua").toBe(true);
    expect.soft(p.rollbackComDuas.temIndicePorContrato, "o por contrato não volta").toBe(false);
    expect.soft(p.rollbackLimpo.erroMigracao).toBeNull();
    expect.soft(p.rollbackLimpo.erroRollback, "sem isso, o rollback corre").toBeNull();
    expect.soft(p.rollbackLimpo.linhasIguais, "as linhas ficam").toBe(true);
    expect.soft(p.rollbackLimpo.temIndicePorContrato, "volta o índice por contrato").toBe(true);
    expect.soft(p.rollbackLimpo.temIndicePorBloco, "sai o por bloco").toBe(false);
    expect.soft(p.rollbackLimpo.temIndiceSemBloco, "sai o sem bloco").toBe(false);
    expect.soft(p.rollbackLimpo.registo, "sai o registo da 0367").toBe(0);
    // ORDEM-DUET-1135: depois do rollback, a política volta a recusar a caução com bloco — a recusa vem da POLÍTICA
    // (como antes da 0367), não só do check.
    expect.soft(p.rollbackLimpo.politicaDepois, "depois do rollback, a política recusa outra vez a caução com bloco").toMatch(/row-level security/);
  });
});

const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1798.${sufixo}@lab.vivanomads.test`, nome: "Lúcia Caução Prado", role: "owner" as const };
const inq = { email: `inq.t1798.${sufixo}@lab.vivanomads.test`, nome: "Rui Caução Matos", role: "tenant" as const };
const ids: { dono?: string; inq?: string; contratos: Record<"cheio" | "metade", { id: string; b1: string; b2: string } | undefined> } = { contratos: { cheio: undefined, metade: undefined } };
const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const linhasDoContrato = async (contrato: string) =>
  JSON.stringify((await adm().from("pagamentos_bloco").select("*").eq("contrato_id", contrato).order("created_at")).data ?? []);

async function contratoComCaucaoAntiga(imovel: string, antiga: number) {
  const agora = new Date().toISOString();
  const { data: c, error } = await adm()
    .from("contratos")
    .insert({
      property_id: imovel, tenant_id: ids.inq, owner_plan: "free", faixa: "temporada", prazo_total_dias: 120, aluguel_mensal: 3750,
      tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 1800, qtd_ocupantes: 1, status: "ativo", garantia: "caucao",
      assinado_proprietario_em: agora, assinado_inquilino_em: agora,
    })
    .select("id")
    .single();
  if (error) throw error;
  const { data: bl, error: eb } = await adm()
    .from("contrato_blocos")
    .insert([
      { contrato_id: c.id, numero_bloco: 1, inicio: dia(-70), fim: dia(-11), meses: 2, valor: 7500, caucao: 3750, status: "ativo" },
      { contrato_id: c.id, numero_bloco: 2, inicio: dia(-10), fim: dia(49), meses: 2, valor: 7500, caucao: 3750, status: "ativo", aceite_proprietario_em: agora, aceite_inquilino_em: agora },
    ])
    .select("id, numero_bloco");
  if (eb) throw eb;
  // A caução de ANTES: no contrato, sem bloco (a forma dos 4 contratos de teste).
  const { error: ep } = await adm()
    .from("pagamentos_bloco")
    .insert({ bloco_id: null, contrato_id: c.id, tipo: "caucao", valor: antiga, data_pagamento: dia(-70), marcado_por: ids.dono });
  if (ep) throw ep;
  return { id: c.id as string, b1: bl!.find((b) => b.numero_bloco === 1)!.id as string, b2: bl!.find((b) => b.numero_bloco === 2)!.id as string };
}
async function abrir(browser: Browser): Promise<Page> {
  const p = await entrar(browser, dono.email, senha);
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
  await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  return p;
}
const linha = (p: Page, contrato: string, n: number) =>
  p.locator(`[data-contrato="${contrato}"]`).getByTestId("caucao-contrato").locator(`[data-testid="caucao-bloco-linha"][data-numero="${n}"]`);

test.describe("T1798 — E1225: a tela da caução por bloco, pelos casos do coordenador @E1225", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    const i1 = await criarImovelPronto(ids.dono, `Studio caução cheia ${sufixo}`, { ativo: true, preco: 3750 });
    const i2 = await criarImovelPronto(ids.dono, `Studio caução metade ${sufixo}`, { ativo: true, preco: 3750 });
    ids.contratos.cheio = await contratoComCaucaoAntiga(i1, 7500);
    ids.contratos.metade = await contratoComCaucaoAntiga(i2, 3750);
  });
  test.afterAll(async () => {
    await apagarContas([ids.inq, ids.dono].filter(Boolean) as string[]);
  });

  test("1. 2 × R$ 3.750 com R$ 7.500 registados → o 2.º bloco mostra nada a registrar, sem botão; nada muda", async ({ browser }) => {
    test.info().annotations.push({ type: "simulação", description: "contrato assinado e a caução de antes (sem bloco) gravados pelo laboratório" });
    const c = ids.contratos.cheio!;
    const antes = await linhasDoContrato(c.id);
    const p = await abrir(browser);
    await expect(linha(p, c.id, 2).getByTestId("caucao-bloco-nada")).toHaveText("Nada a registrar neste bloco: a caução já registrada cobre este bloco.");
    await expect(linha(p, c.id, 1).getByTestId("caucao-bloco-nada")).toBeVisible();
    await expect(p.locator(`[data-contrato="${c.id}"]`).getByTestId("registrar-caucao")).toHaveCount(0);
    expect(await linhasDoContrato(c.id), "nenhuma linha muda").toBe(antes);
    await p.context().close();
  });

  test("2. com R$ 3.750 registados → o 2.º bloco mostra R$ 3.750 em aberto; acima é recusado; R$ 3.750 entram com o bloco; a linha antiga não muda", async ({ browser }) => {
    const c = ids.contratos.metade!;
    const antes = await linhasDoContrato(c.id);
    const p = await abrir(browser);
    await expect(linha(p, c.id, 1).getByTestId("caucao-bloco-nada")).toBeVisible();
    const l2 = linha(p, c.id, 2);
    await expect(l2.getByTestId("caucao-bloco-aberto")).toContainText(/R\$\s?3\.750/);
    await l2.getByTestId("registrar-caucao").click();
    await l2.locator("input").first().fill("3750,01");
    await l2.getByTestId("confirmar-recebimento").click();
    await expect(l2.getByTestId("registrar-erro")).toHaveText(/^O valor é maior que a caução que falta registrar neste contrato: R\$\s3\.750\.$/u, { timeout: 20_000 });
    expect(await linhasDoContrato(c.id), "a recusa não grava nem muda nada").toBe(antes);
    await l2.locator("input").first().fill("3750");
    await l2.getByTestId("confirmar-recebimento").click();
    await expect(l2.getByTestId("caucao-bloco-status")).toContainText("Recebimento registrado", { timeout: 20_000 });
    const { data: novas } = await adm().from("pagamentos_bloco").select("bloco_id, valor").eq("contrato_id", c.id).eq("tipo", "caucao").not("bloco_id", "is", null);
    expect(novas, "a caução do 2.º bloco entra com o bloco gravado").toEqual([{ bloco_id: c.b2, valor: 3750 }]);
    const antiga = JSON.parse(antes).filter((r: { tipo: string }) => r.tipo === "caucao");
    const { data: antigaDepois } = await adm().from("pagamentos_bloco").select("*").eq("contrato_id", c.id).eq("tipo", "caucao").is("bloco_id", null);
    expect(JSON.stringify(antigaDepois), "a caução de antes não muda").toBe(JSON.stringify(antiga));
    await p.context().close();
  });
});
