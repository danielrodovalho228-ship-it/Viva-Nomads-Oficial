import { createHash } from "node:crypto";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { gerarCodigoTotp } from "../fixtures/totp";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, adm, apagarContas, cpfAleatorio, criarConta, criarImovelPronto, entrar, fotosDoRoteiro, liberarLimiteLogin, liberarLimiteLoginIp, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { ITENS_CHECKLIST } from "../../../src/config/checklist-avaliacao";

/*
  T1743 — E1121 @E1121 (ORDEM-DUET-523): o caminho de leitura do laudo a partir da Central.
  Na ronda, o laudo aparecia em "Laudos recentes" (/admin/avaliadores), mas o link devolvia {"error":"Não encontrado."}
  à conta observadora da QA, e a página /conferir não mostrava nível, resultado nem hash.
  Massa própria, só contas de teste: um avaliador do piloto (sem CNPJ) emite um laudo de verdade pela tela — visita
  concluída, nível "Conforto" escolhido, assinado — e a observadora da QA (admin com o código do app) abre a Central.
   1. O link do laudo em "Laudos recentes" abre o PDF para a observadora (200, application/pdf, bytes de PDF).
   2. /conferir/<código> mostra o nível, o resultado e o hash — e o hash é o do PDF que o link entrega.
  Laboratório; não é prova ao vivo no site.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const CIDADE = `Uberlândia t1743 ${sufixo}`;
const conta = (p: string, nome: string, role: "owner" | "tenant" = "tenant") => ({ email: `${p}.t1743.${sufixo}@lab.vivanomads.test`, nome, role });
const aval = conta("av", "Paula Piloto Teste");
const dono = conta("dono", "Dora Dona Teste", "owner");
const emailObs = `qa+t1743${sufixo}-observador@lab.vivanomads.test`;
const ids: Record<string, string> = {};
let cred = "";
let pedido = "";
let segredo = "";
const laudo: { id?: string; numero?: string; codigo?: string; hash?: string } = {};
const IMOVEL = { lat: -18.9186, lng: -48.2772 };
const PERTO = { latitude: -18.9178, longitude: -48.2772 };

const statusDo = async (id: string) => (await adm().from("vistoria_pedidos").select("status").eq("id", id).single()).data?.status as string | undefined;

/** O avaliador conclui a visita, escolhe o nível e assina: o laudo sai (o caminho da t2221). */
async function emitirLaudo(browser: Browser) {
  const p = await entrar(browser, aval.email, senha);
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(p.url()).origin }]);
  await p.context().grantPermissions(["geolocation"]);
  await p.context().setGeolocation(PERTO);
  await fotosDoRoteiro(pedido);
  await p.goto(`/dashboard/parceiro/avaliacao/${pedido}`, { waitUntil: "domcontentloaded" });
  await p.getByTestId("concluir-visita").getByRole("button", { name: "Concluir a visita" }).click();
  await expect.poll(() => statusDo(pedido), { timeout: 20_000 }).toBe("realizada");
  await p.reload({ waitUntil: "domcontentloaded" });
  const form = p.getByTestId("enviar-laudo");
  await form.getByTestId("laudo-nivel-conforto").click({ timeout: 20_000 });
  await p.getByTestId("assino-laudo").getByRole("checkbox").check();
  await form.getByRole("button", { name: "Assinar laudo" }).click();
  await expect.poll(() => statusDo(pedido), { timeout: 30_000 }).toBe("laudo_emitido");
  await p.context().close();
}

