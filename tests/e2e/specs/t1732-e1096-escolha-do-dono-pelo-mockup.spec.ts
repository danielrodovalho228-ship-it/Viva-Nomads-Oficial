import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1732 — E1096 @E1096 (ORDEM-DUET-453): a escolha do avaliador pelo dono conforme o mockup aprovado
  (docs/mockups-avaliadores/dono-escolha-avaliador-*.webp). Só contas de teste; cidade própria do spec (Ituiutaba).
   1. O dono pede a avaliação e vê "Escolher avaliador", com um cartão por avaliador: o novo traz cinco estrelas vazias e
      "Novo na Viva"; o que já tem nota de conduta publicada traz as estrelas cheias e "nota (N avaliações)". O preço do
      cartão é o da tabela da cidade; o botão diz "Escolher". A frase do valor fica SOB os cartões e diz que a tabela é
      referência e que o valor de cada avaliador aparece depois de ele aceitar o pedido. Print a 390 e a 1280 px.
   2. "Escolher" funciona: o pedido fica com o avaliador escolhido.
  E1096 (lacuna A da ORDEM-DUET-618/623): o avaliador com avaliações feitas e AINDA sem nota de conduta publicada traz as
  estrelas vazias e só a contagem ("1 avaliação") — nunca "Novo na Viva", que é de quem não tem avaliação nenhuma.
      "Identidade verificada pela Viva" aparece no cartão só de quem tem a identidade confirmada (ORDEM-DUET-460).
  O perfil público do credenciado não entra aqui: é do E1099 (ORDEM-DUET-458/460).
  Laboratório; não é prova ao vivo no site.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Ituiutaba";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1732.${sufixo}@lab.vivanomads.test`, nome: "Dalva Escolhe", role: "owner" as const };
const outro = { email: `outro.t1732.${sufixo}@lab.vivanomads.test`, nome: "Otto Antigo", role: "owner" as const };
const novo = { email: `novo.t1732.${sufixo}@lab.vivanomads.test`, nome: "Nina Nova", role: "tenant" as const };
const comNota = { email: `nota.t1732.${sufixo}@lab.vivanomads.test`, nome: "Caio Conduta", role: "tenant" as const };
const semNota = { email: `semnota.t1732.${sufixo}@lab.vivanomads.test`, nome: "Sara Sem Nota", role: "tenant" as const };
const ids: Record<string, string> = {};
const numeros: Record<string, string> = {};
const FRASE = "Valor de referência da cidade: R$ 350,00 (faixa de R$ 280,00 a R$ 438,00). O valor e o prazo de cada avaliador aparecem depois que ele aceitar o pedido; você aceita ou escolhe outro.";

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}

