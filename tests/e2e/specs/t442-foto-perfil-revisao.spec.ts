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
   3. fila /admin/fotos-perfil (mais antiga primeiro), aberta pelo menu do admin (E176 tirou o contador da inicial); Aprovar;
   4. denúncia "Foto de perfil inadequada" pela página do proprietário → a foto volta para 'em_revisao' no TOPO da fila;
   5. Remover exige motivo da lista: apaga o arquivo, limpa o avatar, guarda o motivo e avisa a pessoa UMA vez (Conta +
      e-mail com "Enviar outra foto").
  E13 (t442 na quarentena, ORDEM-DUET-102): os casos 4 e 5 não dependem mais dos casos 1 a 3. Ficam num bloco próprio, com
  contas próprias e uma foto já aprovada semeada no beforeAll; o caso 5 semeia a própria denúncia quando o 4 não a deixou.
  O bloco roda em ordem SEM pular (mode "default"): se o 4 falhar, o 5 roda mesmo assim, num worker novo (contas novas).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t442.${sufixo}@lab.vivanomads.test`, nome: "Helena Rosto Prado", role: "owner" as const };
const inquilino = { email: `inq.t442.${sufixo}@lab.vivanomads.test`, nome: "Igor Rosto Lima", role: "tenant" as const };
const denunciante = { email: `den.t442.${sufixo}@lab.vivanomads.test`, nome: "Dora Denúncia Reis", role: "tenant" as const };
const ids: Record<string, string | undefined> = {};
// Bloco da denúncia e da remoção (casos 4 e 5): contas criadas a cada beforeAll (worker novo = contas novas).
const den: { dono?: { id: string; email: string }; denunciante?: { id: string; email: string } } = {};
const unico = () => `${process.pid}.${Date.now()}`;

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

/** Massa do bloco 4/5: foto do titular no Storage, avatar e revisão gravados juntos (RPC do produto), já aprovada. */
async function semearFotoAprovada(userId: string) {
  const caminho = `${userId}/avatar.webp`;
  const webp = await sharp(await imagem()).resize(400, 400).webp().toBuffer();
  const { error: e1 } = await adm().storage.from("avatars").upload(caminho, webp, { contentType: "image/webp", upsert: true });
  if (e1) throw e1;
  const { data: rid, error: e2 } = await adm().rpc("foto_perfil_enviada", { p_user: userId, p_caminho: caminho });
  if (e2) throw e2;
  const { error: e3 } = await adm().from("fotos_perfil_revisao").update({ status: "aprovada", revisado_em: new Date().toISOString() }).eq("id", rid as string);
  if (e3) throw e3;
}

/** Caso 5 sem o 4 (falhou, ou o worker é novo): a denúncia que ele deixaria — o mesmo que o servidor grava no chamado. */
async function garantirDenunciada(userId: string) {
  if ((await revisoes(userId)).some((x) => x.status === "em_revisao")) return;
  const { error } = await adm().from("fotos_perfil_revisao").insert({ user_id: userId, caminho: `${userId}/avatar.webp`, denunciada_em: new Date().toISOString() });
  if (error) throw error;
}

test.describe("T442 — FOTO-PERFIL-B: revisão das fotos de perfil", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (Supabase local + integrações simuladas).");

  test.describe("envio, RLS e fila (casos 1 a 3, em série)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inquilino = await criarConta(inquilino, senha);
  });

  test.afterAll(async () => {
    await apagarContas([ids.dono, ids.inquilino]);
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

  // E744 (asserção alterada, tabela da Fable #3832): o ADMIN-4/E176 tirou da inicial do /admin o painel "Áreas do admin"
  // (contador "Fotos de perfil em revisão" e atalho); a fila se abre pelo menu "Fotos de perfil" (/admin/fotos-perfil).
  // O contador sem tela fica como dúvida no PR.
  test("3. fila (mais antiga primeiro), aberta pelo menu do admin; Aprovar tira da fila", async ({ browser }) => {
    const a = await admin(browser);
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

  });

  test.describe("denúncia e remoção (casos 4 e 5, com estado próprio)", () => {
  test.describe.configure({ mode: "default" });

  test.beforeAll(async () => {
    const emailDono = `dono2.t442.${unico()}.${sufixo}@lab.vivanomads.test`;
    den.dono = { id: await criarConta({ ...dono, email: emailDono }, senha), email: emailDono };
    const emailDen = `den.t442.${unico()}.${sufixo}@lab.vivanomads.test`;
    den.denunciante = { id: await criarConta({ ...denunciante, email: emailDen }, senha), email: emailDen };
    await criarImovelPronto(den.dono.id, `Foto t442 ${sufixo}`, { ativo: true });
    await semearFotoAprovada(den.dono.id);
  });

  test.afterAll(async () => {
    await adm().from("chamados").delete().eq("usuario_id", den.denunciante?.id ?? "");
    await apagarContas([den.dono?.id, den.denunciante?.id]);
  });

  // E13 (asserção alterada): o "Problema com isto?" liga direto a /ajuda/fale-com-a-viva. Antes passava pelo hub /ajuda,
  // que redirecionava no servidor; afirmar o endereço intermediário dependia de ler a URL antes do salto (1 falha em 3).
  test("4. denúncia pela página do proprietário: a foto volta para 'em_revisao' no topo da fila", async ({ browser }) => {
    const idDono = den.dono!.id;
    await liberarLimiteChamados();
    const p = await abrir(browser, den.denunciante!.email, 390);
    await p.goto(`/proprietario/${idDono}`, { waitUntil: "domcontentloaded" });
    await p.getByTestId("proprietario-problema-foto").getByRole("link", { name: "Problema com isto?" }).click();
    await expect(p).toHaveURL(new RegExp(`/ajuda/fale-com-a-viva\\?contexto=perfil&id=${idDono}`));
    await expect(p.getByLabel("Assunto")).toHaveValue("foto_perfil", { timeout: 20_000 });
    await p.getByLabel("O que aconteceu?").fill("A foto do perfil mostra uma criança, não a pessoa da conta.");
    await p.getByRole("button", { name: "Enviar chamado" }).click();
    await expect(p).toHaveURL(/chamado=/, { timeout: 20_000 });
    await p.context().close();
    const r = await revisoes(idDono);
    expect(r.map((x) => x.status)).toEqual(["aprovada", "em_revisao"]);
    expect(r[1].denunciada_em).not.toBeNull();
    const a = await admin(browser);
    await a.goto("/admin/fotos-perfil", { waitUntil: "domcontentloaded" });
    const primeiro = a.locator('[data-testid="fila-foto"]').first();
    await expect(primeiro).toHaveAttribute("data-user", idDono, { timeout: 20_000 });
    await expect(primeiro).toHaveAttribute("data-denunciada", "1");
    await a.context().close();
  });

  test("5. Remover com motivo: apaga o arquivo, limpa o avatar, guarda o motivo e avisa uma vez", async ({ browser }) => {
    const idDono = den.dono!.id;
    const donoEmail = den.dono!.email;
    await garantirDenunciada(idDono);
    const a = await admin(browser);
    await a.goto("/admin/fotos-perfil", { waitUntil: "domcontentloaded" });
    const item = a.locator(`[data-testid="fila-foto"][data-user="${idDono}"]`);
    await item.getByTestId("foto-remover").click();
    await expect(item.getByTestId("foto-remover-confirmar")).toBeDisabled();
    await item.getByTestId("foto-motivo").selectOption("Parece ser de criança ou adolescente");
    await item.getByTestId("foto-remover-confirmar").click();
    await expect(item).toHaveCount(0, { timeout: 20_000 });
    await a.context().close();

    const r = await revisoes(idDono);
    expect(r[1]).toMatchObject({ status: "removida", motivo: "Parece ser de criança ou adolescente" });
    const { data: perfil } = await adm().from("profiles").select("avatar_url").eq("id", idDono).single();
    expect((perfil as { avatar_url: string | null }).avatar_url).toBeNull();
    const { data: lista } = await adm().storage.from("avatars").list(idDono);
    expect((lista ?? []).filter((f) => f.name === "avatar.webp")).toHaveLength(0);
    const avisos = async () => (await lerSaida()).filter((e) => e.para === donoEmail && /A foto do seu perfil foi removida/.test(String(e.assunto)));
    await expect.poll(async () => (await avisos()).length, { timeout: 15_000 }).toBe(1);
    const corpo = String((await avisos())[0].corpo ?? "");
    expect(corpo).toContain("Parece ser de criança ou adolescente");
    expect(corpo).toContain("Enviar outra foto");

    // Dentro do app: o motivo e "Enviar outra foto" na Conta.
    const p = await abrir(browser, donoEmail, 390);
    await p.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("aviso-foto-removida")).toContainText("Parece ser de criança ou adolescente", { timeout: 20_000 });
    await expect(p.getByTestId("aviso-foto-enviar")).toHaveAccessibleName("Enviar outra foto");
    await p.context().close();
    expect((await avisos()).length, "um aviso só").toBe(1);
  });
  });
});
