import { test, expect, type Browser } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2154 — E690 @E690: ativação AUTOMÁTICA do avaliador credenciado, atrás da chave de build
  NEXT_PUBLIC_AVALIADOR_ATIVACAO_AUTOMATICA_ATIVA (inlinada no build: só roda no job do laboratório que constrói com as
  chaves ligadas e filtra @chave-build).
  Regra decidida (E690; unitário src/lib/vistoria/e690-ativacao-automatica.test.ts): com a chave ligada, o pedido de
  credenciamento (pedirCredenciamento, src/lib/vistoria/actions.ts) chama tentarAtivacaoAutomatica; "solicitado" → "em_teste"
  sozinho quando TODOS os critérios batem (identidade verificada, CPF titular/sócio do CNPJ, experiência, código de conduta,
  cidade), gravando decidido_pelo_sistema = true, decidido_por = null, motivo "Decidido pelo sistema…" e criterios_decisao
  (0335); faltando um critério, nada avança e o pedido fica para o admin.
  A prova: dois candidatos de conta de teste (is_teste: identidade e CPF do sócio simulados) pedem o credenciamento PELA
  TELA /dashboard/parceiro/avaliacao. 1) com a identidade já verificada (laudo simulado do laboratório), o pedido nasce
  "Em teste", decidido pelo sistema, com os critérios gravados, parceiro ativado e a avaliação de teste na fila do admin;
  2) sem a identidade, fica "Em análise" (solicitado), decidido_pelo_sistema = false e sem critérios.
  Fora daqui: a massa de produção da 0331 (UDI-002) só é provável ao vivo, em produção. O passo "em_teste" → "ativo"
  (laudo de teste emitido) e o gatilho da verificação de identidade (/api/caf/verify) não são cobertos aqui.
