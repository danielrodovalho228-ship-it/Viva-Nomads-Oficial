import { test, expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

/**
 * T33 — DOCUMENTOS DO INQUILINO depois do aceite (laboratório). Contas NOVAS.
 *  1. Candidatura ainda não aceita: o envio é recusado (409).
 *  2. Aceita: o inquilino envia a identidade em Minhas candidaturas (390 px).
 *  3. O fechamento do dono avisa que falta renda/vínculo; o inquilino envia o
 *     vínculo; o dono vê "completos" e abre por link assinado de 10 min.
 *  4. Outra conta não envia para a candidatura alheia; ninguém lê o caminho do arquivo.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const adm = () => createClient(URL!, SERVICE!, { auth: { persistSession: false } });

const senha = randomBytes(12).toString("hex");
const sufixo = randomBytes(3).toString("hex");
const contas = {
  dono: { email: `dono.inq.${sufixo}@lab.vivanomads.test`, nome: "Davi Dono", role: "owner" },
  inquilina: { email: `inq.docs.${sufixo}@lab.vivanomads.test`, nome: "Ines Inquilina", role: "tenant" },
  intrusa: { email: `intrusa.${sufixo}@lab.vivanomads.test`, nome: "Iris Intrusa", role: "tenant" },
};
const ids: Record<string, string> = {};

function cpfAleatorio(): string {
  const d = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const dv = (b: number[]) => {
    const r = (b.reduce((s, x, i) => s + x * (b.length + 1 - i), 0) * 10) % 11;
    return r === 10 ? 0 : r;
  };
  d.push(dv(d));
  d.push(dv(d));
  return d.join("");
}
const pdf = () => Buffer.concat([Buffer.from("%PDF-1.4\n% laboratório\n"), Buffer.alloc(12 * 1024, 0x20), Buffer.from("\n%%EOF\n")]);

async function entrar(browser: Browser, email: string): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto("/auth", { waitUntil: "networkidle" });
  await page.locator('input[name="email"], input[type="email"]').first().fill(email);
  await page.locator('input[name="password"], input[type="password"]').first().fill(senha);
  await page.locator("form").getByRole("button", { name: /^entrar$/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  await page.evaluate(() => localStorage.setItem("vivanomads-role-asked", "1"));
  return page;
}

/** Envia um documento pela rota, com a sessão da página. */
async function enviarPelaRota(page: Page, tipo: string) {
  return page.request.post("/api/upload/inquilino-doc", {
    multipart: { leadId: ids.lead, tipo, file: { name: `${tipo}.pdf`, mimeType: "application/pdf", buffer: pdf() } },
  });
}

test.describe("T33 — Documentos do inquilino depois do aceite", () => {
  test.skip(process.env.INTEGRACOES_SIMULADAS !== "on" || !URL || !SERVICE, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    for (const [k, c] of Object.entries(contas)) {
      const { data, error } = await adm().auth.admin.createUser({ email: c.email, password: senha, email_confirm: true, user_metadata: { full_name: c.nome } });
      if (error) throw error;
      ids[k] = data.user.id;
      const { error: e2 } = await adm().from("profiles").upsert({ id: data.user.id, email: c.email, full_name: c.nome, role: c.role, cpf: cpfAleatorio() }, { onConflict: "id" });
      if (e2) throw e2;
    }
    const { data: imovel, error } = await adm()
      .from("properties")
      .insert({
        owner_id: ids.dono, title: `Studio T33 ${sufixo}`, description: "Imóvel de teste do laboratório (T33).", property_type: "Studio",
        address: "Centro", city: "Uberlândia", state: "MG", bedrooms: 1, bathrooms: 1, area_m2: 30, min_period_days: 30,
        max_period_days: 180, monthly_price: 2500, status: "active",
      })
      .select("id")
      .single();
    if (error) throw error;
    const { data: lead, error: e3 } = await adm().from("leads").insert({ owner_id: ids.dono, tenant_id: ids.inquilina, property_id: imovel.id, status: "new" }).select("id").single();
    if (e3) throw e3;
    ids.lead = lead.id as string;
  });

  test.afterAll(async () => {
    const { data } = await adm().from("documentos_inquilino").select("caminho").eq("lead_id", ids.lead ?? "");
    if (data?.length) await adm().storage.from("inquilino-docs").remove(data.map((d) => d.caminho as string));
    for (const k of Object.keys(contas)) if (ids[k]) await adm().auth.admin.deleteUser(ids[k]);
  });

  test("antes do aceite, nenhum documento; depois, o inquilino envia a identidade na tela", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, contas.inquilina.email);
    expect((await enviarPelaRota(page, "identidade")).status()).toBe(409);

    await adm().from("leads").update({ status: "accepted", accepted_at: new Date().toISOString(), decided_by: ids.dono }).eq("id", ids.lead);
    await page.goto("/dashboard/candidaturas", { waitUntil: "networkidle" });
    const bloco = page.getByTestId("docs-inquilino");
    await expect(bloco).toContainText("Documentos para o contrato");
    await bloco.getByLabel("Enviar documento de identidade").setInputFiles({ name: "rg.pdf", mimeType: "application/pdf", buffer: pdf() });
    await expect(page.getByTestId("doc-inquilino-identidade")).toContainText("enviado", { timeout: 20_000 });
    await expect(page.getByTestId("docs-inquilino-completos")).toHaveCount(0);
    await page.screenshot({ path: "tests/laboratorio/saida/t33-1-inquilino-identidade.png", fullPage: true });
    await page.context().close();
  });

  test("fechamento: falta renda/vínculo → aviso; com o vínculo, completos e o dono abre por link de 10 min", async ({ browser }) => {
    test.setTimeout(90_000);
    const dono = await entrar(browser, contas.dono.email);
    await dono.goto(`/dashboard/fechamento?c=${ids.lead}`, { waitUntil: "networkidle" });
    await expect(dono.getByTestId("documento-pendente")).toContainText("ainda não enviou os documentos (identidade e comprovante de renda ou vínculo)", { timeout: 15_000 });
    await expect(dono.getByTestId("doc-inquilino-identidade")).toBeVisible();
    await expect(dono.getByTestId("docs-inquilino")).not.toContainText("Enviar arquivo");

    const inq = await entrar(browser, contas.inquilina.email);
    expect((await enviarPelaRota(inq, "vinculo")).status()).toBe(200);
    await inq.context().close();

    await dono.reload({ waitUntil: "networkidle" });
    await expect(dono.getByTestId("docs-inquilino-completos")).toBeVisible({ timeout: 15_000 });
    await expect(dono.getByTestId("documento-pendente")).toHaveCount(0);
    await dono.screenshot({ path: "tests/laboratorio/saida/t33-2-dono-docs-completos.png", fullPage: true });
    const [popup] = await Promise.all([
      dono.waitForEvent("popup"),
      dono.getByTestId("doc-inquilino-vinculo").getByRole("button", { name: /Abrir/ }).click(),
    ]);
    expect(popup.url()).toMatch(/\/storage\/v1\/object\/sign\/inquilino-docs\/.+token=/);
    await dono.context().close();
  });

  test("outra conta não envia para a candidatura alheia; o caminho do arquivo não é legível pela sessão", async ({ browser }) => {
    const intrusa = await entrar(browser, contas.intrusa.email);
    expect((await enviarPelaRota(intrusa, "renda")).status()).toBe(404);
    await intrusa.context().close();

    const cli = createClient(URL!, ANON!, { auth: { persistSession: false } });
    await cli.auth.signInWithPassword({ email: contas.inquilina.email, password: senha });
    const { data: meus } = await cli.from("documentos_inquilino").select("tipo").eq("lead_id", ids.lead);
    expect((meus ?? []).map((d) => d.tipo).sort()).toEqual(["identidade", "vinculo"]);
    const { error } = await cli.from("documentos_inquilino").select("caminho").eq("lead_id", ids.lead);
    expect(error).not.toBeNull();
    const { error: eIns } = await cli.from("documentos_inquilino").insert({ lead_id: ids.lead, tenant_id: ids.inquilina, tipo: "renda", caminho: "x", hash_sha256: "0".repeat(64) });
    expect(eIns).not.toBeNull();
    const { data: lista } = await cli.storage.from("inquilino-docs").list(ids.inquilina);
    expect(lista ?? []).toHaveLength(0);
  });
});
