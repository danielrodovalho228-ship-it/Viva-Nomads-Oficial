import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { authFile } from "../fixtures/auth";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, adm, apagarContas, cpfAleatorio, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T630 — E227-B: parceria tem UMA fila (parceiro_solicitacoes). Substitui a t630 do E223 (o painel de interesses saiu).
   1. admin, aba Pendentes: cada pedido mostra "há N dias" e a lista vai do mais antigo para o mais novo; o painel
      "Interessados em parceria" não existe mais.
   2. parceiros_interesse (0254) é só leitura para authenticated: insert e update recusados; a linha não muda.
   3. a Central de Pendências (/admin/pendencias) segue contando os pedidos de parceria pendentes.
*/
const sufixo = novoSufixo();
const senha = novaSenha();
const emailConta = `qa+t630${sufixo}-conta@lab.vivanomads.test`;
const DIA = 86_400_000;
const pedidos = [
  { email: `t630.${sufixo}.antigo@lab.vivanomads.test`, nome: `Lab T630 Antigo ${sufixo}`, dias: 10 },
  { email: `t630.${sufixo}.novo@lab.vivanomads.test`, nome: `Lab T630 Novo ${sufixo}`, dias: 2 },
];
const ids: Record<string, string> = {};

test.describe("T630 — E227-B: fila única de parceria (Pendentes com 'há N dias', legado só leitura)", () => {
  test.skip(!NO_LABORATORIO, "Precisa do banco do laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    for (const p of pedidos) {
      const { error } = await adm().from("parceiro_solicitacoes").insert({
        email: p.email,
        nome: p.nome,
        tipo_pessoa: "pf",
        documento: cpfAleatorio(),
        categorias: ["fotografia"],
        cidades: ["Uberlândia"],
        status: "pendente",
        origem: "site",
        criado_em: new Date(Date.now() - p.dias * DIA - 60_000).toISOString(),
      });
      if (error) throw error;
    }
    const { data, error } = await adm()
      .from("parceiros_interesse")
      .insert({ tipo: "fotografo", nome: `Lab T630 legado ${sufixo}`, cidade: "Goiânia", uf: "GO", email: `t630.${sufixo}.legado@lab.vivanomads.test`, aceite_contato: true })
      .select("id")
      .single();
    if (error) throw error;
    ids.legado = data.id as string;
    ids.conta = await criarConta({ email: emailConta, nome: "Conta T630", role: "tenant" }, senha);
  });

  test.afterAll(async () => {
    await adm().from("parceiro_solicitacoes").delete().in("email", pedidos.map((p) => p.email));
    if (ids.legado) await adm().from("parceiros_interesse").delete().eq("id", ids.legado);
    await apagarContas([ids.conta]);
  });

  test.describe("admin", () => {
    test.use({ storageState: authFile("admin") });

    for (const largura of [1280, 390] as const) {
      test(`1. ${largura} px — Pendentes: "há N dias" e do mais antigo para o mais novo; sem o painel antigo`, async ({ page }) => {
        await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
        await page.goto("/admin/parceiros?aba=pendentes", { waitUntil: "domcontentloaded" });
        const fichas = page.getByTestId("ficha-parceria");
        for (const p of pedidos) {
          const ficha = page.locator(`[data-testid="ficha-parceria"][data-email="${p.email}"]`);
          await expect(ficha.getByTestId("ficha-dias")).toHaveText(`há ${p.dias} dias`, { timeout: 30_000 });
        }
        const ordem = await fichas.evaluateAll((els) => els.map((e) => e.getAttribute("data-email")));
        expect(ordem.indexOf(pedidos[0].email)).toBeGreaterThanOrEqual(0);
        expect(ordem.indexOf(pedidos[0].email)).toBeLessThan(ordem.indexOf(pedidos[1].email));
        const dias = await fichas.getByTestId("ficha-dias").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-dias"))));
        expect(dias).toEqual([...dias].sort((a, b) => b - a));
        await expect(page.getByTestId("admin-interesses")).toHaveCount(0);
        await expect(page.getByText("Interessados em parceria")).toHaveCount(0);
        await page.screenshot({ path: `tests/laboratorio/saida/t630-pendentes-${largura}.png`, fullPage: false });
      });
    }

    test("3. Central de Pendências conta os pedidos de parceria pendentes", async ({ page }) => {
      const { count } = await adm()
        .from("parceiro_solicitacoes")
        .select("id", { count: "exact", head: true })
        .in("status", ["pendente", "aguardando_email"])
        .not("categorias", "cs", "{vistoria}");
      expect(count ?? 0).toBeGreaterThanOrEqual(2);
      await page.goto("/admin/pendencias", { waitUntil: "domcontentloaded" });
      await expect(page.locator("main")).toContainText(/pedidos? de parceria para aprovar/, { timeout: 30_000 });
    });
  });

  test("2. parceiros_interesse é só leitura para authenticated (0254)", async () => {
    const c = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    const { error: eLogin } = await c.auth.signInWithPassword({ email: emailConta, password: senha });
    if (eLogin) throw eLogin;
    const ins = await c.from("parceiros_interesse").insert({ tipo: "fotografo", nome: "Não pode", cidade: "Goiânia", uf: "GO", email: `t630.${sufixo}.x@lab.vivanomads.test`, aceite_contato: true });
    expect(ins.error, "insert recusado").not.toBeNull();
    const upd = await c.from("parceiros_interesse").update({ status: "arquivado" }).eq("id", ids.legado).select("id");
    expect(upd.error, "update recusado").not.toBeNull();
    const anon = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    const insAnon = await anon.from("parceiros_interesse").insert({ tipo: "fotografo", nome: "Não pode", cidade: "Goiânia", uf: "GO", email: `t630.${sufixo}.y@lab.vivanomads.test`, aceite_contato: true });
    expect(insAnon.error, "insert anônimo recusado").not.toBeNull();
    const { data } = await adm().from("parceiros_interesse").select("status").eq("id", ids.legado).single();
    expect(data?.status).toBe("novo");
    const { count } = await adm().from("parceiros_interesse").select("id", { count: "exact", head: true }).like("email", `t630.${sufixo}.%`);
    expect(count).toBe(1);
  });
});