*/
test.describe("T2154 — E690: ativação automática do avaliador @E690 @chave-build", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.skip(process.env.NEXT_PUBLIC_AVALIADOR_ATIVACAO_AUTOMATICA_ATIVA !== "on", "Só no job do laboratório com as chaves de build ligadas.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const completo = { email: `avc.t2154.${sufixo}@lab.vivanomads.test`, nome: "Clara Completa Teste", role: "tenant" as const };
  const semIdent = { email: `avs.t2154.${sufixo}@lab.vivanomads.test`, nome: "Sérgio Sem Identidade", role: "tenant" as const };
  const ids: Record<string, string> = {};

  type Cred = { id: string; status: string; parceiro_id: string | null; decidido_por: string | null; decidido_em: string | null; motivo: string | null; decidido_pelo_sistema: boolean; criterios_decisao: Record<string, unknown> | null };
  const cred = async (userId: string) =>
    (await adm().from("avaliadores_credenciamento").select("id, status, parceiro_id, decidido_por, decidido_em, motivo, decidido_pelo_sistema, criterios_decisao").eq("user_id", userId).maybeSingle()).data as Cred | null;

  /** O pedido único pela tela (quem ainda não é parceiro manda os dados de parceiro no mesmo formulário). */
  async function pedirPelaTela(browser: Browser, email: string, nome: string, slug: string) {
    const p = await entrar(browser, email, senha);
    await p.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    const form = p.getByTestId("credenciamento-form");
    await expect(form).toBeVisible({ timeout: 30_000 });
    await form.getByLabel(/Nome público/).fill(nome);
    await form.getByLabel("CNPJ", { exact: true }).fill(cnpjAleatorio());
    await form.getByLabel("Cidade onde vai avaliar").fill("Uberlândia");
    await form.getByLabel(/Portfólio ou referência/).fill(`https://portfolio.lab.vivanomads.test/${slug}`);
    await form.getByLabel(/Li e aceito o código de conduta/).check();
    await form.getByTestId("credenciamento-enviar").click();
    return p;
  }

  test.beforeAll(async () => {
    ids.completo = await criarConta(completo, senha);
    ids.semIdent = await criarConta(semIdent, senha);
    // Contas de teste: a identidade e o CPF do titular/sócio do CNPJ são simulados (conta real: CPF "não conferível").
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.completo, ids.semIdent]);
    // Só o primeiro já verificou a identidade (o mesmo laudo simulado que /api/caf/verify grava para conta de teste).
    const { error } = await adm()
      .from("tenant_verifications")
      .insert({ tenant_id: ids.completo, caf_result: { identity: true, document: true, liveness: true, light: "green", simulado: true }, traffic_light: null, valid_until: new Date(Date.now() + 365 * 86_400_000).toISOString() });
    if (error) throw error;
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    const users = [ids.completo, ids.semIdent].filter(Boolean);
    const credIds = (((await adm().from("avaliadores_credenciamento").select("id").in("user_id", users)).data ?? []) as { id: string }[]).map((x) => x.id);
    if (credIds.length) await adm().from("vistoria_fila_admin").delete().in("avaliador_id", credIds);
    await adm().from("avaliadores_credenciamento").delete().in("user_id", users);
    await adm().from("parceiros").delete().in("user_id", users);
    await adm().from("parceiro_solicitacoes").delete().in("user_id", users);
    await adm().from("tenant_verifications").delete().in("tenant_id", users);
    await apagarContas(users);
  });

  test("1. todos os critérios batem: o pedido já nasce 'Em teste', decidido pelo sistema, com os critérios gravados", async ({ browser }) => {
    const p = await pedirPelaTela(browser, completo.email, completo.nome, "clara");
    await expect.poll(async () => (await cred(ids.completo))?.status ?? "", { timeout: 20_000 }).toBe("em_teste");
    const c = (await cred(ids.completo))!;
    expect(c.decidido_pelo_sistema).toBe(true);
    expect(c.decidido_por).toBeNull();
    expect(c.decidido_em).not.toBeNull();
    expect(c.motivo ?? "").toMatch(/^Decidido pelo sistema em \d{4}-\d{2}-\d{2} \(aprovação automática para teste\)/);
    expect(c.motivo ?? "").toContain("identidade verificada (simulada, conta de teste)");
    expect(c.criterios_decisao).toMatchObject({
      etapa: "em_teste",
      identidadeVerificada: true,
      cpfTitularOuSocio: true,
      experiencia: true,
      condutaAceita: true,
      cidade: true,
      fontes: { identidade: "simulada", cpf: "simulada" },
    });
    // A mesma aprovação do admin: parceiro ativado (em rascunho) e a avaliação de teste na fila do admin.
    expect(c.parceiro_id).not.toBeNull();
    const { data: parc } = await adm().from("parceiros").select("status").eq("id", c.parceiro_id!).single();
    expect(parc!.status).toBe("rascunho");
    const { data: fila } = await adm().from("vistoria_fila_admin").select("id").eq("avaliador_id", c.id).eq("tipo", "avaliacao_teste").is("resolvido_em", null);
    expect(fila ?? []).toHaveLength(1);
    // O candidato vê "Em teste" sem passar pelo admin.
    await p.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("credenciamento-situacao")).toHaveAttribute("data-status", "em_teste", { timeout: 30_000 });
    await expect(p.getByTestId("credenciamento-estado")).toHaveText("Em teste");
    await p.context().close();
  });

  test("2. falta a identidade: o pedido fica 'Em análise' para o admin, sem decisão do sistema", async ({ browser }) => {
    const p = await pedirPelaTela(browser, semIdent.email, semIdent.nome, "sergio");
    await expect.poll(async () => (await cred(ids.semIdent))?.status ?? "", { timeout: 20_000 }).toBe("solicitado");
    const c = (await cred(ids.semIdent))!;
    expect(c.decidido_pelo_sistema).toBe(false);
    expect(c.criterios_decisao).toBeNull();
    expect(c.decidido_em).toBeNull();
    expect(c.parceiro_id).toBeNull();
    const { data: fila } = await adm().from("vistoria_fila_admin").select("id").eq("avaliador_id", c.id).eq("tipo", "avaliacao_teste");
    expect(fila ?? []).toHaveLength(0);
    await p.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("credenciamento-situacao")).toHaveAttribute("data-status", "solicitado", { timeout: 30_000 });
    await expect(p.getByTestId("credenciamento-estado")).toHaveText("Em análise");
    await p.context().close();
  });
});
