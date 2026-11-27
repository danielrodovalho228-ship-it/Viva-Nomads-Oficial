import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1806 — E1242 reaberto (ORDENS-DUET 1247 e 1248): a trava do E1242 passa a morder a FAIXA do painel e a PÁGINA
  completa de avisos (com o filtro "Críticos"), não só o sino. A ronda de prova das 15h de 27/11 viu ao vivo a faixa e a
  página a mostrarem como crítico vivo um aviso de assinar já resolvido.
  Um contrato assinado pelos dois. Para cada parte (dono e morador), dois avisos críticos de assinar deste contrato,
  COM a referência: um já semeado RESOLVIDO no banco (o estado que a assinatura deixa — o caso da ronda das 15h, ORDEM-
  DUET 1256) e um esquecido por resolver (a rede do sino resolve-o na 1.ª leitura). O controlo: um 2.º
  contrato que nenhum dos dois assinou, com o aviso crítico de assinar de cada um — esse é vivo e tem de aparecer.
   1. dono, a faixa do painel: mostra só o vivo (o do contrato por assinar), sem "e mais N" — os de assinar resolvidos
      não aparecem;
   2. dono, a página completa: os dois de assinar resolvidos NÃO aparecem — nem em "Críticos", nem em "Todos" (onde
      apareciam "Não lido" com o selo "Crítico"); o vivo continua lá, sem "resolvido";
   3. morador, a faixa: o mesmo que o dono;
   4. morador, a página completa: o mesmo que o dono.
  Simulação declarada: contrato, assinaturas e avisos gravados pelo laboratório; a leitura é a das telas, com a sessão
  de cada um. Laboratório; não é prova ao vivo no site.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1806.${sufixo}@lab.vivanomads.test`, nome: "Rita Faixa Prado", role: "owner" as const };
const inq = { email: `inq.t1806.${sufixo}@lab.vivanomads.test`, nome: "Ivo Faixa Mota", role: "tenant" as const };
const ids: Record<string, string | undefined> = {};
const horas = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const T = {
  donoResolvido: `Assinar o contrato — t1806 dono resolvido ${sufixo}`,
  donoEsquecido: `Assinar o contrato — t1806 dono esquecido ${sufixo}`,
  donoVivo: `Assinar o contrato — t1806 dono por assinar ${sufixo}`,
  inqVivo: `Assinar o contrato — t1806 morador por assinar ${sufixo}`,
  inqResolvido: `Assinar o contrato — t1806 morador resolvido ${sufixo}`,
  inqEsquecido: `Assinar o contrato — t1806 morador esquecido ${sufixo}`,
};

async function abrir(browser: Browser, email: string): Promise<Page> {
  return entrar(browser, email, senha);
}

/**
 * Na página completa (ORDEM-DUET 1247, a regra única do sino): o aviso resolvido NÃO aparece — nem no filtro
 * "Críticos", nem em "Todos" (onde apareceria "Não lido" com o selo "Crítico", o caso da ronda das 15h).
 */
async function naoAparece(p: Page, titulo: string) {
  await expect(p.getByTestId("avisos-item").filter({ hasText: titulo }), `"${titulo}" não aparece em "Críticos"`).toHaveCount(0);
  await p.getByTestId("avisos-filtro-todos").click();
  await expect(p.getByTestId("avisos-filtro-todos")).toHaveAttribute("aria-pressed", "true");
  await expect(p.getByTestId("avisos-item").filter({ hasText: titulo }), `"${titulo}" não aparece em "Todos"`).toHaveCount(0);
  await p.getByTestId("avisos-filtro-critico").click();
}

async function paginaCriticos(p: Page) {
  await p.goto("/dashboard/notificacoes?prioridade=critico#avisos", { waitUntil: "domcontentloaded" });
  await expect(p.getByTestId("avisos-caixa")).toBeVisible({ timeout: 30_000 });
  await expect(p.getByTestId("avisos-filtro-critico")).toHaveAttribute("aria-pressed", "true");
}

test.describe("T1806 — E1242: a faixa e a página completa não mostram o aviso de assinar resolvido @E1242", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio faixa ${sufixo}`, { ativo: true, preco: 3200 });
    const agora = new Date().toISOString();
    const contrato = async (assinado: boolean) => {
      const { data: c, error: ec } = await adm()
        .from("contratos")
        .insert({
          property_id: ids.imovel, tenant_id: ids.inq, owner_plan: "free", faixa: "temporada", prazo_total_dias: 120, aluguel_mensal: 3200,
          tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 1536, qtd_ocupantes: 1, status: "ativo", garantia: "caucao",
          assinado_proprietario_em: assinado ? agora : null, assinado_inquilino_em: assinado ? agora : null,
        })
        .select("id")
        .single();
      if (ec) throw ec;
      return c.id as string;
    };
    ids.contrato = await contrato(true);
    ids.porAssinar = await contrato(false);
    const base = { evento: "contract_status", prioridade: "critico" };
    const linhas = [
      // Os de assinar mais recentes primeiro: se algum vazar, é ele que a faixa mostra.
      { chave: "donoResolvido", usuario_id: ids.dono, titulo: T.donoResolvido, url: `/dashboard/contratos/${ids.contrato}`, ref_id: ids.contrato, criado_em: horas(1), resolvido_em: horas(0.5) },
      { chave: "donoEsquecido", usuario_id: ids.dono, titulo: T.donoEsquecido, url: `/dashboard/contratos/${ids.contrato}`, ref_id: ids.contrato, criado_em: horas(2), resolvido_em: null },
      { chave: "donoVivo", usuario_id: ids.dono, titulo: T.donoVivo, url: `/dashboard/contratos/${ids.porAssinar}`, ref_id: ids.porAssinar, criado_em: horas(5), resolvido_em: null },
      { chave: "inqVivo", usuario_id: ids.inq, titulo: T.inqVivo, url: `/dashboard/estadia/${ids.porAssinar}`, ref_id: ids.porAssinar, criado_em: horas(5), resolvido_em: null },
      { chave: "inqResolvido", usuario_id: ids.inq, titulo: T.inqResolvido, url: `/dashboard/estadia/${ids.contrato}`, ref_id: ids.contrato, criado_em: horas(1), resolvido_em: horas(0.5) },
      { chave: "inqEsquecido", usuario_id: ids.inq, titulo: T.inqEsquecido, url: `/dashboard/estadia/${ids.contrato}`, ref_id: ids.contrato, criado_em: horas(2), resolvido_em: null },
    ];
    for (const { chave, ...l } of linhas) {
      const { data, error } = await adm().from("avisos").insert({ ...base, ...l }).select("id").single();
      if (error) throw error;
      ids[chave] = data.id as string;
    }
  });
  test.afterAll(async () => {
    await adm().from("avisos").delete().in("usuario_id", [ids.dono!, ids.inq!].filter(Boolean));
    const cts = [ids.contrato, ids.porAssinar].filter((x): x is string => !!x);
    if (cts.length) await adm().from("contratos").delete().in("id", cts);
    await apagarContas([ids.inq, ids.dono]);
  });

  async function faixaSoComOVivo(p: Page, vivo: string, resolvidos: string[]) {
    await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const faixa = p.getByTestId("faixa-critico");
    await expect(faixa, "a faixa mostra o crítico vivo (o do contrato por assinar)").toContainText(vivo, { timeout: 30_000 });
    for (const t of resolvidos) await expect(faixa, `"${t}" não é a faixa`).not.toContainText(t);
    await expect(p.getByTestId("faixa-critico-mais"), "nenhum outro crítico vivo além do controlo").toHaveCount(0);
  }
  async function paginaSoComOVivo(p: Page, vivo: string, resolvidos: string[]) {
    await paginaCriticos(p);
    const v = p.getByTestId("avisos-item").filter({ hasText: vivo });
    await expect(v, "o vivo está na página com 'Críticos'").toHaveCount(1, { timeout: 30_000 });
    await expect(v, "o vivo não aparece como resolvido").not.toContainText("resolvido");
    for (const t of resolvidos) await naoAparece(p, t);
  }

  test("1. dono, a faixa do painel: só o vivo, sem 'e mais N' — os de assinar resolvidos não aparecem", async ({ browser }) => {
    const p = await abrir(browser, dono.email);
    await faixaSoComOVivo(p, T.donoVivo, [T.donoResolvido, T.donoEsquecido]);
    await p.context().close();
  });

  test("2. dono, a página completa: os de assinar resolvidos não aparecem (nem em 'Críticos', nem em 'Todos'); o vivo continua", async ({ browser }) => {
    const p = await abrir(browser, dono.email);
    await paginaSoComOVivo(p, T.donoVivo, [T.donoResolvido, T.donoEsquecido]);
    await p.context().close();
  });

  test("3. morador, a faixa: só o vivo, sem 'e mais N'", async ({ browser }) => {
    const p = await abrir(browser, inq.email);
    await faixaSoComOVivo(p, T.inqVivo, [T.inqResolvido, T.inqEsquecido]);
    await p.context().close();
  });

  test("4. morador, a página completa: os de assinar resolvidos não aparecem (nem em 'Críticos', nem em 'Todos'); o vivo continua", async ({ browser }) => {
    const p = await abrir(browser, inq.email);
    await paginaSoComOVivo(p, T.inqVivo, [T.inqResolvido, T.inqEsquecido]);
    await p.context().close();
  });
});