/** A observadora da QA entra com senha e o código do app, e abre a Central dos avaliadores. */
async function entrarObservadora(browser: Browser, largura: 390 | 1280): Promise<Page> {
  await liberarLimiteLogin(emailObs);
  await liberarLimiteLoginIp();
  const ctx = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
  const page = await ctx.newPage();
  await page.goto("/auth?senha=1", { waitUntil: "domcontentloaded" });
  const campoEmail = page.locator('input[name="email"], input[type="email"]').first();
  const campoSenha = page.locator('input[name="password"], input[type="password"]').first();
  await expect(async () => {
    if (/verificar-codigo|\/dashboard|\/admin/.test(page.url())) return;
    if ((await campoEmail.inputValue({ timeout: 5_000 })) !== emailObs) await campoEmail.fill(emailObs, { timeout: 5_000 });
    if ((await campoSenha.inputValue({ timeout: 5_000 })) !== senha) await campoSenha.fill(senha, { timeout: 5_000 });
    await page.locator("form").getByRole("button", { name: /^entrar$/i }).click({ timeout: 5_000 });
    await page.waitForURL(/verificar-codigo|\/dashboard|\/admin/, { timeout: 15_000 });
  }).toPass({ timeout: 50_000 });
  await page.goto("/admin/avaliadores", { waitUntil: "domcontentloaded" });
  if (/verificar-codigo/.test(page.url())) {
    await page.locator("#codigo-2fa").fill(gerarCodigoTotp(segredo));
    await page.getByRole("button", { name: /confirmar e entrar/i }).click();
    await page.waitForURL(/\/admin\/avaliadores/, { timeout: 30_000 });
  }
  return page;
}