/** Avaliador credenciado ativo na cidade do spec, dentro do piloto (como na t1722). */
async function credenciar(chave: "novo" | "comNota" | "semNota", conta: { nome: string }, uid: string) {
  const { data: parc, error: eP } = await adm()
    .from("parceiros")
    .insert({ user_id: uid, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: conta.nome, slug: `${chave.toLowerCase()}-t1732-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
    .select("id")
    .single();
  if (eP) throw eP;
  ids[`parc_${chave}`] = parc.id as string;
  const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
  numeros[chave] = n as string;
  const { data: cred, error: eC } = await adm()
    .from("avaliadores_credenciamento")
    .insert({ parceiro_id: parc.id, cidade: CIDADE, numero_credenciado: numeros[chave], status: "ativo", experiencia_link: `https://portfolio.lab.vivanomads.test/t1732-${chave}`, conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
    .select("id")
    .single();
  if (eC) throw eC;
  ids[`cred_${chave}`] = cred.id as string;
  const pa = await adm().from("vistoria_piloto").insert({ user_id: uid, nota: "T1732 (laboratório)" });
  if (pa.error) throw pa.error;
}

test.describe("T1732 — E1096: a escolha do avaliador pelo dono conforme o mockup @E1096", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    for (const [k, c] of [["dono", dono], ["outro", outro], ["novo", novo], ["comNota", comNota], ["semNota", semNota]] as const) {
      ids[k] = await criarConta(c, senha);
      const t = await adm().from("profiles").update({ is_teste: true }).eq("id", ids[k]);
      if (t.error) throw t.error;
    }
    await credenciar("novo", novo, ids.novo);
    await credenciar("comNota", comNota, ids.comNota);
    await credenciar("semNota", semNota, ids.semNota);
    // Imóvel de 1 quarto (porte "1 ou 2 quartos") na cidade do spec; a tabela da cidade com os 3 portes.
    ids.imovel = await criarImovelPronto(ids.dono, `Casa t1732 ${sufixo}`, { ativo: true });
    ids.imovelAntigo = await criarImovelPronto(ids.outro, `Casa antiga t1732 ${sufixo}`, { ativo: true });
    const c = await adm().from("properties").update({ city: CIDADE }).in("id", [ids.imovel, ids.imovelAntigo]);
    if (c.error) throw c.error;
    const { error: eT } = await adm()
      .from("vistoria_precos")
      .insert(["estudio", "q1_2", "q3_mais"].map((porte) => ({ cidade: CIDADE, porte, valor: porte === "q1_2" ? 350 : 300 })));
    if (eT) throw eT;
    const p = await adm().from("vistoria_piloto").insert({ user_id: ids.dono, nota: "T1732 (laboratório)" });
    if (p.error) throw p.error;

    // A nota de conduta PUBLICADA do "Caio": uma avaliação antiga, de outro dono, com laudo emitido e a conduta 5/4/5
    // (média 4,7). A publicação segue a regra do banco (a função de publicar; aqui, a data posta pela massa).
    const agora = new Date().toISOString();
    const { data: ped, error: ePed } = await adm()
      .from("vistoria_pedidos")
      .insert({ property_id: ids.imovelAntigo, owner_id: ids.outro, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, status: "laudo_emitido", avaliador_id: ids.cred_comNota, designado_em: agora })
      .select("id")
      .single();
    if (ePed) throw ePed;
    ids.pedidoAntigo = ped.id as string;
    const { error: eL } = await adm()
      .from("vistoria_laudos")
      .insert({ pedido_id: ped.id, pedido_versao_id: ped.id, property_id: ids.imovelAntigo, owner_id: ids.outro, avaliador_id: ids.cred_comNota, numero: `VN-LD-T1732-${sufixo}`.toUpperCase(), resultado: "aprovado", nivel_sustentado: "conforto", vistoriado_em: agora, teste: true });
    if (eL) throw eL;
    const { error: eK } = await adm().from("vistoria_conduta").insert({ pedido_id: ped.id, autor: "dono", avaliador_id: ids.cred_comNota, pontualidade: 5, cordialidade: 4, cuidado: 5 });
    if (eK) throw eK;
    const { error: ePub } = await adm().from("vistoria_conduta").update({ publicada_em: agora }).eq("pedido_id", ped.id).eq("autor", "dono");
    if (ePub) throw ePub;
    // E1096 (lacuna A): a "Sara" tem uma avaliação feita (laudo emitido, pedido real) e nenhuma nota de conduta publicada.
    const { error: eS } = await adm()
      .from("vistoria_pedidos")
      .insert({ property_id: ids.imovelAntigo, owner_id: ids.outro, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, status: "laudo_emitido", avaliador_id: ids.cred_semNota, designado_em: agora });
    if (eS) throw eS;
    // A identidade confirmada do "Caio" (o fato que a linha do cartão lê); a "Nina" fica sem.
    const ate = new Date(Date.now() + 300 * 86_400_000).toISOString();
    const { error: eV } = await adm()
      .from("tenant_verifications")
      .insert({ tenant_id: ids.comNota, caf_result: { identity: true, document: true, liveness: true, light: "green", simulado: true }, traffic_light: "green", created_at: agora, valid_until: ate });
    if (eV) throw eV;
  });

  test.afterAll(async () => {
    const imoveis = [ids.imovel, ids.imovelAntigo].filter(Boolean);
    if (imoveis.length) {
      await adm().from("vistoria_laudos").delete().in("property_id", imoveis);
      await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    }
    await adm().from("vistoria_precos").delete().eq("cidade", CIDADE);
    const contas = [ids.dono, ids.outro, ids.novo, ids.comNota, ids.semNota].filter(Boolean);
    if (contas.length) {
      await adm().from("vistoria_piloto").delete().in("user_id", contas);
      await adm().from("tenant_verifications").delete().in("tenant_id", contas);
    }
    const creds = [ids.cred_novo, ids.cred_comNota, ids.cred_semNota].filter(Boolean);
    if (creds.length) {
      await adm().from("vistoria_designacoes").delete().in("avaliador_id", creds);
      await adm().from("avaliadores_credenciamento").delete().in("id", creds);
    }
    if (imoveis.length) await adm().from("properties").delete().in("id", imoveis);
    await apagarContas(contas);
  });

  test("1. 'Escolher avaliador': estrelas, 'Novo na Viva', o preço da tabela, 'Escolher' e a frase do valor sob os cartões", async ({ browser }) => {
    const d = await entrar(browser, dono.email, senha);
    await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
    await d.getByTestId("pedir-avaliacao").getByRole("button", { name: "Pedir avaliação do imóvel" }).click({ timeout: 25_000 });
    await expect
      .poll(async () => ((await adm().from("vistoria_pedidos").select("status").eq("property_id", ids.imovel).maybeSingle()).data?.status as string | undefined) ?? "", { timeout: 20_000 })
      .toBe("pedido");
    for (const w of LARGURAS) {
      await largura(d, w);
      await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
      const escolha = d.getByTestId("avaliacao-escolha");
      await expect(escolha).toBeVisible({ timeout: 30_000 });
      await expect(escolha.getByTestId("avaliacao-escolha-titulo")).toHaveText("Escolher avaliador");
      await expect(escolha.getByTestId("avaliacao-escolha-cidade")).toHaveText(`Avaliadores disponíveis em ${CIDADE}`);

      // O avaliador novo: cinco estrelas, nenhuma cheia, e "Novo na Viva".
      const cNovo = escolha.getByTestId("avaliacao-sugerido").filter({ hasText: `nº ${numeros.novo}` });
      await expect(cNovo.getByTestId("avaliacao-sugerido-estrelas")).toHaveAttribute("data-cheias", "0");
      await expect(cNovo.getByTestId("avaliacao-sugerido-estrelas").locator("svg")).toHaveCount(5);
      await expect(cNovo.getByTestId("avaliacao-sugerido-reputacao")).toHaveText("Novo na Viva");
      await expect(cNovo.getByTestId("avaliacao-sugerido-preco")).toHaveText("Avaliação: R$ 350");
      await expect(cNovo.getByRole("button", { name: "Escolher Nina Nova" })).toHaveText("Escolher");
      await expect(cNovo.getByTestId("avaliacao-sugerido-identidade"), "sem a identidade confirmada, a frase não aparece").toHaveCount(0);

      // O avaliador com nota de conduta publicada (5, 4 e 5 → 4,7): cinco estrelas cheias e a nota com a contagem.
      const cNota = escolha.getByTestId("avaliacao-sugerido").filter({ hasText: `nº ${numeros.comNota}` });
      await expect(cNota.getByTestId("avaliacao-sugerido-estrelas")).toHaveAttribute("data-cheias", "5");
      await expect(cNota.getByTestId("avaliacao-sugerido-reputacao")).toHaveText("4,7 (1 avaliação)");
      await expect(cNota.getByTestId("avaliacao-sugerido-reputacao")).not.toContainText("Novo na Viva");
      // E1096 (lacuna A): avaliações feitas, sem nota publicada → estrelas vazias e só a contagem; não é "Novo na Viva".
      const cSemNota = escolha.getByTestId("avaliacao-sugerido").filter({ hasText: `nº ${numeros.semNota}` });
      await expect(cSemNota.getByTestId("avaliacao-sugerido-estrelas"), "sem nota: estrelas vazias").toHaveAttribute("data-cheias", "0");
      await expect(cSemNota.getByTestId("avaliacao-sugerido-reputacao"), "sem nota: só a contagem").toHaveText("1 avaliação");
      await expect(cNota.getByRole("button", { name: "Escolher Caio Conduta" })).toHaveText("Escolher");
      await expect(cNota.getByTestId("avaliacao-sugerido-identidade")).toHaveText("Identidade verificada pela Viva");

      // O texto antigo saiu; a frase do valor está SOB os cartões, com a referência e o "depois de aceitar".
      await expect(escolha).not.toContainText("Escolher este avaliador");
      await expect(escolha).not.toContainText("Cada avaliador define o próprio valor");
      const frase = escolha.getByTestId("avaliacao-faixa");
      await expect(frase).toHaveText(FRASE);
      // Medido de uma vez só, dentro da página (a página ainda pode estar a acomodar o resto do conteúdo).
      const sobOsCartoes = await escolha.evaluate((el) => {
        const f = el.querySelector('[data-testid="avaliacao-faixa"]')!.getBoundingClientRect();
        const cartoes = [...el.querySelectorAll('[data-testid="avaliacao-sugerido"]')];
        return cartoes.length >= 2 && cartoes.every((c) => f.top >= c.getBoundingClientRect().bottom - 1);
      });
      expect(sobOsCartoes, "a frase do valor fica abaixo de todos os cartões").toBe(true);
      expect(await d.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), "sem rolagem lateral").toBeLessThanOrEqual(1);
      await escolha.scrollIntoViewIfNeeded();
      await escolha.screenshot({ path: `${SAIDA}/t1732-1-escolha-${w}.png` });
    }
    await d.context().close();
  });

  test("2. 'Escolher' escolhe: o pedido fica com o avaliador do cartão", async ({ browser }) => {
    const d = await entrar(browser, dono.email, senha);
    await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
    const escolha = d.getByTestId("avaliacao-escolha");
    await expect(escolha).toBeVisible({ timeout: 30_000 });
    await escolha.getByTestId("avaliacao-sugerido").filter({ hasText: `nº ${numeros.comNota}` }).getByRole("button", { name: "Escolher" }).click();
    await expect
      .poll(async () => (await adm().from("vistoria_pedidos").select("status, avaliador_id").eq("property_id", ids.imovel).maybeSingle()).data, { timeout: 30_000 })
      .toMatchObject({ status: "designado", avaliador_id: ids.cred_comNota });
    await d.context().close();
  });
});
