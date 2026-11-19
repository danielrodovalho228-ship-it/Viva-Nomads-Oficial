import { test, expect } from "@playwright/test";
import { preencherPeriodoDaProposta } from "../fixtures/periodo-proposta";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirCadastroNovo, doTipoAoEndereco, noPasso } from "../fixtures/cadastro";

/*
  T2157 — Jornada do piloto @criticos (ORDEM-DUET-138, item 4: "spec de jornada").
  Percorre a jornada do piloto no laboratório (contas de teste, integrações simuladas), de ponta a ponta, até a última
  etapa APROVADA na sequência crítica do Gerente:
    1 cadastro → 2 anúncio → 3 busca → 4 candidatura/conversa → 5 pré-aceite → 6 proposta → 7 contrato → 8 estadia →
    9 saída/caução → 10 avaliação.
  Roda em todo PR pelo lab-crítico (fluxo "jornada-piloto" em tests/laboratorio/fluxos-criticos.json). PR que deixa a
  jornada vermelha não entra.

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
const jornada: { dono?: string; inquilino?: string; anuncio?: string; publicado?: string; lead?: string } = {};
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
    if (jornada.lead) await adm().from("leads").delete().eq("id", jornada.lead);
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
});
