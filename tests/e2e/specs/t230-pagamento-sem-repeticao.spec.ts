import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T230 — Complemento do #884 (prova em produção, 19/10), 390 e 1280 px:
   1. clique duplo / dois envios do mesmo registro → 1 pagamento só; registrar a Caução de novo → "Este recebimento
      já foi registrado"; o bloco 2 aceita um pagamento de valor mensal e recusa o segundo (índice único, 0182);
   2. a Caução é do contrato: item próprio "Caução do contrato — R$ 6.400", gravada sem bloco, nas duas telas;
   3. documento anulado aparece com o selo "Anulado: registro em duplicidade" para as duas partes, o PDF continua
      acessível e ele não volta para a fila;
   4. o e-mail e o documento mostram o contrato como "VN-CT-…".
*/
const SAIDA = "tests/laboratorio/saida";
const RESEND = process.env.LAB_RESEND_URL ?? "http://127.0.0.1:3999";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t230.${sufixo}@lab.vivanomads.test`, nome: "Helena Registro Costa", role: "owner" as const };
const inq = { email: `inq.t230.${sufixo}@lab.vivanomads.test`, nome: "Otávio Registro Reis", role: "tenant" as const };
const ids: Record<string, string | undefined> = {};
const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function abrir(browser: Browser, email: string, largura: number): Promise<Page> {
  const p = await entrar(browser, email, senha);
  await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  return p;
}
const contar = async (filtro: Record<string, string>) => {
  let q = adm().from("pagamentos_bloco").select("id").is("anulado_em", null);
  for (const [k, v] of Object.entries(filtro)) q = q.eq(k, v);
  return ((await q).data ?? []).length;
};

test.describe("T230 — pagamento sem repetição + Caução do contrato + VN-CT", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio registro ${sufixo}`, { ativo: true, preco: 3200 });
    const agora = new Date().toISOString();
    const { data, error } = await adm()
      .from("contratos")
      .insert({
        property_id: ids.imovel, tenant_id: ids.inq, owner_plan: "free", faixa: "temporada", prazo_total_dias: 120, aluguel_mensal: 3200,
        tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 1536, qtd_ocupantes: 1, status: "ativo", garantia: "caucao",
        assinado_proprietario_em: agora, assinado_inquilino_em: agora,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    ids.contrato = data!.id as string;
    // Dois blocos já em vigência (o registro abre em bloco iniciado); Caução total = 3.200 + 3.200 = 6.400.
    const { data: bl, error: eB } = await adm()
      .from("contrato_blocos")
      .insert([
        { contrato_id: ids.contrato, numero_bloco: 1, inicio: dia(-70), fim: dia(-11), meses: 2, valor: 6400, caucao: 3200, status: "ativo" },
        { contrato_id: ids.contrato, numero_bloco: 2, inicio: dia(-10), fim: dia(49), meses: 2, valor: 6400, caucao: 3200, status: "ativo", aceite_proprietario_em: agora, aceite_inquilino_em: agora },
      ])
      .select("id, numero_bloco");
    expect(eB).toBeNull();
    ids.b1 = bl!.find((b) => b.numero_bloco === 1)!.id as string;
    ids.b2 = bl!.find((b) => b.numero_bloco === 2)!.id as string;
  });

  test.afterAll(async () => {
    if (ids.contrato) {
      const { data: pgs } = await adm().from("pagamentos_bloco").select("id").eq("contrato_id", ids.contrato);
      const pids = ((pgs ?? []) as { id: string }[]).map((p) => p.id);
      if (pids.length) await adm().from("documentos_falhas").delete().in("pagamento_id", pids);
    }
    await adm().from("emails_teste").delete().in("usuario_id", [ids.dono!, ids.inq!]);
    await apagarContas([ids.inq, ids.dono]);
  });

  test("1. 1280 — Caução do contrato: clique duplo grava 1; a 2ª aba recebe 'já foi registrado'", async ({ browser }) => {
    test.setTimeout(120_000);
    const a = await abrir(browser, dono.email, 1280);
    const b = await abrir(browser, dono.email, 1280);
    for (const p of [a, b]) await p.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    const caucao = a.getByTestId("caucao-contrato");
    await expect(caucao.getByTestId("caucao-contrato-rotulo")).toHaveText(/Caução do contrato — R\$\s?6\.400/);
    await expect(a.locator("main")).not.toContainText(/Caução do bloco|Caução \(50%\)/);
    // A 2ª aba deixa o formulário aberto (ainda não sabe do registro).
    await b.getByTestId("registrar-caucao").click();
    await a.getByTestId("registrar-caucao").click();
    // Clique duplo no mesmo instante: o 2º é barrado antes de sair.
    await a.getByTestId("confirmar-recebimento").evaluate((el: HTMLElement) => {
      el.click();
      el.click();
    });
    await expect(caucao.getByTestId("recebimento-registrado")).toContainText("Caução registrada", { timeout: 20_000 });
    expect(await contar({ contrato_id: ids.contrato!, tipo: "caucao" })).toBe(1);
    const { data: c } = await adm().from("pagamentos_bloco").select("bloco_id").eq("contrato_id", ids.contrato!).eq("tipo", "caucao").single();
    expect(c!.bloco_id, "a Caução é do contrato: sem bloco").toBeNull();
    // A outra aba manda o mesmo registro: o banco recusa e a tela explica, sem erro técnico.
    await b.getByTestId("confirmar-recebimento").click();
    await expect(b.getByTestId("recebimento-registrado")).toHaveText(/Este recebimento já foi registrado/, { timeout: 20_000 });
    expect(await contar({ contrato_id: ids.contrato!, tipo: "caucao" })).toBe(1);
    await a.screenshot({ path: `${SAIDA}/t230-caucao-contrato-1280.png`, fullPage: true });
    await a.context().close();
    await b.context().close();
  });

  test("2. 390 — o bloco 2 aceita um pagamento de valor mensal e recusa o segundo", async ({ browser }) => {
    test.setTimeout(120_000);
    const a = await abrir(browser, dono.email, 390);
    const b = await abrir(browser, dono.email, 390);
    for (const p of [a, b]) await p.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    // Bloco 1 primeiro (para o bloco 2 ser o 2º botão nas duas abas), depois o bloco 2 em duas abas.
    await a.getByTestId("registrar-recebimento").nth(1).click();
    await b.getByTestId("registrar-recebimento").nth(1).click();
    await a.getByTestId("confirmar-recebimento").click();
    await expect.poll(() => contar({ bloco_id: ids.b2!, tipo: "aluguel" }), { timeout: 20_000 }).toBe(1);
    await expect(a.getByText(/Valor do bloco registrado como recebido|Recebimento registrado/).first()).toBeVisible({ timeout: 20_000 });
    await b.getByTestId("confirmar-recebimento").click();
    await expect(b.getByTestId("recebimento-registrado")).toHaveText(/Este recebimento já foi registrado/, { timeout: 20_000 });
    expect(await contar({ bloco_id: ids.b2!, tipo: "aluguel" })).toBe(1);
    // E direto no banco: dois envios simultâneos → só um entra.
    const linha = { contrato_id: ids.contrato, bloco_id: ids.b1, tipo: "aluguel", valor: 6400, forma: "pix", data_pagamento: dia(0), marcado_por: ids.dono };
    const r = await Promise.all([adm().from("pagamentos_bloco").insert(linha), adm().from("pagamentos_bloco").insert(linha)]);
    expect(r.filter((x) => !x.error)).toHaveLength(1);
    expect(r.find((x) => x.error)!.error!.code).toBe("23505");
    expect(await contar({ bloco_id: ids.b1!, tipo: "aluguel" })).toBe(1);
    expect(await a.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await a.screenshot({ path: `${SAIDA}/t230-bloco2-390.png`, fullPage: true });
    await a.context().close();
    await b.context().close();
  });

  test("3. 1280 + 390 — comprovante com VN-CT; documento anulado com selo, PDF acessível e fora da fila", async ({ browser }) => {
    test.setTimeout(180_000);
    const ref = `VN-CT-${ids.contrato!.slice(0, 8).toUpperCase()}`;
    const t = await abrir(browser, inq.email, 390);
    await t.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
    const confirmar = t.getByTestId("confirmar-pagamentos");
    await expect(confirmar).toContainText(/Caução do contrato — R\$\s?6\.400/);
    // Confirma tudo o que o proprietário registrou (Caução + bloco 2 + bloco 1).
    for (let i = 0; i < 3; i++) {
      const botao = confirmar.getByRole("button", { name: /Confirmar/ }).first();
      if (!(await botao.isVisible().catch(() => false))) break;
      await botao.click();
      await t.waitForTimeout(800);
    }
    const { data: cau } = await adm().from("pagamentos_bloco").select("id").eq("contrato_id", ids.contrato!).eq("tipo", "caucao").single();
    ids.cau = cau!.id as string;
    await expect.poll(async () => (await adm().from("documentos_fiscais").select("numero").eq("pagamento_id", ids.cau!).maybeSingle()).data?.numero ?? null, { timeout: 45_000 }).not.toBeNull();
    const { data: doc } = await adm().from("documentos_fiscais").select("id, numero, contrato_ref").eq("pagamento_id", ids.cau!).single();
    expect(doc!.contrato_ref).toBe(ref);
    // E-mail (Resend falso + caixa de teste): o contrato aparece como VN-CT-….
    await expect.poll(async () => (await adm().from("emails_teste").select("corpo").eq("usuario_id", ids.inq!).ilike("assunto", `%${doc!.numero}%`)).data?.[0]?.corpo ?? "", { timeout: 30_000 }).toContain(ref);
    const r = await fetch(`${RESEND}/__emails`).then((x) => x.json()).catch(() => null);
    // O Resend falso guarda só o assunto e os anexos (sem o corpo): o e-mail com o documento foi aceito.
    if (Array.isArray(r)) expect(r.some((e: { assunto?: string }) => String(e.assunto ?? "").includes(doc!.numero as string))).toBe(true);

    // Anulação (como a 0182 faz com a duplicidade de teste): o documento existe, fica marcado e não vale mais.
    await adm().from("pagamentos_bloco").update({ anulado_em: new Date().toISOString(), anulado_motivo: "registro em duplicidade" }).eq("id", ids.cau!);
    await adm().from("documentos_fiscais").update({ anulado_em: new Date().toISOString(), anulado_motivo: "registro em duplicidade" }).eq("id", doc!.id);
    for (const [p, url, largura] of [[t, "/dashboard/locacoes", 390], [await abrir(browser, dono.email, 1280), "/dashboard/contratos", 1280]] as const) {
      await p.goto(url, { waitUntil: "domcontentloaded" });
      const linha = p.getByTestId("recibo-pagamento").filter({ hasText: doc!.numero as string });
      await expect(linha.getByTestId("selo-anulado")).toHaveText("Anulado: registro em duplicidade");
      const pdf = await p.request.get(`/api/documentos/${doc!.id}`);
      expect(pdf.status(), "o PDF do documento anulado continua acessível").toBe(200);
      await p.screenshot({ path: `${SAIDA}/t230-anulado-${largura}.png`, fullPage: true });
    }
    // Não volta para a fila: nenhuma falha aberta para o pagamento anulado.
    const { data: falhas } = await adm().from("documentos_falhas").select("id").eq("pagamento_id", ids.cau!).is("resolvido_em", null);
    expect(falhas ?? []).toHaveLength(0);
  });
});
