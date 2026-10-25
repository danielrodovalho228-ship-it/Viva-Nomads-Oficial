import { test, expect, type Browser, type Page } from "@playwright/test";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, adm, apagarContas, criarConta, criarImovelPronto, entrar, lerSaida, liberarLimiteChamados, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/*
  T442 — FOTO-PERFIL-B (E13), laboratório (390 e 1280 px):
   1. foto nova entra 'em_revisao' e JÁ aparece (revisão depois de publicar); o avatar e a linha da fila são gravados juntos;
   2. RLS: a pessoa lê só as próprias linhas e não muda o status; visitante não lê nada; o dono não baixa a foto do
      inquilino antes do aceite (regra do E14 sem mudança);
   3. fila /admin/fotos-perfil (mais antiga primeiro) + contador "Fotos de perfil em revisão" no painel; Aprovar;
   4. denúncia "Foto de perfil inadequada" pela página do proprietário → a foto volta para 'em_revisao' no TOPO da fila;
   5. Remover exige motivo da lista: apaga o arquivo, limpa o avatar, guarda o motivo e avisa a pessoa UMA vez (Conta +
      e-mail com "Enviar outra foto").
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t442.${sufixo}@lab.vivanomads.test`, nome: "Helena Rosto Prado", role: "owner" as const };
const inquilino = { email: `inq.t442.${sufixo}@lab.vivanomads.test`, nome: "Igor Rosto Lima", role: "tenant" as const };
const denunciante = { email: `den.t442.${sufixo}@lab.vivanomads.test`, nome: "Dora Denúncia Reis", role: "tenant" as const };
const ids: Record<string, string | undefined> = {};

const imagem = () => sharp({ create: { width: 900, height: 700, channels: 3, background: "#2a7a4b" } }).jpeg().toBuffer();

function semDialogo(page: Page) {
  page.on("dialog", (d) => {
    throw new Error(`diálogo do navegador não permitido: ${d.type()} ${d.message()}`);
  });
}

async function abrir(browser: Browser, email: string, largura: number) {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  semDialogo(page);
  return page;
}

async function admin(browser: Browser) {
  const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  semDialogo(page);
  return page;
}

async function enviarFoto(browser: Browser, email: string, largura: number) {
  const p = await abrir(browser, email, largura);
  await p.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
  await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await p.getByTestId("topo-foto-input").setInputFiles({ name: "rosto.jpg", mimeType: "image/jpeg", buffer: await imagem() });
  await expect(p.getByTestId("foto-recorte")).toBeVisible();
  await p.getByTestId("foto-salvar").click();
  await expect(p.getByTestId("topo-foto-msg")).toHaveText("Foto atualizada", { timeout: 20_000 });
  // Já aparece: a revisão é depois de publicar.
  await expect(p.getByTestId("topo-conta").locator("img")).toHaveCount(1);
  return p;
}

async function sessao(email: string) {
  const c = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
  return c;
}

const revisoes = async (userId: string) =>
  ((await adm().from("fotos_perfil_revisao").select("id, status, motivo, caminho, denunciada_em").eq("user_id", userId).order("enviada_em")).data ?? []) as {
    id: string;
    status: string;
    motivo: string | null;
    caminho: string;
    denunciada_em: string | null;
  }[];

test.describe("T442 — FOTO-PERFIL-B: revisão das fotos de perfil", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (Supabase local + integrações simuladas).");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inquilino = await criarConta(inquilino, senha);
    ids.denunciante = await criarConta(denunciante, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Foto t442 ${sufixo}`, { ativo: true });
  });

  test.afterAll(async () => {
    await adm().from("chamados").delete().eq("usuario_id", ids.denunciante ?? "");
    await apagarContas([ids.dono, ids.inquilino, ids.denunciante]);
  });

  test("1. foto nova entra 'em_revisao' e já aparece; avatar e revisão gravados juntos", async ({ browser }) => {
    const p1 = await enviarFoto(browser, dono.email, 390);
    await p1.context().close();
    const p2 = await enviarFoto(browser, inquilino.email, 1280);
    await p2.context().close();
    for (const id of [ids.dono!, ids.inquilino!]) {
      const r = await revisoes(id);
      expect(r).toHaveLength(1);
      expect(r[0]).toMatchObject({ status: "em_revisao", caminho: `${id}/avatar.webp`, motivo: null });
      const { data: perfil } = await adm().from("profiles").select("avatar_url").eq("id", id).single();
      expect((perfil as { avatar_url: string }).avatar_url).toBe(`${id}/avatar.webp`);
    }
    // O servidor não confia no navegador: caminho de outra pessoa é recusado pelo banco.
    const { error } = await adm().rpc("foto_perfil_enviada", { p_user: ids.dono, p_caminho: `${ids.inquilino}/avatar.webp` });
    expect(error?.message ?? "").toMatch(/caminho da foto não é o do titular/);
  });

  test("2. RLS: cada um lê só as suas linhas e não muda status; visitante não lê; foto do inquilino protegida até o aceite", async () => {
    const inq = await sessao(inquilino.email);
    const { data: minhas } = await inq.from("fotos_perfil_revisao").select("user_id");
    expect(new Set((minhas ?? []).map((x) => x.user_id))).toEqual(new Set([ids.inquilino]));
    const { data: mudou } = await inq.from("fotos_perfil_revisao").update({ status: "aprovada" }).eq("user_id", ids.inquilino!).select("id");
    expect(mudou ?? [], "só o admin muda o status").toHaveLength(0);
    expect((await revisoes(ids.inquilino!))[0].status).toBe("em_revisao");
    const anon = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    const { data: vis } = await anon.from("fotos_perfil_revisao").select("id");
    expect(vis ?? []).toHaveLength(0);
    // E14 sem mudança: o proprietário (sem relação aceita) não baixa a foto do inquilino.
    const dn = await sessao(dono.email);
    const { data: arquivo } = await dn.storage.from("avatars").download(`${ids.inquilino}/avatar.webp`);
    expect(arquivo, "foto do inquilino protegida até o aceite").toBeNull();
  });

  test("3. fila (mais antiga primeiro) + contador no painel; Aprovar tira da fila", async ({ browser }) => {
    const a = await admin(browser);
    await a.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(a.getByText("Fotos de perfil em revisão")).toBeVisible({ timeout: 20_000 });
    await expect(a.getByTestId("admin-outras-areas").getByRole("link", { name: "Fotos de perfil" })).toBeVisible();
    await a.goto("/admin/fotos-perfil", { waitUntil: "domcontentloaded" });
    const doDono = a.locator(`[data-testid="fila-foto"][data-user="${ids.dono}"]`);
    const doInq = a.locator(`[data-testid="fila-foto"][data-user="${ids.inquilino}"]`);
    await expect(doDono).toContainText(dono.nome, { timeout: 20_000 });
    await expect(doDono.locator("img")).toHaveCount(1);
    const ordem = await a.locator('[data-testid="fila-foto"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-user")));
    expect(ordem.indexOf(ids.dono!)).toBeLessThan(ordem.indexOf(ids.inquilino!));
    await doDono.getByTestId("foto-aprovar").click();
    await expect(doDono).toHaveCount(0, { timeout: 15_000 });
    await expect(doInq).toHaveCount(1);
    expect((await revisoes(ids.dono!))[0].status).toBe("aprovada");
    await a.context().close();
  });

  test("4. denúncia pela página do proprietário: a foto volta para 'em_revisao' no topo da fila", async ({ browser }) => {
    await liberarLimiteChamados();
    const p = await abrir(browser, denunciante.email, 390);
    await p.goto(`/proprietario/${ids.dono}`, { waitUntil: "domcontentloaded" });
    await p.getByTestId("proprietario-problema-foto").getByRole("link", { name: "Problema com isto?" }).click();
    await expect(p).toHaveURL(new RegExp(`/ajuda\\?contexto=perfil&id=${ids.dono}`));
    await expect(p.getByLabel("Assunto")).toHaveValue("foto_perfil", { timeout: 20_000 });
    await p.getByLabel("O que aconteceu?").fill("A foto do perfil mostra uma criança, não a pessoa da conta.");
    await p.getByRole("button", { name: "Enviar chamado" }).click();
    await expect(p).toHaveURL(/chamado=/, { timeout: 20_000 });
    await p.context().close();
    const r = await revisoes(ids.dono!);
    expect(r.map((x) => x.status)).toEqual(["aprovada", "em_revisao"]);
    expect(r[1].denunciada_em).not.toBeNull();
    const a = await admin(browser);
    await a.goto("/admin/fotos-perfil", { waitUntil: "domcontentloaded" });
    const primeiro = a.locator('[data-testid="fila-foto"]').first();
    await expect(primeiro).toHaveAttribute("data-user", ids.dono!, { timeout: 20_000 });
    await expect(primeiro).toHaveAttribute("data-denunciada", "1");
    await a.context().close();
  });

  test("5. Remover com motivo: apaga o arquivo, limpa o avatar, guarda o motivo e avisa uma vez", async ({ browser }) => {
    const a = await admin(browser);
    await a.goto("/admin/fotos-perfil", { waitUntil: "domcontentloaded" });
    const item = a.locator(`[data-testid="fila-foto"][data-user="${ids.dono}"]`);
    await item.getByTestId("foto-remover").click();
    await expect(item.getByTestId("foto-remover-confirmar")).toBeDisabled();
    await item.getByTestId("foto-motivo").selectOption("Parece ser de criança ou adolescente");
    await item.getByTestId("foto-remover-confirmar").click();
    await expect(item).toHaveCount(0, { timeout: 20_000 });
    await a.context().close();

    const r = await revisoes(ids.dono!);
    expect(r[1]).toMatchObject({ status: "removida", motivo: "Parece ser de criança ou adolescente" });
    const { data: perfil } = await adm().from("profiles").select("avatar_url").eq("id", ids.dono).single();
    expect((perfil as { avatar_url: string | null }).avatar_url).toBeNull();
    const { data: lista } = await adm().storage.from("avatars").list(ids.dono!);
    expect((lista ?? []).filter((f) => f.name === "avatar.webp")).toHaveLength(0);
    const avisos = async () => (await lerSaida()).filter((e) => e.para === dono.email && /A foto do seu perfil foi removida/.test(String(e.assunto)));
    await expect.poll(async () => (await avisos()).length, { timeout: 15_000 }).toBe(1);
    const corpo = String((await avisos())[0].corpo ?? "");
    expect(corpo).toContain("Parece ser de criança ou adolescente");
    expect(corpo).toContain("Enviar outra foto");

    // Dentro do app: o motivo e "Enviar outra foto" na Conta.
    const p = await abrir(browser, dono.email, 390);
    await p.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("aviso-foto-removida")).toContainText("Parece ser de criança ou adolescente", { timeout: 20_000 });
    await expect(p.getByTestId("aviso-foto-enviar")).toHaveAccessibleName("Enviar outra foto");
    await p.context().close();
    expect((await avisos()).length, "um aviso só").toBe(1);
  });
});
