import { test, expect, type Browser, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, lerSaida, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T223 — Complemento do recibo (coordenador, reteste do #872, 19/10), 390 e 1280 px. O laboratório sobe o Resend
  FALSO (scripts/lab/resend-falso.mjs, LAB_RESEND_URL): ele confere o e-mail como o Resend (remetente, destinatário,
  anexo com nome e conteúdo em base64) e devolve um id, ou recusa quando o teste programa.
   1. registrar → confirmar → o e-mail chega nas DUAS caixas de teste com o PDF → envio mostra os dois como
      "enviado" com resend_id → enviado_em preenchido → "Baixar recibo" dos dois lados → fila vazia;
   2. Resend recusa o e-mail do inquilino (422) → enviado_em fica vazio, envio mostra "erro" com o motivo do Resend
      (sem o endereço) → a fila mostra "e-mail não enviado: Resend 422 …" → "Reenviar e-mail" manda o MESMO
      documento só para quem faltou → os dois "enviado" → fila vazia, nenhum documento novo;
   3. trava de contato antes da numeração: a tentativa bloqueada não queima número;
   4. "Registrado em: dd/mm/aaaa" na página do contrato.
*/
const SAIDA = "tests/laboratorio/saida";
const RESEND = process.env.LAB_RESEND_URL ?? "http://127.0.0.1:3999";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t223.${sufixo}@lab.vivanomads.test`, nome: "Ana Envio Souza", role: "owner" as const };
const inq = { email: `inq.t223.${sufixo}@lab.vivanomads.test`, nome: "Iara Envio Jornada", role: "tenant" as const };
const ids: Record<string, string | undefined> = {};
const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

interface EmailFalso {
  id: string;
  para: string;
  de: string;
  assunto: string;
  anexos: { nome: string; bytes: number; pdf: boolean }[];
}
interface Envio {
  papel: string;
  status: string;
  resend_id: string | null;
  erro: string | null;
}
const emailsFalsos = async (): Promise<EmailFalso[]> => (await fetch(`${RESEND}/__emails`)).json();
const programarFalha = (f: object) => fetch(`${RESEND}/__falhas`, { method: "POST", body: JSON.stringify(f) });

async function contratoAssinado(): Promise<string> {
  const agora = new Date().toISOString();
  const { data, error } = await adm()
    .from("contratos")
    .insert({
      property_id: ids.imovel,
      tenant_id: ids.inq,
      owner_plan: "free",
      faixa: "temporada",
      prazo_total_dias: 60,
      aluguel_mensal: 3200,
      tamanho_bloco_meses: 2,
      comissao_percent: 0.12,
      comissao_valor: 768,
      qtd_ocupantes: 1,
      status: "ativo",
      garantia: "caucao",
      assinado_proprietario_em: agora,
      assinado_inquilino_em: agora,
    })
    .select("id, created_at")
    .single();
  if (error) throw error;
  const { error: eB } = await adm()
    .from("contrato_blocos")
    .insert({ contrato_id: data.id, numero_bloco: 1, inicio: dia(0), fim: dia(59), meses: 2, valor: 6400, caucao: 3200, status: "ativo" });
  if (eB) throw eB;
  ids.criadoEm = String(data.created_at);
  return data.id as string;
}

/** Pagamento já confirmado sem documento (entra no "Emitir os pendentes" do admin). */
async function pagamentoConfirmado(tipo: "aluguel" | "caucao", valor: number): Promise<string> {
  const { data: bloco } = await adm().from("contrato_blocos").select("id").eq("contrato_id", ids.contrato!).single();
  const { data, error } = await adm()
    .from("pagamentos_bloco")
    .insert({ bloco_id: bloco!.id, contrato_id: ids.contrato, tipo, valor, forma: "pix", data_pagamento: dia(0), marcado_por: ids.dono, confirmado_pelo_inquilino: true, confirmado_em: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function abrir(browser: Browser, email: string, largura: number): Promise<Page> {
  const p = await entrar(browser, email, senha);
  await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  return p;
}

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

const documentoDe = async (pagamentoId: string) =>
  (await adm().from("documentos_fiscais").select("id, numero, enviado_em, envio").eq("pagamento_id", pagamentoId).maybeSingle()).data as
    | { id: string; numero: string; enviado_em: string | null; envio: Envio[] }
    | null;
const falhaAberta = async (pagamentoId: string) =>
  (await adm().from("documentos_falhas").select("id, motivo, etapa, documento_id").eq("pagamento_id", pagamentoId).is("resolvido_em", null).maybeSingle()).data as
    | { id: string; motivo: string; etapa: string; documento_id: string | null }
    | null;

test.describe("T223 — recibo: envio confirmado, recusa do Resend, Reenviar e-mail, trava sem queimar número, datas pt-BR", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    const r = await fetch(`${RESEND}/__emails`).catch(() => null);
    expect(r?.ok, `Resend falso do laboratório em ${RESEND} (scripts/lab/resend-falso.mjs)`).toBeTruthy();
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio envio ${sufixo}`, { ativo: true, preco: 3200 });
    ids.contrato = await contratoAssinado();
  });

  test.afterAll(async () => {
    const { data: pgs } = await adm().from("pagamentos_bloco").select("id").eq("contrato_id", ids.contrato!);
    const pids = ((pgs ?? []) as { id: string }[]).map((p) => p.id);
    if (pids.length) await adm().from("documentos_falhas").delete().in("pagamento_id", pids);
    await adm().from("documentos_fiscais").delete().eq("contrato_id", ids.contrato!);
    await adm().from("pagamentos_bloco").delete().eq("contrato_id", ids.contrato!);
    await adm().from("contrato_blocos").delete().eq("contrato_id", ids.contrato!);
    await adm().from("contratos").delete().eq("id", ids.contrato!);
    await apagarContas([ids.inq, ids.dono]);
  });

  test("1. 1280 + 390 — registrar → confirmar → as duas caixas recebem o PDF → envio 'enviado' com resend_id → 'Baixar recibo' dos dois lados → fila vazia", async ({ browser }) => {
    test.setTimeout(180_000);
    const d = await abrir(browser, dono.email, 1280);
    await d.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    await d.getByTestId("registrar-recebimento").first().click();
    await d.getByRole("button", { name: "Confirmar recebimento" }).click();
    await expect.poll(async () => (await adm().from("pagamentos_bloco").select("id").eq("contrato_id", ids.contrato!)).data?.length ?? 0, { timeout: 20_000 }).toBe(1);
    ids.pagamento = (await adm().from("pagamentos_bloco").select("id").eq("contrato_id", ids.contrato!).single()).data!.id as string;

    const t = await abrir(browser, inq.email, 390);
    await t.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
    const confirmar = t.getByTestId("confirmar-pagamentos");
    await expect(confirmar).toBeVisible({ timeout: 20_000 });
    await confirmar.getByRole("button", { name: /Confirmar/ }).click();

    // envio: os dois "enviado" com resend_id; só então enviado_em.
    await expect.poll(async () => (await documentoDe(ids.pagamento!))?.enviado_em ?? null, { timeout: 45_000 }).not.toBeNull();
    const doc = (await documentoDe(ids.pagamento!))!;
    ids.doc = doc.id;
    expect(doc.envio.map((e) => e.papel).sort()).toEqual(["locador", "locatario"]);
    for (const e of doc.envio) {
      expect(e.status).toBe("enviado");
      expect(e.resend_id).toMatch(/^[0-9a-f-]{36}$/);
    }
    expect(JSON.stringify(doc.envio)).not.toContain("@"); // nunca o endereço

    // As duas caixas de teste: o Resend falso aceitou um e-mail para cada uma, com o PDF (nome = número do documento).
    const recebidos = (await emailsFalsos()).filter((m) => m.assunto.includes(doc.numero));
    for (const email of [dono.email, inq.email]) {
      const m = recebidos.find((x) => x.para === email);
      expect(m, `e-mail do recibo para ${email}`).toBeTruthy();
      expect(doc.envio.map((e) => e.resend_id)).toContain(m!.id);
      expect(m!.anexos).toEqual([expect.objectContaining({ nome: `${doc.numero}.pdf`, pdf: true })]);
      expect(m!.de).toBe("Viva Nomads <nao-responder@vivanomads.com.br>"); // o mesmo remetente dos outros avisos
    }
    // e o registro de sempre do laboratório (link de verificação no botão).
    const saida = (await lerSaida()).filter((l) => String(l.assunto ?? "").includes(doc.numero));
    for (const email of [dono.email, inq.email]) expect(String(saida.find((l) => l.para === email)?.corpo ?? "")).toContain("/conferir/");
    expect(await falhaAberta(ids.pagamento!)).toBeNull();

    // "Baixar recibo" dos dois lados.
    await t.reload({ waitUntil: "domcontentloaded" });
    await expect(t.locator('[data-testid="recibo-pagamento"][data-emitido="sim"]').getByTestId("baixar-recibo")).toBeVisible({ timeout: 20_000 });
    expect((await t.request.get(`/api/documentos/${ids.doc}`, { maxRedirects: 0 })).status()).toBe(302);
    await semRolagemLateral(t);
    await t.screenshot({ path: `${SAIDA}/t223-recibo-morador-390.png`, fullPage: true });
    await t.context().close();
    await d.reload({ waitUntil: "domcontentloaded" });
    await expect(d.locator('[data-testid="recibo-pagamento"][data-emitido="sim"]').getByTestId("baixar-recibo")).toBeVisible({ timeout: 20_000 });
    expect((await d.request.get(`/api/documentos/${ids.doc}`, { maxRedirects: 0 })).status()).toBe(302);
    await semRolagemLateral(d);
    await d.screenshot({ path: `${SAIDA}/t223-recibo-dono-1280.png`, fullPage: true });
    await d.context().close();
  });

  for (const largura of [390, 1280]) {
    test(`4. ${largura} — 'Registrado em: dd/mm/aaaa' na página do contrato (nunca ISO)`, async ({ browser }) => {
      test.setTimeout(90_000);
      const t = await abrir(browser, inq.email, largura);
      await t.goto(`/dashboard/locacoes/${ids.contrato}`, { waitUntil: "domcontentloaded" });
      const resumo = t.getByTestId("contrato-resumo");
      const iso = ids.criadoEm!.slice(0, 10);
      await expect(resumo).toContainText(`Registrado em: ${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`, { timeout: 20_000 });
      expect(await resumo.innerText()).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      await semRolagemLateral(t);
      await t.screenshot({ path: `${SAIDA}/t223-registrado-em-${largura}.png`, fullPage: true });
      await t.context().close();
    });
  }

  test.describe("admin", () => {
    test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
    test.use({ storageState: authFile("admin") });

    test("2. 1280 + 390 — Resend recusa o inquilino → fila 'e-mail não enviado: Resend 422' → 'Reenviar e-mail' → os dois enviados, sem documento novo", async ({ page }) => {
      test.setTimeout(150_000);
      await programarFalha({ status: 422, name: "validation_error", message: "Invalid `to` field.", vezes: 1, para: inq.email });
      ids.pg2 = await pagamentoConfirmado("aluguel", 3200);
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto("/admin/documentos", { waitUntil: "domcontentloaded" });
      const fila = page.getByTestId("documentos-falhas");
      await fila.getByTestId("documentos-emitir-pendentes").click();
      await expect(page.getByTestId("documentos-falhas-msg")).toContainText(/\d+ emitidos/, { timeout: 45_000 });

      // Emitido, mas o e-mail do inquilino não saiu: enviado_em vazio, envio com o motivo do Resend, linha na fila.
      await expect.poll(async () => (await documentoDe(ids.pg2!))?.envio?.length ?? 0, { timeout: 20_000 }).toBe(2);
      const doc = (await documentoDe(ids.pg2!))!;
      expect(doc.enviado_em).toBeNull();
      const porPapel = Object.fromEntries(doc.envio.map((e) => [e.papel, e]));
      expect(porPapel.locador.status).toBe("enviado");
      expect(porPapel.locatario).toMatchObject({ status: "erro", resend_id: null, erro: "Resend 422: validation_error: Invalid `to` field." });
      const falha = (await falhaAberta(ids.pg2!))!;
      expect(falha).toMatchObject({ etapa: "envio", documento_id: doc.id, motivo: "e-mail não enviado: Resend 422: validation_error: Invalid `to` field. (inquilino)" });
      expect(falha.motivo).not.toContain("@");

      await page.reload({ waitUntil: "domcontentloaded" });
      const linha = fila.getByTestId("documento-falha").filter({ hasText: "e-mail não enviado: Resend 422" });
      await expect(linha).toContainText("emitido, e-mail não saiu");
      await expect(linha.getByTestId("documento-emitir-de-novo")).toHaveCount(0);
      await page.screenshot({ path: `${SAIDA}/t223-fila-envio-1280.png`, fullPage: true });

      // "Reenviar e-mail": o MESMO documento, só para quem faltou (o inquilino).
      const antes = (await emailsFalsos()).length;
      await page.setViewportSize({ width: 390, height: 844 });
      await linha.getByTestId("documento-reenviar-email").click();
      await expect(page.getByTestId("documentos-falhas-msg")).toContainText(`E-mail reenviado: ${doc.numero} (2 de 2 confirmados).`, { timeout: 30_000 });
      const novos = (await emailsFalsos()).slice(antes);
      expect(novos.map((m) => m.para)).toEqual([inq.email]);
      expect(novos[0].anexos[0]).toMatchObject({ nome: `${doc.numero}.pdf`, pdf: true });
      const depois = (await documentoDe(ids.pg2!))!;
      expect(depois.id).toBe(doc.id);
      expect(depois.numero).toBe(doc.numero);
      expect(depois.enviado_em).not.toBeNull();
      expect(depois.envio.every((e) => e.status === "enviado" && !!e.resend_id)).toBe(true);
      expect((await adm().from("documentos_fiscais").select("id").eq("pagamento_id", ids.pg2!)).data).toHaveLength(1);
      expect(await falhaAberta(ids.pg2!)).toBeNull();
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(fila.getByTestId("documento-falha").filter({ hasText: doc.numero })).toHaveCount(0);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t223-fila-reenviado-390.png`, fullPage: true });
    });

    test("3. 1280 — trava de contato ANTES da numeração: a tentativa bloqueada não queima número; corrigido, sai com o próximo", async ({ page }) => {
      test.setTimeout(150_000);
      const { data: imv } = await adm().from("properties").select("exact_address").eq("id", ids.imovel!).single();
      await adm().from("properties").update({ exact_address: "Rua das Acácias, 10 — fale comigo (34) 99999-8888" }).eq("id", ids.imovel!);
      const contador = async () => Number((await adm().from("documentos_fiscais_contador").select("ultimo").eq("tipo", "comprovante_caucao").eq("ano", new Date().getFullYear()).maybeSingle()).data?.ultimo ?? 0);
      const cauCriados = async (desde: string) => (await adm().from("documentos_fiscais").select("id").eq("tipo", "comprovante_caucao").gte("criado_em", desde)).data?.length ?? 0;
      ids.pg3 = await pagamentoConfirmado("caucao", 3200);
      const inicio = new Date().toISOString();
      const c0 = await contador();
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto("/admin/documentos", { waitUntil: "domcontentloaded" });
      await page.getByTestId("documentos-emitir-pendentes").click();
      await expect(page.getByTestId("documentos-falhas-msg")).toContainText(/com falha/, { timeout: 45_000 });
      expect((await falhaAberta(ids.pg3!))?.motivo).toBe("documento traria contato");
      expect(await documentoDe(ids.pg3!)).toBeNull();
      // O contador só andou o que OUTROS testes emitiram no mesmo intervalo — a tentativa bloqueada não reservou número.
      expect((await contador()) - c0).toBe(await cauCriados(inicio));

      // Corrigido o endereço, "Emitir de novo" sai com número reservado só agora.
      await adm().from("properties").update({ exact_address: imv?.exact_address ?? null }).eq("id", ids.imovel!);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByTestId("documento-falha").filter({ hasText: "documento traria contato" }).first().getByTestId("documento-emitir-de-novo").click();
      await expect(page.getByTestId("documentos-falhas-msg")).toContainText(/Emitido: CAU-\d{4}-\d{6}\./, { timeout: 45_000 });
      expect(await falhaAberta(ids.pg3!)).toBeNull();
      await page.screenshot({ path: `${SAIDA}/t223-trava-1280.png`, fullPage: true });
    });

    test("1. fila termina vazia para este contrato", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      for (const pid of [ids.pagamento, ids.pg2, ids.pg3]) expect(await falhaAberta(pid!)).toBeNull();
      await page.goto("/admin/documentos", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("documentos-falhas")).toBeVisible({ timeout: 20_000 });
    });
  });
});
