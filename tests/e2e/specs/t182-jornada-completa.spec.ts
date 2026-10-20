import { test, expect, type Page, type Request } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, fotosReais, lerSaida, novaSenha, novoSufixo, pdf, tornarContratoVigente } from "../fixtures/laboratorio";
import { MSG_ASSINATURA_INATIVA, ROTULO_ETAPA } from "../../../src/lib/contrato-etapas";
import { addDiasISO } from "../../../src/lib/contrato-blocos";
import { hojeBR } from "../../../src/lib/utils";

/*
  T182 — JORNADA COMPLETA, do anúncio publicado até a avaliação dos dois lados, sem cobrança real (laboratório).
  Contas NOVAS (dono e inquilina) e um anúncio ativo com fotos reais (fixtures). Inquilina a 390 px, dono a 1280 px;
  cada etapa também fotografada na outra largura.
   1. Inquilina acha o anúncio na /buscar e envia a candidatura pela página do imóvel (tela).
   2. Dono vê "Candidato(a)" em Interessados (sem nome), clica "Aprovar e responder" (tela): aparece o nome curto.
   3. Mensagens: o dono abre a conversa que a candidatura criou e responde; a inquilina lê (tela).
   4. Fechamento pela tela: verificação (portão suave), garantia, "Li e entendi", serviços, patrimonial e
      "Gerar contrato para assinatura". No laboratório não há assinatura digital ativa e as contas são reais: a
      rota responde 503 ANTES de reservar (prompt 24) e a tela diz a verdade (MSG_ASSINATURA_INATIVA), sem registrar
      contrato nem chamar a cobrança da taxa (closing-flow.tsx, generateContract). Daí em diante o contrato é gravado pelo banco, como no t89, e as duas assinaturas +
      o 1º aluguel confirmado vêm do fixture tornarContratoVigente (o que o laboratório já faz; nada é cobrado).
   5. Fim da estadia: o bloco 1 passa a ter terminado ontem e o PRÓPRIO app encerra o contrato quando o dono
      abre Contratos (rpc avancar_ciclo_blocos → "encerrado_sem_renovacao" + encerrado_em), que é um dos
      status em que a avaliação é aceita (0089, pode_avaliar).
   6. Avaliações às cegas pela tela: a inquilina avalia primeiro e a dela NÃO aparece para ninguém; o dono
      avalia e as duas publicam. Cada lado vê a do outro em "Avaliações recebidas"; a página pública do
      proprietário e o anúncio mostram o comentário real.
   7. Sem cobrança: o navegador do dono não chamou /api/comissao nem um provedor de pagamento, não há reserva
      de "comissao" para esta candidatura e nada foi ao ZapSign.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.jornada.${sufixo}@lab.vivanomads.test`, nome: "Otávio Jornada Sobrenomedono", role: "owner" as const };
const inq = { email: `inq.jornada.${sufixo}@lab.vivanomads.test`, nome: "Lia Jornada Sobrenomeoculto", role: "tenant" as const };
const titulo = `Studio da jornada ${sufixo}`;
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string; contrato?: string } = {};
const SAIDA = "tests/laboratorio/saida";
const ALUGUEL = 3200;

// Só letras: número longo no comentário cai (com razão) no filtro de telefone e vai para a moderação.
const letras = () => Array.from({ length: 8 }, () => "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]).join("");
const marcaInq = `Estadia tranquila e anfitriao atencioso ${letras()}`;
const marcaDono = `Inquilina cuidadosa e pontual ${letras()}`;

/** Chamadas do navegador do dono que seriam cobrança (rota da taxa ou provedor de pagamento). */
const cobrancas: string[] = [];
const ehCobranca = (r: Request) => /\/api\/comissao|asaas\.com|api\.asaas|zapsign\.com\.br\/api/i.test(r.url());

