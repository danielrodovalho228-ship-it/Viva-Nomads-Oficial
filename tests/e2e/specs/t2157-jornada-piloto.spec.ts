import { test, expect } from "@playwright/test";
import { preencherPeriodoDaProposta } from "../fixtures/periodo-proposta";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo, pdf } from "../fixtures/laboratorio";
import { abrirCadastroNovo, doTipoAoEndereco, noPasso } from "../fixtures/cadastro";
import { ROTULO_ETAPA } from "../../../src/lib/contrato-etapas";

/*
  T2157 — Jornada do piloto @criticos (ORDEM-DUET-138, item 4: "spec de jornada").
  Percorre a jornada do piloto no laboratório (contas de teste, integrações simuladas), de ponta a ponta, até a última
  etapa APROVADA na sequência crítica do Gerente:
    1 cadastro → 2 anúncio → 3 busca → 4 candidatura/conversa → 5 pré-aceite → 6 proposta → 7 contrato → 8 estadia →
    9 saída/caução → 10 avaliação.
  Roda em todo PR pelo lab-crítico (fluxo "jornada-piloto" em tests/laboratorio/fluxos-criticos.json). PR que deixa a
  jornada vermelha não entra.

  Numeração (ORDEM-DUET-197): cada perna leva o número da sua etapa na sequência validada acima, sem dividir nenhuma etapa;
  uma perna preparada fora de ordem (a 7, contrato, antes da 6, proposta) fica com o seu número e espera a vez.

  Como cresce: a cada item aprovado na sequência, a pista que fez o item acrescenta o passo dele aqui, no mesmo PR do
  item, como um `test("Etapa N — …")` novo no fim do describe (a ordem dos testes é a ordem da jornada; o describe é
  serial e as etapas partilham as contas e os ids de `jornada`). Nenhuma etapa entra antes de ser aprovada.

  Etapa 0 (a porta de entrada, já na main): é o chão de que todas as etapas dependem — o visitante chega à busca com
  resultados e as duas contas do piloto (dono e inquilino) entram pela tela e chegam ao painel. Nenhuma etapa da
  sequência foi aprovada ainda (a fila por etapa do Gerente chega numa ordem seguinte).
*/
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

const sufixo = novoSufixo();
const senha = novaSenha();
const jornada: { dono?: string; inquilino?: string; anuncio?: string; publicado?: string; lead?: string; proposta?: string } = {};
const contas = {
  dono: { email: `t2157-dono-${sufixo}@laboratorio.test`, nome: `Dono Jornada ${sufixo}`, role: "owner" as const },
  inquilino: { email: `t2157-inq-${sufixo}@laboratorio.test`, nome: `Inquilino Jornada ${sufixo}`, role: "tenant" as const },
};

