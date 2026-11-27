import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1804 (número provisório) — E1242 (ORDENS-DUET 1213, 1220 e 1224): o aviso "Assinar o contrato" já resolvido sai do
  sino, e a rede do sino grava o que conferiu — só para avisos COM referência.
   1. contrato assinado pelos dois: o aviso crítico já resolvido (a assinatura resolveu) e um esquecido por resolver,
      com a referência do contrato, saem do sino e da contagem; o esquecido fica gravado como resolvido no banco;
   2. TRAVA (ORDEM-1224): um aviso contract_status SEM referência, com o contrato assinado no endereço (o caso do E1247),
      NÃO é resolvido pela rede — continua por resolver no banco e no sino;
   3. guarda: o contrato que só o dono assinou — o crítico do morador continua no sino e na faixa, por resolver.
  Simulação declarada: contratos, assinaturas e avisos gravados pelo laboratório; a leitura é a da API do sino, com a
  sessão de cada um. Laboratório; não é prova ao vivo no site.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1804.${sufixo}@lab.vivanomads.test`, nome: "Rui Sino Prado", role: "owner" as const };
const inq = { email: `inq.t1804.${sufixo}@lab.vivanomads.test`, nome: "Lia Sino Mota", role: "tenant" as const };
const ids: Record<string, string | undefined> = {};
const horas = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

type Sino = { naoLidas: number; recentes: { id: string }[]; criticos: { id: string }[] };
async function abrir(browser: Browser, email: string): Promise<Page> {
  return entrar(browser, email, senha);
}
async function lerSino(page: Page): Promise<Sino> {
  const r = await page.request.get("/api/painel/avisos");
  expect(r.ok(), "a API do sino responde").toBe(true);
  return (await r.json()) as Sino;
}
const resolvidoEm = async (id: string) => ((await adm().from("avisos").select("resolvido_em").eq("id", id).single()).data as { resolvido_em: string | null }).resolvido_em;

async function contrato(assinadoInq: boolean): Promise<string> {
  const agora = new Date().toISOString();
  const { data, error } = await adm()
    .from("contratos")
    .insert({
      property_id: ids.imovel, tenant_id: ids.inq, owner_plan: "free", faixa: "temporada", prazo_total_dias: 120, aluguel_mensal: 3200,
      tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 1536, qtd_ocupantes: 1, status: "ativo", garantia: "caucao",
      assinado_proprietario_em: agora, assinado_inquilino_em: assinadoInq ? agora : null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

test.describe("T1804 — E1242: o aviso de assinar resolvido sai do sino; a rede só com referência @E1242", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio sino ${sufixo}`, { ativo: true, preco: 3200 });
    ids.assinado = await contrato(true);
    ids.meio = await contrato(false);
    const titulo = `Assinar o contrato — Studio sino ${sufixo}`;
    const linhas = [
      { chave: "jaResolvido", usuario_id: ids.dono, evento: "contract_status", prioridade: "critico", titulo, url: `/dashboard/contratos/${ids.assinado}`, ref_id: ids.assinado, criado_em: horas(5), resolvido_em: horas(1) },
      { chave: "esquecido", usuario_id: ids.dono, evento: "contract_status", prioridade: "critico", titulo: `${titulo} (renovado)`, url: `/dashboard/contratos/${ids.assinado}`, ref_id: ids.assinado, criado_em: horas(4) },
      { chave: "semRef", usuario_id: ids.dono, evento: "contract_status", prioridade: "critico", titulo: "Atualização do seu contrato", url: `/dashboard/contratos/${ids.assinado}`, ref_id: null, criado_em: horas(3) },
      { chave: "faltaMorador", usuario_id: ids.inq, evento: "contract_status", prioridade: "critico", titulo, url: `/dashboard/estadia/${ids.meio}`, ref_id: ids.meio, criado_em: horas(2) },
    ];
    for (const { chave, ...l } of linhas) {
      const { data, error } = await adm().from("avisos").insert({ resolvido_em: null, ...l }).select("id").single();
      if (error) throw error;
      ids[chave] = data.id as string;
    }
  });
  test.afterAll(async () => {
    await adm().from("avisos").delete().in("usuario_id", [ids.dono!, ids.inq!].filter(Boolean));
    if (ids.assinado || ids.meio) await adm().from("contratos").delete().in("id", [ids.assinado!, ids.meio!].filter(Boolean));
    await apagarContas([ids.inq, ids.dono]);
  });

  test("1 e 2. dono: o resolvido e o esquecido com referência saem do sino (o esquecido fica gravado); o sem referência fica", async ({ browser }) => {
    const p = await abrir(browser, dono.email);
    // As não lidas do banco ANTES da leitura (a conta pode ter outros avisos, como as boas-vindas).
    const { count: naoLidasNoBanco } = await adm().from("avisos").select("id", { count: "exact", head: true }).eq("usuario_id", ids.dono!).is("lido_em", null);
    const s = await lerSino(p);
    const recentes = s.recentes.map((a) => a.id);
    expect(recentes, "o já resolvido sai do sino").not.toContain(ids.jaResolvido);
    expect(recentes, "o esquecido com referência sai do sino").not.toContain(ids.esquecido);
    expect(recentes, "TRAVA: o sem referência continua no sino").toContain(ids.semRef);
    expect(s.naoLidas, "o resolvido e o esquecido deixam de contar; o sem referência conta").toBe((naoLidasNoBanco ?? 0) - 2);
    await expect.poll(() => resolvidoEm(ids.esquecido!), { timeout: 15_000, message: "a rede grava o conferido com referência" }).not.toBeNull();
    expect(await resolvidoEm(ids.semRef!), "TRAVA (ORDEM-1224): o sem referência NÃO é resolvido pela rede").toBeNull();
    // Segunda leitura: nada muda (o gravado não volta, o sem referência continua por resolver).
    const s2 = await lerSino(p);
    expect(s2.recentes.map((a) => a.id)).not.toContain(ids.esquecido);
    expect(await resolvidoEm(ids.semRef!)).toBeNull();
    await p.context().close();
  });

  test("3. guarda: só o dono assinou — o crítico do morador continua no sino e na faixa, por resolver", async ({ browser }) => {
    const p = await abrir(browser, inq.email);
    const s = await lerSino(p);
    expect(s.recentes.map((a) => a.id)).toContain(ids.faltaMorador);
    expect(s.criticos.map((a) => a.id)).toContain(ids.faltaMorador);
    expect(await resolvidoEm(ids.faltaMorador!)).toBeNull();
    await p.context().close();
  });
});
