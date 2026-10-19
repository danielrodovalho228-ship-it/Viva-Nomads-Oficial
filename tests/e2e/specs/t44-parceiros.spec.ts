import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { TAXA_PARCERIA_TEXTO } from "../../../src/lib/atendimento/parceiros-texto";
import { contatoLiberado, podeAceitar } from "../../../src/lib/fotografos/regras";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T44 — PARCEIROS (laboratório, ordem 225d0648).
 *  1. /parceiros: o formulário "Quero ser parceiro" grava o interesse (e recusa contato inválido).
 *  2. Busca de fotógrafos por cidade/CEP: só APROVADOS, só da região buscada (Uberlândia ≠ Belém).
 *  3. Pedido do dono: entra como "enviado", sem taxa paga; observação com telefone é recusada; 2º pedido aberto ao mesmo
 *     fotógrafo é barrado.
 *  4. Aceite: o BANCO recusa "aceito" sem taxa paga (contato do dono só depois do pagamento); com a taxa paga passa.
 *  5. O contato do fotógrafo (fotografos_contato) não é lido por visitante.
 *  6. Taxa de parceria 40 / 60 / 80 (até 20, 21 a 40, acima de 40 fotos) nos textos oficiais.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.parc.${sufixo}@lab.vivanomads.test`, nome: "Paula Parceira", role: "owner" as const };
const ids: { dono?: string; udi?: string; belem?: string; pendente?: string } = {};
const nomeUdi = `Foto Udi ${sufixo}`;
const nomeBelem = `Foto Belem ${sufixo}`;
const nomePend = `Foto Pendente ${sufixo}`;

async function novoFotografo(nome: string, cidades: string[], aprovado: boolean): Promise<string> {
  const { data, error } = await adm()
    .from("fotografos")
    .insert({ nome_comercial: nome, cidades, pacote_fotos: 20, pacote_prazo_dias: 3, pacote_preco: 450, aprovado, aprovado_em: aprovado ? new Date().toISOString() : null })
    .select("id")
    .single();
  if (error) throw error;
  await adm().from("fotografos_contato").insert({ fotografo_id: data.id, email: `contato.${sufixo}@lab.vivanomads.test`, whatsapp: "31999990000" });
  return data.id as string;
}

test.describe("T44 — Parceiros", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.udi = await novoFotografo(nomeUdi, ["Uberlândia"], true);
    ids.belem = await novoFotografo(nomeBelem, ["Belém"], true);
    ids.pendente = await novoFotografo(nomePend, ["Uberlândia"], false);
  });

  test.afterAll(async () => {
    await adm().from("fotografo_pedidos").delete().eq("owner_id", ids.dono ?? "");
    await adm().from("fotografos").delete().in("id", [ids.udi, ids.belem, ids.pendente].filter(Boolean) as string[]);
    await adm().from("parceiros_interesse").delete().like("nome", `%${sufixo}%`);
    await apagarContas([ids.dono]);
  });

  test("/parceiros: o formulário grava o interesse e recusa contato inválido", async ({ page, request }) => {
    await page.goto("/parceiros", { waitUntil: "networkidle" });
    await page.getByLabel("Tipo de parceria").selectOption("fotografo");
    await page.getByLabel("Seu nome ou nome da empresa").fill(`Estúdio Lab ${sufixo}`);
    await page.getByLabel("Cidade", { exact: true }).fill("Uberlândia");
    await page.getByLabel("UF").selectOption("MG");
    await page.getByLabel(/WhatsApp \(com DDD\) ou e-mail/).fill(`estudio.${sufixo}@lab.vivanomads.test`);
    await page.getByLabel(/Aceito que a Viva Nomads entre em contato/).check();
    await page.getByRole("button", { name: "Quero ser parceiro" }).click();
    await expect(page.getByText("Recebemos seu interesse.")).toBeVisible({ timeout: 20_000 });
    const { data } = await adm().from("parceiros_interesse").select("tipo, status").like("nome", `%${sufixo}%`);
    expect(data).toEqual([{ tipo: "fotografo", status: "novo" }]);

    const ruim = await request.post("/api/parceiros-interesse", { data: { tipo: "fotografo", nome: "Fulano", cidade: "Belém", uf: "PA", contato: "não é contato", aceite: true } });
    expect(ruim.status()).toBe(400);
  });

  test("prompt 14: o formulário aceita o tipo 'mobilia' (Mobília, enxoval e mudança) vindo do cartão", async ({ page }) => {
    await page.goto("/parceiros?tipo=mobilia#quero-ser-parceiro", { waitUntil: "networkidle" });
    await expect(page.getByLabel("Tipo de parceria")).toHaveValue("mobilia");
    await page.getByLabel("Seu nome ou nome da empresa").fill(`Mudanças Lab ${sufixo}`);
    await page.getByLabel("Cidade", { exact: true }).fill("Uberlândia");
    await page.getByLabel("UF").selectOption("MG");
    await page.getByLabel(/WhatsApp \(com DDD\) ou e-mail/).fill(`mudancas.${sufixo}@lab.vivanomads.test`);
    await page.getByLabel(/Aceito que a Viva Nomads entre em contato/).check();
    await page.getByRole("button", { name: "Quero ser parceiro" }).click();
    await expect(page.getByText("Recebemos seu interesse.")).toBeVisible({ timeout: 20_000 });
    const { data } = await adm().from("parceiros_interesse").select("tipo").like("nome", `Mudanças Lab ${sufixo}`);
    expect(data).toEqual([{ tipo: "mobilia" }]);
  });

  for (const largura of [390, 1280]) {
    test(`prompt 14: 6 cartões com foto carregada, grade ${largura === 1280 ? "3 + 3" : "em 1 coluna"} e sem rolagem lateral (${largura}px)`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/parceiros", { waitUntil: "networkidle" });
      const lista = page.getByTestId("parceiros-tipos");
      const cartoes = lista.locator(":scope > li");
      await expect(cartoes).toHaveCount(6);
      await expect(page.getByTestId("parceiros-foto-pendente")).toHaveCount(0);
      await lista.scrollIntoViewIfNeeded();
      for (let i = 0; i < 6; i++) {
        const img = cartoes.nth(i).locator("img").first();
        await img.scrollIntoViewIfNeeded();
        await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
      }
      const tops = await cartoes.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
      const linhas = new Set(tops).size;
      expect(linhas).toBe(largura === 1280 ? 2 : 6);
      await expect(page.getByTestId("parceiros-numeros").locator(":scope > div")).toHaveCount(4);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await lista.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `tests/laboratorio/saida/t44-parceiros-cartoes-${largura}.png`, fullPage: false });
    });
  }

  test("busca por cidade e por CEP de outra região: só aprovados da região", async ({ page }) => {
    await page.goto("/parceiros/fotografos?cidade=Uberl%C3%A2ndia&uf=MG", { waitUntil: "networkidle" });
    await expect(page.getByText(nomeUdi)).toBeVisible();
    await expect(page.getByText(nomeBelem)).toHaveCount(0);
    await expect(page.getByText(nomePend)).toHaveCount(0); // ainda não aprovado

    await page.goto("/parceiros/fotografos?cep=66010000&cidade=Bel%C3%A9m&uf=PA", { waitUntil: "networkidle" });
    await expect(page.getByText(nomeBelem)).toBeVisible();
    await expect(page.getByText(nomeUdi)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Entrar para pedir" }).first()).toBeVisible(); // visitante
  });

  test("dono pede o fotógrafo: entra como 'enviado', sem taxa; telefone na observação é recusado; 2º pedido aberto é barrado", async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await entrar(browser, dono.email, senha);
    const url = "/parceiros/fotografos?cep=38400000&cidade=Uberl%C3%A2ndia&uf=MG";
    const card = () => page.locator("li", { hasText: nomeUdi });

    await page.goto(url, { waitUntil: "networkidle" });
    const data = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    await card().getByLabel("Data sugerida").fill(data);
    await card().getByLabel(/Observação/).fill("Me liga no 34 98888-7777");
    await card().getByRole("button", { name: "Pedir este fotógrafo" }).click();
    await expect(card().getByRole("alert")).toContainText(/telefone, e-mail ou link/);
    expect((await adm().from("fotografo_pedidos").select("id").eq("owner_id", ids.dono!)).data).toHaveLength(0);

    await card().getByLabel(/Observação/).fill("Apartamento com boa luz natural pela manhã.");
    await card().getByRole("button", { name: "Pedir este fotógrafo" }).click();
    await expect.poll(async () => (await adm().from("fotografo_pedidos").select("id").eq("owner_id", ids.dono!)).data?.length ?? 0, { timeout: 20_000 }).toBe(1);
    const { data: p } = await adm().from("fotografo_pedidos").select("status, taxa_paga_em, owner_id").eq("owner_id", ids.dono!).single();
    expect(p).toMatchObject({ status: "enviado", taxa_paga_em: null, owner_id: ids.dono });

    await page.goto(url, { waitUntil: "networkidle" });
    await card().getByLabel("Data sugerida").fill(data);
    await card().getByRole("button", { name: "Pedir este fotógrafo" }).click();
    await expect(card().getByRole("alert")).toContainText(/pedido aberto/);
    await page.context().close();
  });

  test("aceite só com a taxa paga: o banco recusa 'aceito' sem pagamento; a regra libera o contato só depois", async () => {
    const { data: pedido } = await adm().from("fotografo_pedidos").select("id").eq("owner_id", ids.dono!).single();
    const semTaxa = await adm().from("fotografo_pedidos").update({ status: "aceito" }).eq("id", pedido!.id);
    expect(semTaxa.error?.code).toBe("23514");
    expect(contatoLiberado({ status: "enviado", taxa_paga_em: null })).toBe(false);
    expect(podeAceitar({ status: "enviado", taxa_paga_em: null })).toBe(false);

    const agora = new Date().toISOString();
    const comTaxa = await adm().from("fotografo_pedidos").update({ status: "aceito", taxa_valor: 40, taxa_paga_em: agora }).eq("id", pedido!.id);
    expect(comTaxa.error).toBeNull();
    expect(contatoLiberado({ status: "aceito", taxa_paga_em: agora })).toBe(true);
  });

  test("contato do fotógrafo não é lido por visitante; só os aprovados aparecem na vitrine pública", async () => {
    const anon = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    const contato = await anon.from("fotografos_contato").select("email, whatsapp");
    expect(contato.data ?? []).toHaveLength(0);
    const vitrine = await anon.from("fotografos").select("nome_comercial").like("nome_comercial", `%${sufixo}`);
    expect((vitrine.data ?? []).map((f) => f.nome_comercial).sort()).toEqual([nomeBelem, nomeUdi].sort());
  });

  test("taxa de serviço nos textos oficiais: 10% para todas as categorias, sem a taxa fixa por faixa de fotos", () => {
    // Complemento do P29, item 1: a taxa fixa dos fotógrafos saiu.
    expect(TAXA_PARCERIA_TEXTO).toMatch(/Taxa de serviço: 10% sobre o valor do serviço, para todas as categorias\./);
    expect(TAXA_PARCERIA_TEXTO).toMatch(/90% direto ao parceiro e 10% à Viva/);
    expect(TAXA_PARCERIA_TEXTO).toMatch(/A Viva não guarda o dinheiro/);
    expect(TAXA_PARCERIA_TEXTO).not.toMatch(/R\$ ?(40|60|80)(?![\d.,])/);
  });
});