test.describe("T2157 — jornada do piloto, até a última etapa aprovada @criticos", () => {
  test.skip(!NO_LABORATORIO, "só no laboratório (contas de teste e integrações simuladas)");

  test.beforeAll(async () => {
    jornada.dono = await criarConta(contas.dono, senha);
    jornada.inquilino = await criarConta(contas.inquilino, senha);
  });

  test.afterAll(async () => {
    if (jornada.publicado) await adm().from("messages").delete().eq("property_id", jornada.publicado);
    if (jornada.lead) {
      await adm().from("cobrancas_fechamento").delete().eq("lead_id", jornada.lead);
      const { data: cts } = await adm().from("contratos").select("id").eq("lead_id", jornada.lead);
      const cids = ((cts ?? []) as { id: string }[]).map((c) => c.id);
      if (cids.length) await adm().from("caucao_acertos").delete().in("contrato_id", cids);
      if (cids.length) await adm().from("pagamentos_bloco").delete().in("contrato_id", cids);
      await adm().from("contratos").delete().eq("lead_id", jornada.lead);
      await adm().from("propostas").delete().eq("lead_id", jornada.lead);
      await adm().from("leads").delete().eq("id", jornada.lead);
    }
    if (jornada.anuncio) await adm().from("properties").delete().eq("id", jornada.anuncio);
    if (jornada.publicado) await adm().from("properties").delete().eq("id", jornada.publicado);
    await apagarContas([jornada.dono, jornada.inquilino]);
  });

  test("Etapa 0 — o visitante chega à busca com resultados", async ({ page }) => {
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("card-resultado").first(), "a busca do visitante mostra anúncios").toBeVisible({ timeout: 30_000 });
  });

  test("Etapa 0 — dono e inquilino do piloto entram pela tela e chegam ao painel", async ({ browser }) => {
    for (const quem of ["dono", "inquilino"] as const) {
      const page = await entrar(browser, contas[quem].email, senha);
      await expect(page, `${quem}: entra e chega ao painel`).toHaveURL(/\/dashboard/);
      await page.context().close();
    }
  });

  // Etapa 1 (cadastro e conta) entra aqui, no PR do item aprovado.

  // Etapa 2 (anúncio), preparada na ORDEM-DUET-145 e ainda NÃO aprovada: ativa-se quando a etapa 1 estiver provada e a
  // correção do E614 (#4004) entrar. O dono do piloto cria o anúncio pela tela, o rascunho grava no servidor com o
  // indicador "Salvo às HH:MM", e reaberto noutra sessão (sem `etapa`) volta ao passo gravado com o mesmo indicador.
  test("Etapa 2 — o dono cria o anúncio: o rascunho grava com \"Salvo às\" e volta assim ao reabrir", async ({ browser }) => {
    const marca = `T2157 ${sufixo}`;
    const p1 = await entrar(browser, contas.dono.email, senha);
    await abrirCadastroNovo(p1);
    await doTipoAoEndereco(p1);
    await p1.getByTestId("cadastro-rua").fill(`Rua ${marca}`);
    await p1.getByTestId("cadastro-numero").fill("157");
    await p1.locator('input[list="novo-bairros"]').fill(`Bairro ${marca}`);
    const estado = p1.getByTestId("estado-salvamento");
    await expect(estado, "o topo diz que o rascunho foi gravado").toHaveAttribute("data-estado", "saved", { timeout: 20_000 });
    await expect(estado).toHaveText(/Salvo às \d{2}:\d{2}/);
    await expect
      .poll(
        async () => {
          const { data } = await adm().from("properties").select("id, draft_data").eq("owner_id", jornada.dono!);
          const achado = (data ?? []).find((r) => (r.draft_data as Record<string, unknown> | null)?.street === `Rua ${marca}`);
          jornada.anuncio = achado?.id as string | undefined;
          return jornada.anuncio;
        },
        { timeout: 20_000, message: "o rascunho do anúncio fica gravado no servidor, com o endereço" },
      )
      .toBeTruthy();
    await p1.context().close();

    const p2 = await entrar(browser, contas.dono.email, senha);
    await p2.goto(`/dashboard/imoveis/novo?draft=${jornada.anuncio}`, { waitUntil: "domcontentloaded" });
    await noPasso(p2, "endereco", 30_000);
    await expect(p2.getByTestId("cadastro-rua"), "reaberto, o endereço está lá").toHaveValue(`Rua ${marca}`, { timeout: 20_000 });
    await expect(p2.getByTestId("estado-salvamento"), "reaberto, sem editar, o topo mostra a hora da última gravação (E614)").toHaveText(/Salvo às \d{2}:\d{2}/, { timeout: 20_000 });
    await p2.context().close();
  });

  // Etapa 3 (busca), preparada na ORDEM-DUET-151 e ainda NÃO aprovada: ativa-se depois da etapa 2 (#4007). O inquilino do
  // piloto procura em Uberlândia, acha na busca o anúncio publicado do dono do piloto e abre a página dele.
  // DEPENDÊNCIA DE SEMENTE (ORDEM-DUET-153): o anúncio publicado nasce pela semente do laboratório (criarImovelPronto,
  // ativo). O que está sob teste nesta etapa é a perna da busca. Quando a publicação pela tela tiver o seu item aprovado,
  // o passo de publicar entra na etapa 2 e substitui esta semente; a etapa 3 não fica travada à espera dele.
  test("Etapa 3 — o inquilino acha na busca o anúncio do dono e abre a página dele (dependência de semente: anúncio publicado)", async ({ browser }) => {
    const titulo = `Studio da jornada T2157 ${sufixo}`;
    jornada.publicado = await criarImovelPronto(jornada.dono!, titulo, { ativo: true, preco: 2157 });
    const page = await entrar(browser, contas.inquilino.email, senha);
    await page.goto("/buscar?local=Uberl%C3%A2ndia", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("card-resultado").first(), "a busca mostra resultados").toBeVisible({ timeout: 30_000 });
    const link = page.locator(`a[href="/imoveis/${jornada.publicado}"]`).first();
    await expect(link, "o anúncio do dono do piloto aparece na busca de Uberlândia").toBeVisible({ timeout: 20_000 });
    await link.click();
    await expect(page, "abre a página do anúncio").toHaveURL(new RegExp(`/imoveis/${jornada.publicado}`), { timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1 }), "com o título do anúncio").toContainText(titulo, { timeout: 20_000 });
    await page.context().close();
  });

  // Etapa 4 (candidatura/conversa), preparada na ORDEM-DUET-186 e ainda NÃO aprovada: ativa-se depois da etapa 3. O
  // inquilino do piloto pede para morar no anúncio publicado do dono; o dono vê a candidatura sem o nome, aprova pela
  // tela e responde na conversa; o inquilino lê a resposta. Mesmo caminho da t182 (passos 1 a 3), com as contas da jornada.
  test("Etapa 4 — o inquilino pede para morar, o dono aprova e responde na conversa, e o inquilino lê", async ({ browser }) => {
    test.setTimeout(180_000);
    expect(jornada.publicado, "a etapa 3 deixou o anúncio publicado").toBeTruthy();

    // 1. o inquilino envia a candidatura pela página do anúncio
    const pi = await entrar(browser, contas.inquilino.email, senha);
    await pi.goto(`/imoveis/${jornada.publicado}`, { waitUntil: "domcontentloaded" });
    await expect(pi.getByRole("heading", { level: 1 }).first()).toContainText(`T2157 ${sufixo}`, { timeout: 20_000 });
    await pi.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await pi.getByRole("button", { name: "Pedir para morar", exact: true }).locator("visible=true").first().click();
    const passo = pi.getByTestId("solicitacao-passo");
    await expect(passo, "abre o passo a passo da candidatura").toBeVisible();
    await preencherPeriodoDaProposta(passo);
    await passo.getByRole("button", { name: "Continuar" }).click();
    await passo.getByRole("button", { name: "Continuar" }).click();
    await passo.getByRole("button", { name: "Enviar candidatura" }).click();
    await expect(pi.getByText("Candidatura enviada").first(), "a tela confirma o envio").toBeVisible({ timeout: 20_000 });
    const { data: lead } = await adm().from("leads").select("id, status").eq("property_id", jornada.publicado!).eq("tenant_id", jornada.inquilino!).single();
    expect(lead?.status, "a candidatura grava como nova").toBe("new");
    jornada.lead = lead!.id as string;
    await pi.context().close();

    // 2. o dono vê "Candidato(a)" sem o nome e aprova pela tela
    const pd = await entrar(browser, contas.dono.email, senha);
    await pd.setViewportSize({ width: 1280, height: 900 });
    await pd.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
    const cartao = pd.getByTestId("cartao-candidato").first();
    await expect(cartao.getByTestId("candidato-nome"), "antes do aceite, o candidato não tem nome").toHaveText("Candidato(a)", { timeout: 20_000 });
    await pd.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await pd.getByRole("button", { name: /Aprovar e responder/i }).first().click();
    await expect
      .poll(async () => (await adm().from("leads").select("status").eq("id", jornada.lead!).single()).data?.status, { timeout: 20_000, message: "o aceite grava" })
      .toBe("accepted");

    // 3. o dono responde na conversa da candidatura
    const resposta = `Bem-vindo a jornada do piloto ${sufixo.replace(/[^a-z]/gi, "")} combinamos a entrada pela plataforma`;
    await pd.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
    await pd.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await pd.getByRole("link", { name: /Responder pela plataforma/ }).first().click();
    await expect(pd).toHaveURL(/\/dashboard\/mensagens/, { timeout: 20_000 });
    await pd.getByRole("button", { name: new RegExp(`T2157 ${sufixo}`) }).first().click();
    await expect(pd.getByTestId("conversa-nome"), "depois do aceite, o dono vê o nome do inquilino").toContainText(contas.inquilino.nome, { timeout: 20_000 });
    await pd.getByPlaceholder("Escreva uma mensagem...").fill(resposta);
    await pd.getByRole("button", { name: "Enviar" }).click();
    await expect(pd.getByText(resposta).last()).toBeVisible({ timeout: 15_000 });
    // A tela mostra a mensagem antes de o servidor gravar (atualização otimista): espera a gravação antes de fechar (t182).
    await expect
      .poll(async () => ((await adm().from("messages").select("id").eq("body", resposta)).data ?? []).length, { timeout: 30_000, message: "a resposta grava" })
      .toBe(1);
    await pd.context().close();

    // 4. o inquilino lê a resposta
    const pl = await entrar(browser, contas.inquilino.email, senha);
    await pl.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
    await pl.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await pl.getByRole("button", { name: new RegExp(`T2157 ${sufixo}`) }).first().click();
    await expect(pl.getByTestId("conversa-nome"), "o inquilino vê o dono na conversa").toContainText(contas.dono.nome, { timeout: 20_000 });
    await expect(pl.getByText(resposta).last(), "o inquilino lê a resposta do dono").toBeVisible({ timeout: 15_000 });
    await pl.context().close();
  });

  // Etapa 5 (pré-aceite), preparada na ORDEM-DUET-190 e ainda NÃO aprovada: ativa-se depois da etapa 4. Sobre a candidatura
  // aceita na etapa 4, o dono monta e envia a proposta pela tela; o inquilino abre e aceita. O aceite é o pré-aceite (E722):
  // a taxa congela e, com a chave NEXT_PUBLIC_PRE_ACEITACAO_72H_ATIVA ligada no build, abre a janela de 72 h para concluir o
  // contrato, com o fim na tela. A chave liga-se SÓ no laboratório com as chaves de build (laboratorio-chaves.yml, ORDEM-DUET-192):
  // lá a janela é provada EM SIMULAÇÃO (marcada como tal); a chave de produção não se toca. Nas fatias e no lab-crítico a chave
  // fica desligada, e então a etapa exige que NÃO haja prazo. Nos dois lados a conferência é estrita: chave ligada sem prazo
  // gravado, ou desligada com prazo, é vermelho.
  test("Etapa 5 — negociação e pré-aceite: o dono envia a proposta, o inquilino contrapropõe o valor, o dono aceita e a taxa congela", async ({ browser }) => {
    test.setTimeout(180_000);
    expect(jornada.lead, "a etapa 4 deixou a candidatura aceita").toBeTruthy();

    // O anúncio da semente abre o valor mensal à negociação (como a t193): sem isto, o inquilino não tem o que contrapropor.
    await adm().from("properties").update({ negociacao: { aceita: true, itens: ["valor_mensal"], descontos: [] } }).eq("id", jornada.publicado!);

    // 1. o dono monta e envia a proposta a partir da candidatura
    const pd = await entrar(browser, contas.dono.email, senha);
    await pd.setViewportSize({ width: 1280, height: 900 });
    await pd.goto(`/dashboard/orcamentos/nova?interessado=${jornada.lead}`, { waitUntil: "domcontentloaded" });
    await expect(pd.getByTestId("montagem-proposta"), "abre a montagem da proposta para o candidato").toBeVisible({ timeout: 20_000 });
    await pd.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await pd.getByTestId("proposta-validade").selectOption("7");
    await pd.getByTestId("enviar-proposta").click();
    await pd.waitForURL(/\/dashboard\/propostas\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    jornada.proposta = pd.url().split("/").pop()!;
    await expect(pd.getByTestId("proposta-status"), "a proposta sai como enviada").toHaveText("Enviada", { timeout: 20_000 });
    await pd.context().close();

    // 2. NEGOCIAÇÃO (ORDEM-DUET-203): o inquilino contrapropõe um valor mensal menor. Proposta aceita não recebe contraproposta,
    // por isso a contraproposta vive aqui, antes do aceite que abre o pré-aceite.
    const CONTRA = 2100;
    const pi = await entrar(browser, contas.inquilino.email, senha);
    await test.step("contraproposta: o inquilino pede um valor mensal menor e a proposta passa a versão 2", async () => {
      await pi.goto(`/dashboard/propostas/${jornada.proposta}`, { waitUntil: "domcontentloaded" });
      await pi.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await pi.getByTestId("proposta-contrapropor").click();
      await pi.getByTestId("contra-valor").fill(String(CONTRA));
      await pi.getByTestId("enviar-contraproposta").click();
      await expect
        .poll(async () => (await adm().from("propostas").select("status, versao_atual").eq("id", jornada.proposta!).single()).data, { timeout: 20_000, message: "a contraproposta grava como versão 2" })
        .toEqual({ status: "contraproposta", versao_atual: 2 });
      const { data: v2 } = await adm().from("proposta_versoes").select("autor, valor_base").eq("proposta_id", jornada.proposta!).eq("versao", 2).single();
      expect(v2?.autor, "a versão 2 é do inquilino").toBe("tenant");
      expect(Number(v2?.valor_base), "com o valor contraproposto").toBe(CONTRA);
      await expect(pi.getByTestId("proposta-status"), "o inquilino vê a contraproposta enviada").toHaveAttribute("data-status", "contraproposta", { timeout: 20_000 });
    });

    // 3. o dono aceita a contraproposta: é este aceite que abre o pré-aceite
    const pd2 = await entrar(browser, contas.dono.email, senha);
    await pd2.setViewportSize({ width: 1280, height: 900 });
    await pd2.goto(`/dashboard/propostas/${jornada.proposta}`, { waitUntil: "domcontentloaded" });
    await pd2.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await expect(pd2.getByTestId("proposta-aceitar"), "o dono pode aceitar a contraproposta").toBeVisible({ timeout: 20_000 });
    await pd2.getByTestId("proposta-aceitar").click();
    await expect
      .poll(async () => (await adm().from("propostas").select("status").eq("id", jornada.proposta!).single()).data?.status, { timeout: 20_000, message: "o aceite grava" })
      .toBe("aceita");
    await pd2.context().close();
    const { data: p } = await adm().from("propostas").select("aceita_em, taxa_congelada, pre_aceitacao_ate").eq("id", jornada.proposta!).single();
    expect(p?.aceita_em, "o aceite tem data").toBeTruthy();
    expect(p?.taxa_congelada, "a taxa congela no pré-aceite").not.toBeNull();

    // 4. a janela de 72 h do pré-aceite: estrita nos dois sentidos, conforme a chave do build (o mesmo env do job)
    await pi.goto(`/dashboard/propostas/${jornada.proposta}`, { waitUntil: "domcontentloaded" });
    if (process.env.NEXT_PUBLIC_PRE_ACEITACAO_72H_ATIVA === "on") {
      test.info().annotations.push({ type: "simulação", description: "pré-aceite de 72 h provado em SIMULAÇÃO no laboratório com a chave ligada (ORDEM-DUET-192); a chave de produção não foi tocada" });
      expect(p?.pre_aceitacao_ate, "com a chave ligada, o pré-aceite grava o fim da janela").toBeTruthy();
      expect(new Date(p!.pre_aceitacao_ate as string).getTime(), "a janela não passa de 72 h").toBeLessThanOrEqual(Date.now() + 72 * 3_600_000 + 60_000);
      await expect(pi.getByTestId("pre-aceitacao-prazo"), "o inquilino vê o fim da janela de 72 h").toContainText("Termina em", { timeout: 20_000 });
    } else {
      expect(p?.pre_aceitacao_ate ?? null, "com a chave desligada, não há janela").toBeNull();
      await expect(pi.getByTestId("pre-aceitacao"), "sem a chave, não há painel de prazo").toHaveCount(0);
      test.info().annotations.push({ type: "pré-aceite", description: "chave NEXT_PUBLIC_PRE_ACEITACAO_72H_ATIVA desligada neste build: conferidos o aceite, a taxa congelada e a ausência de janela" });
    }
    await pi.context().close();
  });

  // Etapa 6 (proposta), preparada na ORDEM-DUET-200 e ainda NÃO aprovada: ativa-se depois da etapa 5. A proposta aceita no
  // pré-aceite é a que conta daí em diante: o inquilino vê-a "Aceita" com os dias e o total acordados, e o dono segue dela
  // para o Fechamento, que abre com os valores DA PROPOSTA (número, total e prazo em dias), e não com os do anúncio.
  test("Etapa 6 — proposta: a proposta aceita fica 'Aceita' para as duas partes e o Fechamento abre com os valores dela", async ({ browser }) => {
    test.setTimeout(180_000);
    expect(jornada.proposta, "a etapa 5 deixou a proposta aceita").toBeTruthy();
    const { data: prop } = await adm().from("propostas").select("numero, status, versao_atual").eq("id", jornada.proposta!).single();
    expect(prop?.status, "a proposta está aceita").toBe("aceita");
    const { data: versao } = await adm().from("proposta_versoes").select("dias, total_contrato").eq("proposta_id", jornada.proposta!).eq("versao", prop!.versao_atual).single();
    const dias = Number(versao!.dias);
    expect(dias, "a proposta tem dias").toBeGreaterThan(0);

    // 1. o inquilino vê a proposta aceita, com os dias acordados
    const pi = await entrar(browser, contas.inquilino.email, senha);
    await pi.goto(`/dashboard/propostas/${jornada.proposta}`, { waitUntil: "domcontentloaded" });
    await expect(pi.getByTestId("proposta-status"), "o inquilino vê a proposta aceita").toHaveAttribute("data-status", "aceita", { timeout: 20_000 });
    await expect(pi.getByTestId("proposta-atual").getByTestId("proposta-estadia"), "com os dias acordados").toContainText(`${dias} dias`, { timeout: 20_000 });
    await expect(pi.getByTestId("proposta-aceitar"), "já não há o que aceitar").toHaveCount(0);
    await pi.context().close();

    // 2. o dono vai da proposta aceita ao Fechamento, que abre com os valores da proposta
    const pd = await entrar(browser, contas.dono.email, senha);
    await pd.setViewportSize({ width: 1280, height: 900 });
    await pd.goto(`/dashboard/propostas/${jornada.proposta}`, { waitUntil: "domcontentloaded" });
    await expect(pd.getByTestId("proposta-status"), "o dono vê a proposta aceita").toHaveAttribute("data-status", "aceita", { timeout: 20_000 });
    await pd.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await pd.getByTestId("ir-fechamento").click();
    await expect(pd, "segue para o Fechamento").toHaveURL(/\/dashboard\/fechamento/, { timeout: 20_000 });
    const acordo = pd.getByTestId("fechamento-proposta");
    await expect(acordo, "o Fechamento mostra a proposta aceita").toBeVisible({ timeout: 20_000 });
    await expect(acordo, "pelo número da proposta").toContainText(String(prop!.numero));
    await expect(pd.getByTestId("fechamento-prazo-dias"), "com o prazo em dias da proposta").toContainText(`${dias} dias`);
    const total = Number(versao!.total_contrato);
    const reais = Math.floor(total).toLocaleString("pt-BR");
    await expect(pd.getByTestId("fechamento-proposta-contrato"), "com o total da proposta").toContainText(reais);
    await pd.context().close();
  });

  // Etapa 7 (contrato), preparada na ORDEM-DUET-196 e renumerada na ORDEM-DUET-197 (era "6"; a sequência validada é
  // 6 proposta → 7 contrato), ainda NÃO aprovada: ativa-se depois da etapa 6 (proposta). Do pré-aceite ao
  // contrato: o inquilino envia identidade e renda pela tela (Minhas candidaturas); o dono faz o Fechamento pela tela e gera o
  // contrato. As contas da jornada são marcadas como conta de TESTE nesta etapa: o contrato sai SIMULADO (nada vai ao
  // ZapSign, ordem ee7d27b8), como na t863. O contrato nasce com o prazo, em dias, da proposta aceita na etapa 5 (E562).
  test("Etapa 7 — contrato: do pré-aceite ao contrato, documentos do inquilino, Fechamento pela tela e contrato simulado no prazo da proposta", async ({ browser }) => {
    test.setTimeout(240_000);
    expect(jornada.proposta, "a etapa 5 deixou a proposta aceita").toBeTruthy();
    // Conta de teste: o contrato sai em modo simulado (sem assinatura digital real).
    await adm().from("profiles").update({ is_teste: true }).in("id", [jornada.dono!, jornada.inquilino!]);
    test.info().annotations.push({ type: "simulação", description: "contrato gerado em modo de TESTE (contas is_teste): nada vai ao ZapSign" });

    // 1. o inquilino envia identidade e renda pela tela
    const pi = await entrar(browser, contas.inquilino.email, senha);
    await pi.goto("/dashboard/candidaturas", { waitUntil: "domcontentloaded" });
    await pi.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    const bloco = pi.getByTestId("docs-inquilino").filter({ has: pi.getByTestId("doc-inquilino-identidade") }).first();
    await expect(bloco, "a candidatura aceita pede os documentos").toBeVisible({ timeout: 20_000 });
    await bloco.getByLabel("Enviar documento de identidade").setInputFiles({ name: "rg.pdf", mimeType: "application/pdf", buffer: pdf() });
    await expect(pi.getByTestId("doc-inquilino-identidade")).toContainText("enviado", { timeout: 20_000 });
    await bloco.getByLabel("Enviar comprovante de renda").setInputFiles({ name: "renda.pdf", mimeType: "application/pdf", buffer: pdf() });
    await expect(pi.getByTestId("doc-inquilino-renda")).toContainText("enviado", { timeout: 20_000 });
    await expect(pi.getByTestId("docs-inquilino-completos"), "os documentos ficam completos").toBeVisible({ timeout: 20_000 });
    await pi.context().close();

    // 2. o dono faz o Fechamento pela tela e gera o contrato
    const pd = await entrar(browser, contas.dono.email, senha);
    await pd.setViewportSize({ width: 1280, height: 900 });
    await pd.goto(`/dashboard/fechamento?c=${jornada.lead}`, { waitUntil: "domcontentloaded" });
    await pd.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await expect(pd.getByRole("heading", { name: "Candidatura e verificação" })).toBeVisible({ timeout: 20_000 });
    await pd.getByRole("button", { name: /verificar identidade/i }).click();
    const continuar = pd.getByRole("button", { name: /continuar/i });
    await expect(continuar).toBeEnabled({ timeout: 20_000 });
    await continuar.click();
    await pd.getByRole("radio").and(pd.locator(":not([disabled])")).first().click();
    await pd.getByTestId("ciente-protecao").check({ timeout: 15_000 });
    await continuar.click();
    await expect(pd.getByRole("heading", { name: /serviços adicionais/i })).toBeVisible({ timeout: 15_000 });
    await continuar.click();
    await pd.getByRole("button", { name: /Seguir sem seguro patrimonial/ }).click();
    await continuar.click();
    await expect(pd.getByTestId("marca-minuta"), "chega à minuta do contrato").toBeVisible({ timeout: 15_000 });
    await pd.getByTestId("fechamento-gerar-contrato").click();
    await expect(pd.getByTestId("fechamento-abrir-contrato"), "o contrato é gerado").toBeVisible({ timeout: 30_000 });
    await pd.context().close();

    // 3. o contrato fica registrado, com o prazo em dias da proposta aceita
    const { data: prop } = await adm().from("propostas").select("versao_atual").eq("id", jornada.proposta!).single();
    const { data: versao } = await adm().from("proposta_versoes").select("dias").eq("proposta_id", jornada.proposta!).eq("versao", prop!.versao_atual).single();
    const { data: contrato, error } = await adm().from("contratos").select("prazo_total_dias").eq("lead_id", jornada.lead!).single();
    expect(error, "um contrato para a candidatura da jornada").toBeNull();
    // A proposta da jornada tem 35 dias (preencherPeriodoDaProposta): fora dos múltiplos de 30, o prazo em meses arredondados
    // (o caminho sem proposta, E562) daria outro número, e a conferência distingue as duas fontes.
    expect(Number(versao!.dias) % 30, "a proposta não cai num número redondo de meses").not.toBe(0);
    expect(Number(contrato!.prazo_total_dias), "o contrato nasce com o prazo, em dias, da proposta aceita").toBe(Number(versao!.dias));
  });

  // Etapa 8 (estadia), preparada na ORDEM-DUET-203 e ainda NÃO aprovada: ativa-se depois da etapa 7. O contrato da etapa 7
  // entra em vigência pelo caminho da fonte única (F33): as duas assinaturas e o 1º pagamento declarado pelo dono E
  // confirmado pelo inquilino. As assinaturas são SIMULADAS (o ZapSign fica fora do laboratório; ver a anotação); o
  // pagamento é pela tela: o dono registra o recebimento em Contratos e o inquilino confirma em Locações.
  test("Etapa 8 — estadia: assinado, o dono registra o 1º pagamento, o inquilino confirma e a locação fica em vigência para os dois", async ({ browser }) => {
    test.setTimeout(240_000);
    const { data: contrato } = await adm().from("contratos").select("id").eq("lead_id", jornada.lead!).single();
    expect(contrato?.id, "a etapa 7 deixou o contrato").toBeTruthy();
    const contratoId = contrato!.id as string;

    // 1. as duas assinaturas (simuladas: contas de teste, nada vai ao ZapSign)
    test.info().annotations.push({ type: "simulação", description: "assinaturas do contrato gravadas pelo laboratório (ZapSign fora do lab); o pagamento é pela tela" });
    const agora = new Date().toISOString();
    await adm().from("contratos").update({ assinado_proprietario_em: agora, assinado_inquilino_em: agora }).eq("id", contratoId);
    const pd = await entrar(browser, contas.dono.email, senha);
    await pd.setViewportSize({ width: 1280, height: 900 });
    await pd.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    await expect(pd.getByTestId("contrato-etapa").first(), "assinado, falta o 1º pagamento").toHaveAttribute("data-chave", "aguardando_pagamento", { timeout: 20_000 });

    // 2. o dono registra pela tela o recebimento do 1º pagamento
    await pd.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await pd.getByTestId("registrar-recebimento").first().click();
    await pd.getByTestId("confirmar-recebimento").click();
    await expect
      .poll(async () => ((await adm().from("pagamentos_bloco").select("id").eq("contrato_id", contratoId).eq("tipo", "aluguel")).data ?? []).length, { timeout: 20_000, message: "o recebimento grava" })
      .toBe(1);

    // 3. o inquilino confirma pela tela, em Locações
    const pi = await entrar(browser, contas.inquilino.email, senha);
    await pi.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
    const confirmar = pi.getByTestId("confirmar-pagamentos");
    await expect(confirmar, "o inquilino vê o pagamento a confirmar").toBeVisible({ timeout: 20_000 });
    await confirmar.getByRole("button", { name: /Confirmar/ }).first().click();
    await expect
      .poll(async () => (await adm().from("pagamentos_bloco").select("confirmado_pelo_inquilino").eq("contrato_id", contratoId).eq("tipo", "aluguel").single()).data?.confirmado_pelo_inquilino, { timeout: 20_000, message: "a confirmação grava" })
      .toBe(true);

    // 4. a locação fica em vigência para os dois
    await pi.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
    await expect(pi.getByTestId("locacao-etapa").first(), "o inquilino vê a locação em vigência").toHaveText(ROTULO_ETAPA.em_vigencia, { timeout: 20_000 });
    await pi.context().close();
    await pd.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    await expect(pd.getByTestId("contrato-etapa").first(), "o dono vê o contrato em vigência").toHaveAttribute("data-chave", "em_vigencia", { timeout: 20_000 });
    await pd.context().close();
  });

  // Etapa 9 (saída/caução), preparada na ORDEM-DUET-205 e ainda NÃO aprovada: ativa-se depois da etapa 8. A caução entra e
  // volta pela tela, nas duas pontas da estadia: o dono registra o recebimento e o inquilino confirma; a estadia termina (o
  // tempo é SIMULADO: o bloco passa para o passado, como na t182) e o app encerra o contrato; o dono registra a devolução
  // integral e o inquilino confirma que recebeu. O estado único da caução (L2-B) vai de "recebida" a "devolvida".
  test("Etapa 9 — saída: caução recebida e confirmada, a estadia termina; devolução com desconto contestada pelo inquilino; devolução integral confirmada", async ({ browser }) => {
    test.setTimeout(240_000);
    const { data: contrato } = await adm().from("contratos").select("id").eq("lead_id", jornada.lead!).single();
    expect(contrato?.id, "a etapa 7 deixou o contrato").toBeTruthy();
    const contratoId = contrato!.id as string;

    // 1. a caução entra: o dono registra o recebimento e o inquilino confirma, pela tela
    const pd = await entrar(browser, contas.dono.email, senha);
    await pd.setViewportSize({ width: 1280, height: 900 });
    await pd.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    await pd.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await pd.getByTestId("registrar-caucao").first().click();
    await pd.getByTestId("confirmar-recebimento").click();
    await expect
      .poll(async () => ((await adm().from("pagamentos_bloco").select("id").eq("contrato_id", contratoId).eq("tipo", "caucao")).data ?? []).length, { timeout: 20_000, message: "a caução recebida grava" })
      .toBe(1);
    const pi = await entrar(browser, contas.inquilino.email, senha);
    await pi.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
    const confirmar = pi.getByTestId("confirmar-pagamentos");
    await expect(confirmar, "o inquilino vê a caução a confirmar").toBeVisible({ timeout: 20_000 });
    await confirmar.getByRole("button", { name: /Confirmar/ }).first().click();
    await expect
      .poll(async () => (await adm().from("pagamentos_bloco").select("confirmado_pelo_inquilino").eq("contrato_id", contratoId).eq("tipo", "caucao").single()).data?.confirmado_pelo_inquilino, { timeout: 20_000, message: "a confirmação da caução grava" })
      .toBe(true);

    // 2. a estadia termina (tempo SIMULADO: o bloco 1 acabou ontem) e o app encerra o contrato quando o dono abre Contratos
    test.info().annotations.push({ type: "simulação", description: "fim da estadia simulado: as datas do bloco passam para o passado (como na t182)" });
    const hoje = new Date();
    const dia = (n: number) => new Date(hoje.getTime() + n * 86_400_000).toISOString().slice(0, 10);
    await adm().from("contrato_blocos").update({ inicio: dia(-36), fim: dia(-1) }).eq("contrato_id", contratoId);
    await pd.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    await expect
      .poll(async () => (await adm().from("contratos").select("status").eq("id", contratoId).single()).data?.status, { timeout: 20_000, message: "o app encerra o contrato no fim da estadia" })
      .toBe("encerrado_sem_renovacao");

    // Extensões da etapa 9 (ORDEM-DUET-206): antes da devolução integral, o caminho da devolução COM DESCONTO e o da DISPUTA
    // do inquilino, cada um num test.step próprio (cada um com o seu teste de quebra).
    const { data: cau } = await adm().from("pagamentos_bloco").select("valor").eq("contrato_id", contratoId).eq("tipo", "caucao").single();
    const caucaoTotal = Number(cau!.valor);
    expect(caucaoTotal, "há caução confirmada").toBeGreaterThan(100);
    const ultimoAcerto = async () =>
      (await adm().from("caucao_acertos").select("status, tipo, valor_devolvido").eq("contrato_id", contratoId).order("created_at", { ascending: false }).limit(1).maybeSingle()).data;
    const abrirDevolucao = async () => {
      await pd.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
      await pd.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await pd.getByTestId("devolucao-caucao").first().getByRole("button", { name: "Registrar devolução da caução" }).click();
    };

    await test.step("extensão A — devolução com desconto: o dono devolve R$ 100 a menos e a devolução fica do tipo desconto", async () => {
      await abrirDevolucao();
      const form = pd.getByTestId("devolucao-caucao").first();
      await form.locator("input").first().fill(String(caucaoTotal - 100));
      await expect(form.getByText(/Com desconto, explique os motivos/), "a tela avisa do desconto").toBeVisible();
      await form.getByRole("button", { name: "Registrar devolução", exact: true }).click();
      await expect.poll(ultimoAcerto, { timeout: 20_000, message: "a devolução com desconto grava" }).toEqual({ status: "aguardando_confirmacao", tipo: "desconto", valor_devolvido: caucaoTotal - 100 });
    });

    await test.step("extensão B — disputa: o inquilino diz que não recebeu ou discorda, e o dono vê a contestação", async () => {
      await pi.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
      await pi.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await pi.getByTestId("devolucao-caucao").first().getByRole("button", { name: /Não recebi \/ discordo/ }).click();
      await expect.poll(async () => (await ultimoAcerto())?.status, { timeout: 20_000, message: "a contestação grava" }).toBe("desconto_contestado");
      await pd.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
      await expect(pd.getByTestId("devolucao-caucao").first(), "o dono vê que a devolução foi contestada").toContainText("A devolução anterior foi contestada pelo morador.", { timeout: 20_000 });
    });

    // 3. o dono registra pela tela a devolução integral da caução (depois da contestação, um novo acerto é permitido)
    await abrirDevolucao();
    await pd.getByTestId("devolucao-caucao").first().locator("input").first().fill(String(caucaoTotal));
    await pd.getByTestId("devolucao-caucao").first().getByRole("button", { name: "Registrar devolução", exact: true }).click();
    await expect
      .poll(async () => { const a = await ultimoAcerto(); return a && { status: a.status, tipo: a.tipo }; }, { timeout: 20_000, message: "a devolução integral aguarda o inquilino" })
      .toEqual({ status: "aguardando_confirmacao", tipo: "devolucao_integral" });

    // 4. o inquilino confirma que recebeu: a caução fica devolvida
    await pi.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
    await pi.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await pi.getByTestId("devolucao-caucao").first().getByRole("button", { name: /Sim, recebi/ }).click();
    await expect
      .poll(async () => (await ultimoAcerto())?.status, { timeout: 20_000, message: "a confirmação da devolução grava" })
      .toBe("devolvida_integral");
    await pi.context().close();
    await pd.context().close();
  });
});
