import { test, expect, type Browser, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T227 — Complemento do #880 (reteste do Muse), 390 e 1280 px:
   1. o e-mail do recibo ("Recibo de aluguel REC-…") aparece na Caixa de e-mails de teste das DUAS contas (dono e
      inquilino), com a linha "Anexo: REC-….pdf" (o conteúdo do PDF não vai para a tabela), uma vez só;
   2. a fila "Documentos com falha" é legível: com 2 falhas, cada linha mostra o seu número, tipo, contrato
      (VN-CT-…), o nome curto do proprietário e do inquilino, o motivo e a data — e as duas são diferentes.
  O laboratório usa o Resend falso (LAB_RESEND_URL): só e-mail aceito entra na caixa.
*/
const SAIDA = "tests/laboratorio/saida";
const RESEND = process.env.LAB_RESEND_URL ?? "http://127.0.0.1:3999";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t227.${sufixo}@lab.vivanomads.test`, nome: "Clara Caixa Souza", role: "owner" as const };
const inq = { email: `inq.t227.${sufixo}@lab.vivanomads.test`, nome: "Bruno Caixa Lima", role: "tenant" as const };
const ids: Record<string, string | undefined> = {};
const contratos: string[] = [];
const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function contratoAssinado(imovel: string): Promise<string> {
  const agora = new Date().toISOString();
  const { data, error } = await adm()
    .from("contratos")
    .insert({
      property_id: imovel, tenant_id: ids.inq, owner_plan: "free", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3200,
      tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 768, qtd_ocupantes: 1, status: "ativo", garantia: "caucao",
      assinado_proprietario_em: agora, assinado_inquilino_em: agora,
    })
    .select("id")
    .single();
  if (error) throw error;
  const { error: eB } = await adm()
    .from("contrato_blocos")
    .insert({ contrato_id: data.id, numero_bloco: 1, inicio: dia(0), fim: dia(59), meses: 2, valor: 6400, caucao: 3200, status: "ativo" });
  if (eB) throw eB;
  contratos.push(data.id as string);
  return data.id as string;
}

async function pagamentoConfirmado(contratoId: string): Promise<string> {
  const { data: bloco } = await adm().from("contrato_blocos").select("id").eq("contrato_id", contratoId).single();
  const { data, error } = await adm()
    .from("pagamentos_bloco")
    .insert({ bloco_id: bloco!.id, contrato_id: contratoId, tipo: "aluguel", valor: 6400, forma: "pix", data_pagamento: dia(0), marcado_por: ids.dono, confirmado_pelo_inquilino: true, confirmado_em: new Date().toISOString() })
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

test.describe("T227 — e-mail do recibo na caixa de teste + fila de falhas legível", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    const r = await fetch(`${RESEND}/__emails`).catch(() => null);
    expect(r?.ok, `Resend falso do laboratório em ${RESEND}`).toBeTruthy();
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    ids.a = await criarImovelPronto(ids.dono, `Studio caixa A ${sufixo}`, { ativo: true, preco: 3200 });
    ids.b = await criarImovelPronto(ids.dono, `Studio caixa B ${sufixo}`, { ativo: true, preco: 3200 });
    ids.ca = await contratoAssinado(ids.a);
  });

  test.afterAll(async () => {
    const { data: pgs } = await adm().from("pagamentos_bloco").select("id").in("contrato_id", contratos);
    const pids = ((pgs ?? []) as { id: string }[]).map((p) => p.id);
    if (pids.length) await adm().from("documentos_falhas").delete().in("pagamento_id", pids);
    await adm().from("emails_teste").delete().in("usuario_id", [ids.dono!, ids.inq!]);
    await apagarContas([ids.inq, ids.dono]);
  });

  test("1. 1280 + 390 — confirmar o pagamento → 'Recibo de aluguel REC-…' na caixa de teste das duas contas, com o anexo", async ({ browser }) => {
    test.setTimeout(180_000);
    const d = await abrir(browser, dono.email, 1280);
    await d.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    await d.getByRole("button", { name: /Registrar recebimento/ }).first().click();
    await d.getByRole("button", { name: "Confirmar recebimento" }).click();
    await expect.poll(async () => (await adm().from("pagamentos_bloco").select("id").eq("contrato_id", ids.ca!)).data?.length ?? 0, { timeout: 20_000 }).toBe(1);
    ids.pg = (await adm().from("pagamentos_bloco").select("id").eq("contrato_id", ids.ca!).single()).data!.id as string;

    const t = await abrir(browser, inq.email, 390);
    await t.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
    await t.getByTestId("confirmar-pagamentos").getByRole("button", { name: /Confirmar/ }).click();
    await expect.poll(async () => (await adm().from("documentos_fiscais").select("enviado_em").eq("pagamento_id", ids.pg!).maybeSingle()).data?.enviado_em ?? null, { timeout: 45_000 }).not.toBeNull();
    const numero = (await adm().from("documentos_fiscais").select("numero").eq("pagamento_id", ids.pg!).single()).data!.numero as string;

    // Banco: exatamente 1 linha do recibo por conta (sem duplicar), com evento e anexo pelo nome.
    for (const id of [ids.dono!, ids.inq!]) {
      const { data } = await adm().from("emails_teste").select("evento, assunto, corpo").eq("usuario_id", id).ilike("assunto", `%${numero}%`);
      expect(data, `caixa de ${id}`).toHaveLength(1);
      expect(data![0].evento).toBe("recibo_emitido");
      expect(data![0].corpo).toContain(`Anexo: ${numero}.pdf`);
      expect(data![0].corpo).not.toContain("JVBERi"); // base64 de "%PDF" nunca vai para a tabela
    }

    // Tela: a Caixa de e-mails de teste das duas contas mostra o recibo.
    for (const [p, largura] of [[t, 390], [d, 1280]] as const) {
      await p.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
      const caixa = p.getByTestId("caixa-emails-teste");
      await expect(caixa).toContainText(`Recibo de aluguel ${numero}`, { timeout: 20_000 });
      await semRolagemLateral(p);
      await p.screenshot({ path: `${SAIDA}/t227-caixa-${largura}.png`, fullPage: true });
      await p.context().close();
    }
  });

  test.describe("admin", () => {
    test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
    test.use({ storageState: authFile("admin") });

    for (const largura of [1280, 390]) {
      test(`2. ${largura} — fila legível: 2 falhas, 2 linhas com número, tipo, contrato, nomes, motivo e data diferentes`, async ({ page }) => {
        test.setTimeout(150_000);
        if (!ids.cb) {
          ids.cb = await contratoAssinado(ids.b!);
          // O Resend recusa o e-mail do inquilino nas duas emissões → 2 falhas de envio, uma por documento.
          await fetch(`${RESEND}/__falhas`, { method: "POST", body: JSON.stringify({ status: 422, name: "validation_error", message: "Invalid `to` field.", vezes: 2, para: inq.email }) });
          ids.f1 = await pagamentoConfirmado(ids.ca!);
          ids.f2 = await pagamentoConfirmado(ids.cb);
          await page.setViewportSize({ width: 1280, height: 900 });
          await page.goto("/admin/documentos", { waitUntil: "domcontentloaded" });
          await page.getByTestId("documentos-emitir-pendentes").click();
          await expect(page.getByTestId("documentos-falhas-msg")).toContainText(/\d+ emitidos/, { timeout: 45_000 });
        }
        const numeros: string[] = [];
        for (const [pg, contrato] of [[ids.f1!, ids.ca!], [ids.f2!, ids.cb!]] as const) {
          await expect.poll(async () => (await adm().from("documentos_falhas").select("id").eq("pagamento_id", pg).is("resolvido_em", null)).data?.length ?? 0, { timeout: 20_000 }).toBe(1);
          numeros.push((await adm().from("documentos_fiscais").select("numero").eq("pagamento_id", pg).single()).data!.numero as string);
          void contrato;
        }
        await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
        await page.goto("/admin/documentos", { waitUntil: "domcontentloaded" });
        const vistos: { numero: string; contrato: string }[] = [];
        for (const [i, contratoId] of [ids.ca!, ids.cb!].entries()) {
          const ref = `VN-CT-${contratoId.slice(0, 8).toUpperCase()}`;
          const linha = page.getByTestId("documento-falha").filter({ hasText: numeros[i] });
          await expect(linha).toHaveCount(1, { timeout: 20_000 });
          await expect(linha.getByTestId("falha-numero")).toHaveText(numeros[i]);
          await expect(linha.getByTestId("falha-tipo")).toHaveText("Recibo de aluguel");
          await expect(linha.getByTestId("falha-contrato")).toHaveText(ref);
          await expect(linha.getByTestId("falha-proprietario")).toHaveText("Clara S.");
          await expect(linha.getByTestId("falha-inquilino")).toHaveText("Bruno L.");
          await expect(linha.getByTestId("falha-motivo")).toContainText("e-mail não enviado: Resend 422");
          await expect(linha.getByTestId("falha-data")).toHaveText(/\d{2}\/\d{2}\/\d{4},? \d{2}:\d{2}/);
          vistos.push({ numero: numeros[i], contrato: ref });
        }
        expect(vistos[0].numero).not.toBe(vistos[1].numero);
        expect(vistos[0].contrato).not.toBe(vistos[1].contrato);
        await semRolagemLateral(page);
        await page.screenshot({ path: `${SAIDA}/t227-fila-${largura}.png`, fullPage: true });
      });
    }
  });
});
