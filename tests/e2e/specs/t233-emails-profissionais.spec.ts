import { test, expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, lerSaida, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { catalogoEmails } from "../../../src/lib/notifications/catalogo-emails";
import { problemasDoAssunto } from "../../../src/lib/notifications/assuntos";

/*
  T233 — Rota rápida "e-mails profissionais" (390 e 1280 px):
   1. teste do Daniel: o admin decide os documentos de um proprietário com 2 imóveis (um com 2 documentos: 1 recusa e
      1 aprovação; outro com 1 aprovação) → sai 1 e-mail por imóvel, nunca 1 por decisão: o primeiro só depois do
      último documento do imóvel, com o título, o tipo de cada documento, o motivo, "Reenviar documento" e o remetente
      "Viva Nomads Brasil <suporte@vivanomads.com.br>"; decidir de novo não repete;
   2. todos os e-mails do catálogo (os mesmos da produção) abrem a 390 e a 1280 px, claro e escuro: botão com rótulo,
      sem rolagem lateral, sem endereço cru visível, imagem com alt; prints dos 6 de conta + recibo + código de
      assinatura + proposta + resultado dos documentos.
*/
const SAIDA = "tests/laboratorio/saida";
const REMETENTE = "Viva Nomads Brasil <suporte@vivanomads.com.br>";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t233.${sufixo}@lab.vivanomads.test`, nome: "Paulo Documento Reis", role: "owner" as const };
const titulos = { a: `Studio Centro T233 ${sufixo}`, b: `Loft Savassi T233 ${sufixo}` };
const ids: Record<string, string | undefined> = {};

const png = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), randomBytes(11 * 1024)]);

async function imovel(titulo: string, bairro: string): Promise<string> {
  const { data, error } = await adm()
    .from("properties")
    .insert({
      owner_id: ids.dono, title: titulo, description: "Imóvel de teste do laboratório (T233).", property_type: "Studio",
      address: bairro, city: "Uberlândia", state: "MG", bedrooms: 1, bathrooms: 1, area_m2: 30,
      min_period_days: 30, max_period_days: 180, monthly_price: 2500, status: "draft",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function documentoPendente(propertyId: string) {
  const caminho = `${ids.dono}/${randomBytes(6).toString("hex")}.png`;
  const { error: e1 } = await adm().storage.from("property-docs").upload(caminho, png(), { contentType: "image/png" });
  if (e1) throw e1;
  const { error } = await adm().from("qualification_checklists").insert({
    owner_id: ids.dono, property_id: propertyId, document_path: caminho, document_status: "pending",
    document_hash_sha256: randomBytes(32).toString("hex"), document_uploaded_at: new Date().toISOString(),
    formulario: { versao: 1, elig: { titularDocumento: "proprio" } },
  });
  if (error) throw error;
}

/** E-mails de decisão de documento que saíram para o dono (outbox do laboratório). */
async function avisosDoDono() {
  return (await lerSaida()).filter((l) => l.servico === "email" && l.para === dono.email && /Document|Conferência dos documentos/.test(String(l.assunto)));
}

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

test.describe("T233 — e-mails profissionais", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (Supabase local + integrações simuladas).");

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.a = await imovel(titulos.a, "Centro");
    ids.b = await imovel(titulos.b, "Savassi");
    await documentoPendente(ids.a);
    await documentoPendente(ids.a);
    await documentoPendente(ids.b);
  });

  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("1. teste do Daniel: decisões do admin → 1 e-mail por imóvel, com título, tipo, motivo e o remetente único", async ({ browser }) => {
    test.skip(!hasAccount("admin"), "Sem conta admin no laboratório.");
    test.setTimeout(120_000);
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto("/admin/documentos", { waitUntil: "networkidle" });

    // Imóvel A, documento 1: recusa (com motivo) — ainda há outro documento de A na fila, então o aviso espera.
    const cardsA = page.locator(`[data-testid="doc-card"][data-imovel="${titulos.a}"]`);
    await expect(cardsA).toHaveCount(2, { timeout: 20_000 });
    await cardsA.first().getByRole("button", { name: "Recusar" }).click();
    await cardsA.first().locator("select").selectOption("ilegivel");
    await cardsA.first().getByRole("button", { name: "Confirmar recusa" }).click();
    await expect(cardsA).toHaveCount(1, { timeout: 20_000 });
    await page.waitForTimeout(1500);
    expect(await avisosDoDono()).toHaveLength(0);

    // Imóvel A, documento 2 (o último de A): aprova → sai UM e-mail com as duas decisões.
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const cb of await cardsA.first().getByRole("checkbox").all()) await cb.check();
    await cardsA.first().getByRole("button", { name: "Aprovar" }).click();
    await expect(cardsA).toHaveCount(0, { timeout: 20_000 });
    await expect.poll(async () => (await avisosDoDono()).length, { timeout: 20_000 }).toBe(1);
    const [a] = await avisosDoDono();
    expect(String(a.assunto)).toBe(`Conferência dos documentos: ${titulos.a} · Viva Nomads`);
    expect(a.de).toBe(REMETENTE);
    const corpoA = String(a.corpo);
    expect(corpoA).toContain(`${titulos.a} · Centro`);
    expect(corpoA).toContain("Comprovante de propriedade do imóvel · Precisa de ajuste");
    expect(corpoA).toContain("Comprovante de propriedade do imóvel · Aprovado");
    expect(corpoA).toContain("Motivo: Documento ilegível ou incompleto");
    expect(corpoA).toMatch(new RegExp(`Reenviar documento \\(https?://[^)]+/dashboard/imoveis/${ids.a}/editar\\)`));
    expect(a.imagem).toBe("transacional.jpg");
    expect(problemasDoAssunto(String(a.assunto))).toEqual([]);
    await page.screenshot({ path: `${SAIDA}/t233-admin-decisoes-1280.png`, fullPage: true });

    // Imóvel B (documento único): aprova → 1 e-mail próprio, com o título de B. Total: 2 e-mails (1 por imóvel).
    await page.setViewportSize({ width: 390, height: 844 });
    const cardB = page.locator(`[data-testid="doc-card"][data-imovel="${titulos.b}"]`);
    for (const cb of await cardB.getByRole("checkbox").all()) await cb.check();
    await cardB.getByRole("button", { name: "Aprovar" }).click();
    await expect(cardB).toHaveCount(0, { timeout: 20_000 });
    await expect.poll(async () => (await avisosDoDono()).length, { timeout: 20_000 }).toBe(2);
    const b = (await avisosDoDono())[1];
    expect(String(b.assunto)).toBe(`Documento aprovado: ${titulos.b} · Viva Nomads`);
    expect(b.de).toBe(REMETENTE);
    expect(String(b.corpo)).toContain("Documento Comprovante de propriedade do imóvel Decisão Aprovado");
    expect(String(b.corpo)).toMatch(/Ver o que falta|Publicar meu anúncio/);
    expect(String(a.assunto)).not.toBe(String(b.assunto));
    await semRolagemLateral(page);
    await page.screenshot({ path: `${SAIDA}/t233-admin-decisoes-390.png`, fullPage: true });

    // As decisões ficaram marcadas como avisadas: a rede do cron não repete nada.
    const { data: pend } = await adm().rpc("decisoes_documento_atrasadas", { p_horas: 1 });
    expect(((pend ?? []) as { owner_id: string }[]).filter((p) => p.owner_id === ids.dono)).toHaveLength(0);
    const { data: marcadas } = await adm().from("qualification_checklists").select("decisao_avisada_em").eq("owner_id", ids.dono!);
    expect((marcadas ?? []).every((m) => !!m.decisao_avisada_em)).toBe(true);
    await ctx.close();
  });

  for (const esquema of ["light", "dark"] as const) {
    test(`2. todos os e-mails do catálogo a 390 e 1280 px (${esquema === "dark" ? "escuro" : "claro"})`, async ({ browser }) => {
      test.setTimeout(180_000);
      const site = "https://vivanomads.com.br";
      const PRINTS = new Set(["conta:confirmar-cadastro", "conta:redefinir-senha", "conta:trocar-email", "conta:convite", "conta:codigo-de-acesso", "conta:reautenticacao", "fiscal:recibo", "codigo:assinatura", "proposta:recebida", "documento:agrupado"]);
      for (const largura of [390, 1280]) {
        const ctx = await browser.newContext({ colorScheme: esquema, viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
        const page = await ctx.newPage();
        await page.route(/^https?:\/\//, (r) => r.abort());
        for (const e of catalogoEmails(site)) {
          await page.setContent(e.html, { waitUntil: "domcontentloaded" });
          if (e.botao) await expect(page.getByRole("link", { name: e.botao, exact: true }), e.chave).toBeVisible();
          await expect(page.locator("h1"), e.chave).toBeVisible();
          expect(await page.locator("body").innerText(), e.chave).not.toMatch(/https?:\/\//);
          await semRolagemLateral(page);
          expect(e.remetente, e.chave).toBe(REMETENTE);
          if (PRINTS.has(e.chave)) await page.screenshot({ path: `${SAIDA}/t233-${e.chave.replace(":", "-")}-${largura}-${esquema}.png`, fullPage: true });
        }
        await ctx.close();
      }
    });
  }
});