test.describe("T1743 — E1121: o link do laudo na Central abre o PDF e o /conferir mostra nível, resultado e hash @E1121", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async ({ browser }, info) => {
    if (info.project.name !== "chromium") return;
    test.setTimeout(420_000);
    ids.aval = await criarConta(aval, senha);
    ids.dono = await criarConta(dono, senha);
    ids.obs = await criarConta({ email: emailObs, nome: "Olga Observadora", role: "tenant" }, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.aval, ids.dono, ids.obs]);
    const { data: parc, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.aval, tipo_pessoa: "pf", documento: cpfAleatorio().replace(/\D/g, ""), nome_publico: aval.nome, slug: `aval-t1743-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (error) throw error;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: c, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: parc.id, cidade: CIDADE, numero_credenciado: n, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test", conduta_versao: "2026-10-23", ativado_em: new Date().toISOString() })
      .select("id")
      .single();
    if (eC) throw eC;
    cred = c.id as string;
    const { error: eP } = await adm().from("vistoria_piloto").upsert({ user_id: ids.aval, nota: "laboratório t1743" }, { onConflict: "user_id" });
    if (eP) throw eP;
    const horas = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
    ids.imovel = await criarImovelPronto(ids.dono, `Studio T1743 ${sufixo}`, { ativo: true });
    await adm().from("properties").update({ city: CIDADE, lat: IMOVEL.lat, lng: IMOVEL.lng, lat_exata: IMOVEL.lat, lng_exata: IMOVEL.lng }).eq("id", ids.imovel);
    const { data: p, error: eD } = await adm()
      .from("vistoria_pedidos")
      .insert({ property_id: ids.imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 250, status: "agendado", avaliador_id: cred, designado_em: horas(-30), agendado_para: horas(-2), teste: false })
      .select("id")
      .single();
    if (eD) throw eD;
    pedido = p.id as string;
    await adm().from("vistoria_designacoes").insert({ pedido_id: pedido, avaliador_id: cred, resposta: "aceita", respondido_em: horas(-29) });
    await adm().from("vistoria_checklist").upsert(
      ITENS_CHECKLIST.map((i) => ({ pedido_id: pedido, chave: i.chave, valor: "tipo" in i && i.tipo === "limpeza" ? "pronto" : "conforme", observacao: null })),
      { onConflict: "pedido_id,chave" },
    );
    await adm().from("vistoria_pedidos").update({ ruido_respostas: { via_intensa: false, noturno_obra_100m: false, aviao_ferrovia: false, isolamento_acustico: false } }).eq("id", pedido);

    await emitirLaudo(browser);
    const { data: l } = await adm().from("vistoria_laudos").select("id, numero, documento_id, nivel_sustentado, resultado, pdf_path").eq("pedido_id", pedido).single();
    expect(l?.pdf_path, "preparo: o PDF do laudo ficou guardado").toBeTruthy();
    expect(l?.nivel_sustentado).toBe("conforto");
    expect(l?.resultado).toBe("aprovado");
    const { data: reg } = await adm().from("documentos_registro").select("codigo_verificacao, hash_sha256").eq("id", l!.documento_id).single();
    Object.assign(laudo, { id: l!.id, numero: l!.numero, codigo: reg!.codigo_verificacao, hash: reg!.hash_sha256 });

    // A observadora da QA: admin com o código do app (só cabe uma por vez: espera outra spec soltar a dela).
    await expect
      .poll(async () => (await adm().rpc("promover_qa_admin", { p_id: ids.obs })).error?.message ?? "ok", { timeout: 180_000, intervals: [5_000] })
      .toBe("ok");
    const cli = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    const { error: eLogin } = await cli.auth.signInWithPassword({ email: emailObs, password: senha });
    if (eLogin) throw eLogin;
    const { data: fator, error: eEnroll } = await cli.auth.mfa.enroll({ factorType: "totp", friendlyName: "qa-observador-t1743" });
    if (eEnroll) throw eEnroll;
    segredo = fator!.totp.secret;
    const { data: desafio } = await cli.auth.mfa.challenge({ factorId: fator!.id });
    const { error: eVer } = await cli.auth.mfa.verify({ factorId: fator!.id, challengeId: desafio!.id, code: gerarCodigoTotp(segredo) });
    if (eVer) throw eVer;
  });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (uma conta observadora por vez)");
  });

  test.afterAll(async () => {
    if (ids.obs) await adm().rpc("revogar_qa_admin", { p_id: ids.obs });
    if (pedido) {
      await adm().from("vistoria_laudos").delete().eq("pedido_id", pedido);
      await adm().from("vistoria_checklist").delete().eq("pedido_id", pedido);
      await adm().from("vistoria_checklist_fotos").delete().eq("pedido_id", pedido);
      await adm().from("vistoria_designacoes").delete().eq("pedido_id", pedido);
      await adm().from("vistoria_pedidos").delete().eq("id", pedido);
    }
    if (ids.aval) await adm().from("vistoria_piloto").delete().eq("user_id", ids.aval);
    if (cred) await adm().from("avaliadores_credenciamento").delete().eq("id", cred);
    await apagarContas([ids.obs, ids.aval, ids.dono].filter(Boolean));
  });

  test("1. o link do laudo em 'Laudos recentes' abre o PDF para a observadora da QA", async ({ browser }) => {
    const page = await entrarObservadora(browser, 1280);
    const linha = page.getByTestId("avaliadores-laudos").getByTestId("laudo-admin").filter({ hasText: laudo.numero! });
    await expect(linha).toBeVisible({ timeout: 30_000 });
    const link = linha.getByRole("link", { name: laudo.numero! });
    const href = await link.getAttribute("href");
    expect(href, "o link do laudo tem destino").toBeTruthy();
    await linha.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SAIDA}/t1743-1-laudos-recentes-1280.png` });
    // A mesma sessão da observadora pede o destino do link.
    const resp = await page.request.get(href!);
    const corpo = await resp.body();
    expect(resp.status(), `o link do laudo responde 200 (veio ${resp.status()}: ${corpo.subarray(0, 80).toString()})`).toBe(200);
    expect(resp.headers()["content-type"]).toContain("application/pdf");
    expect(corpo.subarray(0, 5).toString(), "o arquivo é um PDF").toBe("%PDF-");
    // É o mesmo arquivo do registro: o hash dos bytes bate com o hash registrado.
    expect(createHash("sha256").update(corpo).digest("hex"), "o PDF entregue é o registrado").toBe(laudo.hash);
    await page.context().close();
  });

  for (const largura of [390, 1280] as const) {
    test(`2. a ${largura} px: /conferir mostra o nível, o resultado e o hash do laudo`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      await page.goto(`/conferir/${laudo.codigo}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("conferir-numero")).toHaveText(laudo.numero!, { timeout: 30_000 });
      await expect(page.getByTestId("conferir-nivel")).toHaveText("Conforto");
      await expect(page.getByTestId("conferir-resultado")).toHaveText("Aprovado");
      // O hash inteiro (64 caracteres), o mesmo do registro e do PDF que o link entrega.
      await expect(page.getByTestId("conferir-hash")).toHaveText(laudo.hash!);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${largura} px: sem rolagem lateral`).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `${SAIDA}/t1743-2-conferir-${largura}.png`, fullPage: true });
      await ctx.close();
    });
  }
});