async function abrir(page: Page, rota: string) {
  // O painel mantém conexão aberta: "networkidle" não assenta (lab 17/10). Espera o <main>.
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  await page.locator("main").first().waitFor();
  // Hidratação antes de clicar: espera a rede assentar por até 10 s e segue (mesmo padrão do entrar()).
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

async function foto(page: Page, passo: string, larguras: number[] = [390, 1280]) {
  const original = page.viewportSize();
  for (const largura of larguras) {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    await page.waitForTimeout(300);
    expect.soft(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${passo} rola de lado a ${largura}px`).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `${SAIDA}/t182-${passo}-${largura}.png`, fullPage: true });
  }
  if (original) await page.setViewportSize(original);
}

async function comoDono(browser: import("@playwright/test").Browser): Promise<Page> {
  const page = await entrar(browser, dono.email, senha);
  await page.setViewportSize({ width: 1280, height: 900 });
  page.on("request", (r) => {
    if (ehCobranca(r)) cobrancas.push(r.url());
  });
  return page;
}

test.describe("T182 — jornada completa, do anúncio à avaliação dos dois lados, sem cobrança real", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, titulo, { ativo: true, preco: ALUGUEL });
    await fotosReais(ids.imovel, ids.dono);
  });

  test.afterAll(async () => {
    if (ids.lead) await adm().from("cobrancas_fechamento").delete().eq("lead_id", ids.lead);
    if (ids.imovel) await adm().from("messages").delete().eq("property_id", ids.imovel);
    if (ids.dono) await adm().from("leads").delete().eq("owner_id", ids.dono);
    // Contrato, blocos, pagamentos e avaliações saem em cascata com o imóvel (apagarContas).
    await apagarContas([ids.inq, ids.dono]);
  });

  test("1. a inquilina acha o anúncio e envia a candidatura (390 px)", async ({ browser }) => {
    test.setTimeout(150_000);
    const page = await entrar(browser, inq.email, senha);

    // A /buscar guarda cache de 60 s: o anúncio novo pode demorar a entrar. Se não entrar, segue pelo endereço.
    await page.goto("/buscar?ordem=recent", { waitUntil: "domcontentloaded" });
    const link = page.locator(`a[href="/imoveis/${ids.imovel}"]`);
    let achou = true;
    await expect(async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(link.first()).toBeAttached({ timeout: 5_000 });
    })
      .toPass({ intervals: [2_000, 5_000, 10_000], timeout: 75_000 })
      .catch(() => {
        achou = false;
      });
    expect.soft(achou, "o anúncio novo aparece na /buscar (ordem: mais recentes)").toBe(true);
    if (achou) await page.screenshot({ path: `${SAIDA}/t182-1-busca-390.png`, fullPage: false });

    await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(titulo, { timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    // No celular o botão aparece no cartão E na barra fixa (t75): as duas fazem a mesma candidatura.
    await page.getByRole("button", { name: /Enviar candidatura/ }).first().click();
    const passo = page.getByTestId("solicitacao-passo");
    await expect(passo).toBeVisible();
    await passo.getByRole("button", { name: "Continuar" }).click();
    await passo.getByRole("button", { name: "Continuar" }).click();
    await passo.getByRole("button", { name: "Enviar candidatura" }).click();
    await expect(page.getByText("Candidatura enviada").first()).toBeVisible({ timeout: 20_000 });
    await foto(page, "1-candidatura-enviada");

    const { data: lead } = await adm().from("leads").select("id, status").eq("property_id", ids.imovel!).eq("tenant_id", ids.inq!).single();
    expect(lead!.status).toBe("new");
    ids.lead = lead!.id as string;
    await page.context().close();
  });

  test("2. o dono vê 'Candidato(a)', aprova pela tela e passa a ver o nome curto (1280 px)", async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await comoDono(browser);
    await abrir(page, "/dashboard/leads");
    const cartao = page.getByTestId("cartao-candidato").first();
    await expect(cartao.getByTestId("candidato-nome")).toHaveText("Candidato(a)", { timeout: 20_000 });
    const antes = await page.locator("main").innerText();
    expect(antes).not.toMatch(/Lia|Sobrenomeoculto/);
    expect(antes).not.toContain(inq.email);
    await foto(page, "2-candidato-anonimo", [1280, 390]);

    await page.getByRole("button", { name: /Aprovar e responder/i }).first().click();
    await expect.poll(async () => (await adm().from("leads").select("status").eq("id", ids.lead!).single()).data?.status, { timeout: 20_000 }).toBe("accepted");
    await expect(page.getByTestId("aceite-erro")).toHaveCount(0);
    await abrir(page, "/dashboard/leads");
    await expect(page.getByTestId("cartao-candidato").first().getByTestId("candidato-nome")).toHaveText("Lia S.", { timeout: 20_000 });
    expect(await page.locator("main").innerText()).not.toContain("Sobrenomeoculto");
    await foto(page, "2-candidato-aceito", [1280, 390]);
    await page.context().close();
  });

  test("3. mensagens: o dono responde na conversa da candidatura e a inquilina lê", async ({ browser }) => {
    test.setTimeout(120_000);
    const resposta = `Bem-vinda! O studio fica pronto no dia combinado ${letras()}`;
    const pd = await comoDono(browser);
    await abrir(pd, "/dashboard/leads");
    await pd.getByRole("link", { name: /Responder pela plataforma/ }).first().click();
    await expect(pd).toHaveURL(/\/dashboard\/mensagens/);
    await pd.getByRole("button", { name: new RegExp(titulo) }).first().click();
    await expect(pd.getByTestId("conversa-nome")).toHaveText("Lia S.");
    await pd.getByPlaceholder("Escreva uma mensagem...").fill(resposta);
    await pd.getByRole("button", { name: "Enviar" }).click();
    await expect(pd.getByText(resposta).last()).toBeVisible({ timeout: 15_000 });
    await foto(pd, "3-mensagens-dono", [1280, 390]);
    await pd.context().close();

    const pi = await entrar(browser, inq.email, senha);
    await abrir(pi, "/dashboard/mensagens");
    await pi.getByRole("button", { name: new RegExp(titulo) }).first().click();
    await expect(pi.getByTestId("conversa-nome")).toHaveText("Otávio S.");
    await expect(pi.getByText(resposta).last()).toBeVisible({ timeout: 15_000 });
    expect(await pi.locator("main").innerText()).not.toMatch(/Sobrenomedono/);
    await foto(pi, "3-mensagens-inquilina");
    await pi.context().close();
  });

  test("3b. depois do aceite, a inquilina envia identidade e renda pela tela (Minhas candidaturas, 390 px)", async ({ browser }) => {
    test.setTimeout(90_000);
    const pi = await entrar(browser, inq.email, senha);
    await abrir(pi, "/dashboard/candidaturas");
    const bloco = pi.getByTestId("docs-inquilino").filter({ has: pi.getByTestId("doc-inquilino-identidade") }).first();
    await expect(bloco).toBeVisible({ timeout: 20_000 });
    await bloco.getByLabel("Enviar documento de identidade").setInputFiles({ name: "rg.pdf", mimeType: "application/pdf", buffer: pdf() });
    await expect(pi.getByTestId("doc-inquilino-identidade")).toContainText("enviado", { timeout: 20_000 });
    await bloco.getByLabel("Enviar comprovante de renda").setInputFiles({ name: "renda.pdf", mimeType: "application/pdf", buffer: pdf() });
    await expect(pi.getByTestId("doc-inquilino-renda")).toContainText("enviado", { timeout: 20_000 });
    await expect(pi.getByTestId("docs-inquilino-completos")).toBeVisible({ timeout: 20_000 });
    await foto(pi, "3b-documentos-inquilina");
    await pi.context().close();
  });

  test("4. fechamento pela tela até 'Gerar contrato'; sem assinatura ativa, nada é registrado nem cobrado", async ({ browser }) => {
    test.setTimeout(150_000);
    const saidaAntes = (await lerSaida()).length;
    const page = await comoDono(browser);
    await abrir(page, "/dashboard/leads");
    await page.getByRole("link", { name: "Iniciar fechamento" }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/fechamento/);
    await expect(page.getByTestId("inicio-estadia")).toHaveValue(hojeBR(), { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Candidatura e verificação" })).toBeVisible();

    // Etapa 1: portão suave — conta real fica "Verificação pendente" e segue.
    await page.getByRole("button", { name: /verificar identidade/i }).click();
    await expect(page.getByText("Verificação pendente").first()).toBeVisible();
    await page.getByRole("button", { name: /continuar/i }).click();
    // Etapa 2: garantia (caução é a padrão) + "Li e entendi".
    await page.getByRole("radio").and(page.locator(":not([disabled])")).first().click();
    await page.getByTestId("ciente-protecao").check({ timeout: 15_000 });
    await page.getByRole("button", { name: /continuar/i }).click();
    // Etapa 3: serviços (opcionais).
    await expect(page.getByRole("heading", { name: /serviços adicionais/i })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /continuar/i }).click();
    // Etapa 4: patrimonial.
    await page.getByRole("button", { name: /Seguir sem seguro patrimonial/ }).click();
    await page.getByRole("button", { name: /continuar/i }).click();
    // Etapa 5: contrato.
    await expect(page.getByTestId("marca-minuta")).toBeVisible({ timeout: 15_000 });
    await foto(page, "4-fechamento-contrato", [1280, 390]);
    await page.getByRole("button", { name: /Gerar contrato para assinatura/ }).click();
    await expect(page.getByTestId("erro-contrato")).toHaveText(MSG_ASSINATURA_INATIVA, { timeout: 20_000 });
    await foto(page, "4-fechamento-sem-assinatura", [1280, 390]);

    // A tela não registrou contrato nem pediu a cobrança da taxa.
    expect((await adm().from("contratos").select("id").eq("lead_id", ids.lead!)).data ?? []).toHaveLength(0);
    // Prompt 24: conta real sem assinatura digital recebe 503 ANTES de reservar — nenhuma reserva fica presa
    // (o botão continua disponível para quando a assinatura ligar) e nada vai ao ZapSign.
    const reservas = ((await adm().from("cobrancas_fechamento").select("tipo").eq("lead_id", ids.lead!)).data ?? []) as { tipo: string }[];
    expect(reservas, "nenhuma reserva de contrato ou taxa fica marcada").toEqual([]);
    await expect(page.getByRole("button", { name: /Gerar contrato para assinatura/ })).toBeEnabled();
    const novas = (await lerSaida()).slice(saidaAntes);
    expect(novas.some((l) => l.servico === "zapsign"), "nada foi enviado ao ZapSign").toBe(false);
    expect(cobrancas, "o navegador não chamou cobrança nem provedor de pagamento").toEqual([]);
    await page.context().close();
  });

  test("5. contrato registrado e em vigência (fixture), estadia termina e o app encerra o contrato", async ({ browser }) => {
    test.setTimeout(150_000);
    // Registro do contrato como o servidor faria (t89): a tela parou na falta de assinatura digital ativa.
    const { data: lead } = await adm().from("leads").select("accepted_plan, accepted_commission_rate").eq("id", ids.lead!).single();
    const taxa = Number(lead!.accepted_commission_rate ?? 0.12);
    const { data: contrato, error } = await adm()
      .from("contratos")
      .insert({
        lead_id: ids.lead, property_id: ids.imovel, tenant_id: ids.inq, owner_plan: (lead!.accepted_plan as string) ?? "essential", faixa: "media_estadia",
        prazo_total_dias: 60, aluguel_mensal: ALUGUEL, tamanho_bloco_meses: 2, comissao_percent: taxa, comissao_valor: Math.round(ALUGUEL * 2 * taxa * 100) / 100,
        qtd_ocupantes: 1, garantia: "caucao",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    ids.contrato = contrato!.id as string;
    await tornarContratoVigente(ids.contrato, ids.dono!, ALUGUEL);

    // Inquilina: a locação está em vigência (390 e 1280).
    const pi = await entrar(browser, inq.email, senha);
    await abrir(pi, "/dashboard/locacoes");
    await expect(pi.getByTestId("locacao-etapa").first()).toHaveText(ROTULO_ETAPA.em_vigencia, { timeout: 20_000 });
    await foto(pi, "5-locacao-em-vigencia");
    await pi.context().close();

    // Fim da estadia: o bloco 1 acabou ontem. O app encerra o contrato sozinho quando o dono abre Contratos.
    const hoje = hojeBR();
    const { error: eBloco } = await adm().from("contrato_blocos").update({ inicio: addDiasISO(hoje, -60), fim: addDiasISO(hoje, -1) }).eq("contrato_id", ids.contrato);
    expect(eBloco).toBeNull();
    const pd = await comoDono(browser);
    await abrir(pd, "/dashboard/contratos");
    await expect.poll(async () => (await adm().from("contratos").select("status, encerrado_em").eq("id", ids.contrato!).single()).data, { timeout: 20_000 }).toMatchObject({ status: "encerrado_sem_renovacao" });
    const { data: fim } = await adm().from("contratos").select("encerrado_em").eq("id", ids.contrato!).single();
    expect(fim!.encerrado_em).not.toBeNull();
    await abrir(pd, "/dashboard/contratos");
    await foto(pd, "5-contrato-encerrado", [1280, 390]);
    await pd.context().close();
  });

  test("6. avaliações às cegas pela tela: a da inquilina só aparece depois que o dono também avalia", async ({ browser }) => {
    test.setTimeout(180_000);

    // 6a. Inquilina avalia o proprietário (390).
    const pi = await entrar(browser, inq.email, senha);
    await abrir(pi, "/dashboard/locacoes");
    await pi.getByRole("button", { name: "Avaliar o proprietário" }).click();
    await pi.getByRole("radio", { name: "5 estrelas" }).click();
    await pi.getByPlaceholder(/Comentário \(opcional\)/).fill(marcaInq);
    await pi.getByRole("button", { name: "Enviar avaliação" }).click();
    await expect(pi.getByText(/Avaliação enviada\. Ela aparece quando a outra parte também avaliar/)).toBeVisible({ timeout: 20_000 });
    await foto(pi, "6-inquilina-avaliou");
    await pi.context().close();
    const { data: aInq } = await adm().from("avaliacoes").select("status").eq("contrato_id", ids.contrato!).eq("papel_autor", "inquilino").single();
    expect(aInq!.status).toBe("enviada");

    // Às cegas: o dono ainda não vê a avaliação, nem na tela dele nem na página pública.
    const pd = await comoDono(browser);
    await abrir(pd, "/dashboard/avaliacoes");
    await expect(pd.getByText("Nenhuma avaliação publicada ainda")).toBeVisible({ timeout: 20_000 });
    await expect(pd.locator("main")).not.toContainText(marcaInq);
    const anon = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState: { cookies: [], origins: [] } });
    const pub = await anon.newPage();
    await pub.goto(`/proprietario/${ids.dono}`, { waitUntil: "domcontentloaded" });
    await expect(pub.getByTestId("pagina-proprietario")).toBeVisible({ timeout: 20_000 });
    await expect(pub.locator("body")).not.toContainText(marcaInq);

    // 6b. Dono avalia a inquilina (1280).
    await abrir(pd, "/dashboard/contratos");
    await pd.getByRole("button", { name: "Avaliar o inquilino" }).first().click();
    await pd.getByRole("radio", { name: "5 estrelas" }).click();
    await pd.getByPlaceholder(/Comentário \(opcional\)/).fill(marcaDono);
    await pd.getByRole("button", { name: "Enviar avaliação" }).click();
    await expect(pd.getByText(/Avaliação enviada\./)).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(async () => ((await adm().from("avaliacoes").select("status").eq("contrato_id", ids.contrato!)).data ?? []).map((a) => a.status).sort(), { timeout: 20_000 })
      .toEqual(["publicada", "publicada"]);

    // Cada lado vê a do outro em "Avaliações recebidas".
    await abrir(pd, "/dashboard/avaliacoes");
    await expect(pd.getByTestId("avaliacao-recebida").filter({ hasText: marcaInq })).toBeVisible({ timeout: 20_000 });
    await foto(pd, "6-dono-recebeu", [1280, 390]);
    await pd.context().close();
    const pi2 = await entrar(browser, inq.email, senha);
    await abrir(pi2, "/dashboard/avaliacoes");
    await expect(pi2.getByTestId("avaliacao-recebida").filter({ hasText: marcaDono })).toBeVisible({ timeout: 20_000 });
    await foto(pi2, "6-inquilina-recebeu");
    await pi2.context().close();

    // Página pública do proprietário (sem cache) e o anúncio (cache de 60 s: recarrega até entrar), 390 e 1280.
    for (const largura of [390, 1280]) {
      await pub.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await pub.goto(`/proprietario/${ids.dono}`, { waitUntil: "domcontentloaded" });
      await expect(pub.locator("#avaliacoes")).toContainText(marcaInq, { timeout: 20_000 });
      await expect(pub.locator("body")).not.toContainText(marcaDono); // a nota do dono é sobre a inquilina
      await pub.locator("#avaliacoes").scrollIntoViewIfNeeded();
      expect(await pub.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await pub.screenshot({ path: `${SAIDA}/t182-7-perfil-publico-${largura}.png`, fullPage: true });
    }
    for (const largura of [390, 1280]) {
      await pub.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await pub.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
      await expect(async () => {
        await pub.reload({ waitUntil: "domcontentloaded" });
        await expect(pub.getByText(marcaInq)).toBeVisible({ timeout: 3_000 });
      }).toPass({ intervals: [1_000, 5_000, 10_000], timeout: 75_000 });
      await expect(pub.getByText("Inquilino verificado").first()).toBeVisible();
      await pub.getByText(marcaInq).scrollIntoViewIfNeeded();
      await pub.screenshot({ path: `${SAIDA}/t182-7-anuncio-avaliacao-${largura}.png`, fullPage: false });
    }
    await anon.close();
  });

  test("7. sem cobrança real em toda a jornada", async () => {
    // Nenhuma reserva de taxa para esta candidatura (a rota /api/comissao reserva antes de chamar o Asaas).
    const { data } = await adm().from("cobrancas_fechamento").select("tipo").eq("lead_id", ids.lead!);
    expect((data ?? []).map((r) => r.tipo)).not.toContain("comissao");
    // Os pagamentos do contrato são só o aluguel DECLARADO pelo dono e confirmado pela inquilina (direto entre eles).
    const { data: pags } = await adm().from("pagamentos_bloco").select("tipo, marcado_por, confirmado_pelo_inquilino").eq("contrato_id", ids.contrato!);
    expect(pags).toEqual([{ tipo: "aluguel", marcado_por: ids.dono, confirmado_pelo_inquilino: true }]);
    expect(cobrancas, "nenhuma chamada de cobrança saiu do navegador do dono").toEqual([]);
  });
});
