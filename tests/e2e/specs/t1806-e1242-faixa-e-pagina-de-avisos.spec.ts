import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1806 — E1242 reaberto (ORDENS-DUET 1247 e 1248): a trava do E1242 passa a morder a FAIXA do painel e a PÁGINA
  completa de avisos (com o filtro "Críticos"), não só o sino. A ronda de prova das 15h de 27/11 viu ao vivo a faixa e a
  página a mostrarem como crítico vivo um aviso de assinar já resolvido.
  Um contrato assinado pelos dois. Para cada parte (dono e morador), dois avisos críticos de assinar deste contrato,
  COM a referência: um já resolvido no banco (a assinatura resolveu) e um esquecido por resolver. Para o dono, ainda um
  aviso crítico SEM referência (o caso do E1247), que tem de continuar vivo.
   1. dono, a faixa do painel: nenhum dos dois de assinar aparece; aparece só o sem referência, sem "e mais N";
   2. dono, a página completa com "Críticos": os dois de assinar não aparecem como críticos vivos (ou não aparecem, ou
      aparecem marcados "resolvido"); o sem referência continua lá, vivo;
   3. morador, a faixa: nenhum aviso crítico (os dois dele estão resolvidos na prática);
   4. morador, a página completa com "Críticos": os dois de assinar não aparecem como críticos vivos.
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
  donoSemRef: `Atualização do seu contrato — t1806 sem referência ${sufixo}`,
  inqResolvido: `Assinar o contrato — t1806 morador resolvido ${sufixo}`,
  inqEsquecido: `Assinar o contrato — t1806 morador esquecido ${sufixo}`,
};

async function abrir(browser: Browser, email: string): Promise<Page> {
  return entrar(browser, email, senha);
}

/** Na página completa com o filtro "Críticos": o aviso não está lá como crítico vivo (ausente, ou marcado "resolvido"). */
async function naoEhCriticoVivo(p: Page, titulo: string) {
  const itens = p.getByTestId("avisos-item").filter({ hasText: titulo });
  const n = await itens.count();
  for (let i = 0; i < n; i++) await expect(itens.nth(i), `"${titulo}" não é crítico vivo na página`).toContainText("resolvido");
}

async function paginaCriticos(p: Page) {
  await p.goto("/dashboard/notificacoes?prioridade=critico#avisos", { waitUntil: "domcontentloaded" });
  await expect(p.getByTestId("avisos-caixa")).toBeVisible({ timeout: 30_000 });
  await expect(p.getByTestId("avisos-filtro-critico")).toHaveAttribute("aria-pressed", "true");
}

test.describe("T1806 — E1242: a faixa e a página completa não mostram como vivo o aviso de assinar resolvido @E1242", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio faixa ${sufixo}`, { ativo: true, preco: 3200 });
    const agora = new Date().toISOString();
    const { data: c, error: ec } = await adm()
      .from("contratos")
      .insert({
        property_id: ids.imovel, tenant_id: ids.inq, owner_plan: "free", faixa: "temporada", prazo_total_dias: 120, aluguel_mensal: 3200,
        tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 1536, qtd_ocupantes: 1, status: "ativo", garantia: "caucao",
        assinado_proprietario_em: agora, assinado_inquilino_em: agora,
      })
      .select("id")
      .single();
    if (ec) throw ec;
    ids.contrato = c.id as string;
    const base = { evento: "contract_status", prioridade: "critico" };
    const linhas = [
      // Os de assinar mais recentes primeiro: se algum vazar, é ele que a faixa mostra.
      { chave: "donoResolvido", usuario_id: ids.dono, titulo: T.donoResolvido, url: `/dashboard/contratos/${ids.contrato}`, ref_id: ids.contrato, criado_em: horas(1), resolvido_em: horas(0.5) },
      { chave: "donoEsquecido", usuario_id: ids.dono, titulo: T.donoEsquecido, url: `/dashboard/contratos/${ids.contrato}`, ref_id: ids.contrato, criado_em: horas(2), resolvido_em: null },
      { chave: "donoSemRef", usuario_id: ids.dono, titulo: T.donoSemRef, url: `/dashboard/contratos/${ids.contrato}`, ref_id: null, criado_em: horas(5), resolvido_em: null },
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
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await apagarContas([ids.inq, ids.dono]);
  });

  test("1. dono, a faixa do painel: só o aviso sem referência, sem 'e mais N' — os de assinar resolvidos não aparecem", async ({ browser }) => {
    const p = await abrir(browser, dono.email);
    await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const faixa = p.getByTestId("faixa-critico");
    await expect(faixa, "a faixa mostra o crítico vivo (o sem referência)").toContainText(T.donoSemRef, { timeout: 30_000 });
    await expect(faixa, "o de assinar já resolvido não é a faixa").not.toContainText(T.donoResolvido);
    await expect(faixa, "o de assinar esquecido (contrato assinado) não é a faixa").not.toContainText(T.donoEsquecido);
    await expect(p.getByTestId("faixa-critico-mais"), "nenhum outro crítico vivo além do sem referência").toHaveCount(0);
    await p.context().close();
  });

  test("2. dono, a página completa com 'Críticos': os de assinar não são críticos vivos; o sem referência continua vivo", async ({ browser }) => {
    const p = await abrir(browser, dono.email);
    await paginaCriticos(p);
    const semRef = p.getByTestId("avisos-item").filter({ hasText: T.donoSemRef });
    await expect(semRef, "o sem referência continua na página").toHaveCount(1, { timeout: 30_000 });
    await expect(semRef, "o sem referência continua vivo").not.toContainText("resolvido");
    await naoEhCriticoVivo(p, T.donoResolvido);
    await naoEhCriticoVivo(p, T.donoEsquecido);
    await p.context().close();
  });

  test("3. morador, a faixa: nenhum aviso crítico (os dois de assinar estão resolvidos na prática)", async ({ browser }) => {
    const p = await abrir(browser, inq.email);
    await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(p.locator("main, body").first()).toBeVisible({ timeout: 30_000 });
    // Dá tempo à faixa (cliente) de ler a API antes de afirmar a ausência.
    await p.waitForResponse((r) => r.url().includes("/api/painel/avisos"), { timeout: 30_000 }).catch(() => undefined);
    await expect(p.getByTestId("faixa-critico").filter({ hasText: T.inqResolvido }), "o resolvido não é a faixa").toHaveCount(0);
    await expect(p.getByTestId("faixa-critico").filter({ hasText: T.inqEsquecido }), "o esquecido não é a faixa").toHaveCount(0);
    await p.context().close();
  });

  test("4. morador, a página completa com 'Críticos': os dois de assinar não são críticos vivos", async ({ browser }) => {
    const p = await abrir(browser, inq.email);
    await paginaCriticos(p);
    await naoEhCriticoVivo(p, T.inqResolvido);
    await naoEhCriticoVivo(p, T.inqEsquecido);
    await p.context().close();
  });
});
