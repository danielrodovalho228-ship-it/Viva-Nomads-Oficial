import { test, expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { preencherPeriodoDaProposta } from "../fixtures/periodo-proposta";
import { NO_LABORATORIO, aceitarTermoIaSePreciso, adm, apagarContas, criarConta, entrar, liberarLimiteChamados, liberarLimiteCodigo, novaSenha, novoSufixo, pdf, pdfQueAbre, pngDeTeste } from "../fixtures/laboratorio";
import { abrirCadastroNovo, abrirSecoesPasso10, continuarAte, doTipoAoEndereco, noPasso, preencherFichaDentro } from "../fixtures/cadastro";
import { ROTULO_ETAPA } from "../../../src/lib/contrato-etapas";
import { addDiasISO } from "../../../src/lib/contrato-blocos";
import { hojeBR } from "../../../src/lib/utils";
import { preencherCriterios } from "../fixtures/avaliacao-criterios";
import { abrirPortaoDaIdentidade } from "../fixtures/fechamento-identidade";

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
  Vizinha do teto da caução (ORDENS-DUET 1098 e 1107): corre também no portão desse avulso, porque o registro da
  caução passou a não passar da soma das cauções dos blocos do contrato.
  Vizinha do E1225 (ORDENS-DUET 1120 e 1127): corre também no portão desse PR, porque a caução passou a ser
  registada por bloco (0367), com uma linha por bloco no cartão da caução.
*/
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

const sufixo = novoSufixo();
const senha = novaSenha();
const jornada: { novaConta?: string; dono?: string; inquilino?: string; anuncio?: string; publicado?: string; lead?: string; proposta?: string } = {};
const contas = {
  dono: { email: `t2157-dono-${sufixo}@laboratorio.test`, nome: `Dono Jornada ${sufixo}`, role: "owner" as const },
  inquilino: { email: `t2157-inq-${sufixo}@laboratorio.test`, nome: `Inquilino Jornada ${sufixo}`, role: "tenant" as const },
};

/** Entrada única por código (t300): e-mail → Continuar → código → Entrar. No lab o código vem do Supabase local. */
async function entrarPorCodigo(page: Page, email: string): Promise<void> {
  await liberarLimiteCodigo();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  const tela = page.getByTestId("login-por-codigo");
  // 1ª carga fria: um clique antes da hidratação recarrega a página; repete até o campo do código abrir.
  await expect(async () => {
    if (await page.getByTestId("campo-codigo").isVisible()) return;
    const campo = tela.getByPlaceholder("E-mail");
    if ((await campo.inputValue({ timeout: 4_000 })) !== email) await campo.fill(email, { timeout: 4_000 });
    await tela.getByRole("button", { name: "Continuar" }).click({ timeout: 4_000 });
    await expect(page.getByTestId("campo-codigo")).toBeVisible({ timeout: 8_000 });
  }).toPass({ timeout: 45_000 });
  const { data, error } = await adm().auth.admin.generateLink({ type: "magiclink", email });
  expect(error, error?.message).toBeNull();
  const codigo = data?.properties?.email_otp ?? "";
  expect(codigo).toMatch(/^\d{6}$/);
  await page.getByTestId("campo-codigo").fill(codigo);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

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
      if (cids.length) await adm().from("avaliacoes").delete().in("contrato_id", cids);
      if (cids.length) await adm().from("caucao_acertos").delete().in("contrato_id", cids);
      if (cids.length) await adm().from("pagamentos_bloco").delete().in("contrato_id", cids);
      await adm().from("contratos").delete().eq("lead_id", jornada.lead);
      await adm().from("propostas").delete().eq("lead_id", jornada.lead);
      await adm().from("leads").delete().eq("id", jornada.lead);
    }
    if (jornada.anuncio) await adm().from("properties").delete().eq("id", jornada.anuncio);
    if (jornada.publicado) await adm().from("properties").delete().eq("id", jornada.publicado);
    await apagarContas([jornada.dono, jornada.inquilino, jornada.novaConta]);
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

  // Etapa 1 (cadastro e conta), preparada na ORDEM-DUET-208 e ainda NÃO aprovada. Decisão do Gerente: a ação da perna É
  // criar a conta, por isso usa uma conta DEDICADA, nova em cada corrida (massa QA: e-mail t2157-novo-<sufixo>@lab.vivanomads.test, o domínio de teste que a rota do código aceita no lab),
  // e nunca as contas do piloto (que seguem por fixture nas etapas 2 a 10). Caminho da t300 (Prompt 49): a conta nasce pela
  // tela, por código e SEM senha; a pessoa escolhe a intenção e chega ao painel. No laboratório a rota do código não envia
  // e-mail: o código vem do Supabase local (generateLink → email_otp), o mesmo que o e-mail traria.
  test("Etapa 1 — cadastro: uma conta nova nasce pela tela, por código e sem senha, escolhe a intenção e chega ao painel", async ({ page }) => {
    test.setTimeout(180_000);
    const email = `t2157-novo-${sufixo}@lab.vivanomads.test`;
    const { data: antes } = await adm().from("profiles").select("id").eq("email", email);
    expect(antes ?? [], "a conta ainda não existe (nova em cada corrida)").toHaveLength(0);

    // 1. e-mail → Continuar → código → Entrar
    await entrarPorCodigo(page, email);
    await page.waitForURL(/\/auth\/intencao/, { timeout: 45_000 });
    const { data: u } = await adm().auth.admin.listUsers({ page: 1, perPage: 1000 });
    jornada.novaConta = u.users.find((x) => x.email === email)?.id;
    expect(jornada.novaConta, "a conta nasceu pela tela").toBeTruthy();

    // 2. a intenção: "Quero morar"
    const tela = page.getByTestId("tela-intencao");
    await tela.getByTestId("intencao-morar").click();
    await expect(tela.getByTestId("intencao-morar")).toHaveAttribute("aria-pressed", "true");
    await tela.getByTestId("intencao-continuar").click();
    await page.waitForURL((url) => url.pathname === "/dashboard", { timeout: 30_000 });

    // 3. no banco: a intenção gravada, e nenhuma senha (só a identidade de e-mail)
    await expect
      .poll(async () => (await adm().from("profiles").select("intencao").eq("id", jornada.novaConta!).single()).data?.intencao, { timeout: 20_000, message: "a intenção grava" })
      .toEqual(["morar"]);
    const { data: usuario } = await adm().auth.admin.getUserById(jornada.novaConta!);
    expect((usuario.user?.identities ?? []).every((i) => i.provider === "email"), "nenhuma conta nova cria senha").toBe(true);
  });


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

  // Etapa 2, continuação — PUBLICAÇÃO PELA TELA (ORDEM-DUET-258, trecho 0): o rascunho acima vira o anúncio publicado da
  // jornada, sem semente. O dono completa os passos pela tela; envia um documento que a conferência automática (simulada
  // no lab) manda para a fila; a conta de admin do laboratório aprova o documento pela tela da Central (/admin/documentos);
  // o dono publica. A etapa 3 passa a usar ESTE anúncio. Simulações declaradas (as mesmas do t186): o ViaCEP; as fotos do
  // rascunho trocadas pelas de teste em https (o Storage local é http e a regra do editor só aceita https na pasta do dono);
  // o checklist "Antes de anunciar" respondido no banco, como a tela /qualificar deixaria.
  test("Etapa 2 — publicação pela tela: o dono completa o anúncio, envia o documento, a Central aprova pela tela e o dono publica", async ({ browser }) => {
    test.setTimeout(360_000);
    expect(jornada.anuncio, "o rascunho da etapa 2 existe").toBeTruthy();
    expect(hasAccount("admin"), "a conta de admin do laboratório existe (é ela que aprova o documento na Central)").toBe(true);
    const marca = `T2157 ${sufixo}`;
    const titulo = `Studio da jornada ${marca}`;
    const imovelId = jornada.anuncio!;

    const p = await entrar(browser, contas.dono.email, senha);
    await p.addInitScript(() => {
      try {
        sessionStorage.setItem("vivanomads-qualification", JSON.stringify({ eligible: true, baseBadge: false, tHome: false, tWork: false, score: 3 }));
      } catch {
        /* sem sessionStorage */
      }
    });
    await p.route("https://viacep.com.br/ws/**", (r) =>
      r.fulfill({ json: { cep: "38400-100", logradouro: `Rua ${marca}`, bairro: `Bairro ${marca}`, localidade: "Uberlândia", uf: "MG" } }),
    );
    const continuar = p.getByTestId("cadastro-continuar");

    // Passo 3: Endereço — o CEP completa a cidade (Uberlândia: a busca da etapa 3 procura lá).
    await p.goto(`/dashboard/imoveis/novo?draft=${imovelId}&etapa=endereco`, { waitUntil: "domcontentloaded" });
    await noPasso(p, "endereco", 30_000);
    await p.getByTestId("cadastro-cep").fill("38400100");
    await expect(p.getByTestId("cadastro-cidade"), "o CEP completa a cidade").toHaveValue("Uberlândia", { timeout: 10_000 });
    await p.getByTestId("cadastro-numero").fill("157");
    await continuar.click();

    // Passo 4: Detalhes.
    await noPasso(p, "detalhes");
    await p.getByTestId("cadastro-banheiros").fill("1");
    await p.getByTestId("cadastro-capacidade").fill("2");
    await p.getByTestId("cadastro-area").fill("40");
    await continuar.click();

    // Passo 5: Comodidades — internet, declaração das câmeras, padrão mínimo e a ficha "O que tem dentro".
    await noPasso(p, "comodidades");
    await p.getByLabel("Velocidade da internet em Mbps").fill("300");
    await p.getByTestId("seguranca-imovel").getByTestId("declaracao-sem-cameras").click();
    await expect(p.getByTestId("declaracao-sem-cameras")).toHaveAttribute("aria-checked", "true");
    await p.getByTestId("conforto-marcar-todos").click();
    await expect(p.getByTestId("conforto-faltam")).toHaveText("Todos os itens confirmados.");
    await preencherFichaDentro(p);
    await continuar.click();

    // Passo 6: Regras — o tipo de entrada.
    await noPasso(p, "regras");
    await p.getByTestId("tipo-entrada-porteiro").check();
    await continuar.click();

    // Passo 7: Título e descrição — o título com a marca da jornada (as etapas 4 e 5 acham o anúncio por ele).
    await noPasso(p, "descricao");
    await p.getByTestId("cadastro-titulo").fill(titulo);
    await p
      .getByTestId("cadastro-descricao")
      .fill("Studio mobiliado da jornada do piloto, com home office, internet rápida e cozinha completa. Pronto para morar a partir de 30 dias.");
    await continuar.click();

    // Passo 8: Preço — valor da jornada e a caução como garantia (a etapa 9 registra e devolve a caução).
    await noPasso(p, "preco");
    await p.getByTestId("cadastro-preco").fill("2157");
    // A garantia do cadastro é a "Caução (depósito devolvível)" (GARANTIAS_CADASTRO, caucao_avista).
    const caucao = p.getByRole("button", { name: /Aceito Caução/ }).first();
    await expect(caucao, "a caução está entre as garantias do cadastro").toBeVisible({ timeout: 15_000 });
    if ((await caucao.getAttribute("aria-pressed")) !== "true") await caucao.click();
    await expect(caucao).toHaveAttribute("aria-pressed", "true");
    await continuar.click();

    // Passo 9: Disponibilidade — entrada a partir de amanhã.
    await noPasso(p, "disponibilidade");
    const amanha = new Date(Date.now() + 86_400_000);
    await p.getByTestId("disponivel-de").pressSequentially(`${String(amanha.getDate()).padStart(2, "0")}${String(amanha.getMonth() + 1).padStart(2, "0")}${amanha.getFullYear()}`);
    await continuar.click();

    // Passo 10: identidade e documento. O documento de teste "editado" a conferência automática manda para a fila do admin.
    await noPasso(p, "revisao");
    await abrirSecoesPasso10(p);
    const antes = p.getByTestId("antes-de-publicar");
    const identidade = antes.getByTestId("etapa-identidade");
    if ((await identidade.getAttribute("data-estado")) !== "ok") {
      await identidade.getByTestId("identidade-confirmar").click();
      await expect(identidade.getByTestId("identidade-confirmada")).toBeVisible({ timeout: 20_000 });
    }
    const doc = Buffer.concat([
      Buffer.from(`%PDF-1.4\n% documento ficticio do laboratorio VIVA-LAB-DOC:editado ${randomBytes(8).toString("hex")}\n`),
      Buffer.alloc(12 * 1024, 0x20),
      Buffer.from("\n%%EOF\n"),
    ]);
    await antes.getByTestId("documento-vinculo").locator('input[type="file"]').first().setInputFiles({ name: "documento-jornada.pdf", mimeType: "application/pdf", buffer: doc });
    await expect(p.getByTestId("documento-estado"), "o documento vai para a conferência da equipe").toHaveAttribute("data-estado", "revisao", { timeout: 30_000 });
    await p.waitForTimeout(2_500);
    await p.getByTestId("assistente-sair").click();
    await p.waitForURL(/\/dashboard\/imoveis/, { timeout: 30_000 });

    // Simulações declaradas do laboratório (como no t186): fotos https na pasta do dono e o "Antes de anunciar" respondido.
    const { data: rasc } = await adm().from("properties").select("draft_data").eq("id", imovelId).single();
    const fotos = [];
    for (let i = 0; i < 8; i++) {
      const caminho = `${jornada.dono}/${imovelId}-${i}.png`;
      await adm().storage.from("property-photos").upload(caminho, pngDeTeste(i), { contentType: "image/png", upsert: true });
      fotos.push({ id: `lab-${i}`, url: `https://lab.vivanomads.test/storage/v1/object/public/property-photos/${caminho}`, name: "", path: caminho, demo: false });
    }
    await adm().from("properties").update({ draft_data: { ...(rasc!.draft_data as object), photos: fotos } }).eq("id", imovelId);
    const { data: qual } = await adm().from("qualification_checklists").select("id, formulario, document_status").eq("property_id", imovelId).maybeSingle();
    expect(qual, "o envio do documento ligou o checklist ao rascunho").toBeTruthy();
    expect(qual!.document_status, "o documento está na fila do admin").toBe("pending");
    const formulario = (qual!.formulario ?? {}) as { elig?: Record<string, unknown> };
    await adm()
      .from("qualification_checklists")
      .update({ formulario: { versao: 1, ...formulario, elig: { ...(formulario.elig ?? {}), furnished: true, accepts30days: true, iptuOk: true, habitable: true, isOwnerOrAgent: true, condoAllows: "yes" } } })
      .eq("id", qual!.id);
    await p.context().close();

    // A Central: a conta de admin do laboratório aprova o documento pela tela.
    const ctxAdmin = await browser.newContext({ storageState: authFile("admin") });
    const pa = await ctxAdmin.newPage();
    await pa.goto("/admin/documentos", { waitUntil: "domcontentloaded" });
    const card = pa.getByTestId("doc-card").filter({ hasText: marca }).first();
    await expect(card, "o documento da jornada está na fila da Central").toBeVisible({ timeout: 30_000 });
    for (const cb of await card.getByRole("checkbox").all()) if (!(await cb.isChecked())) await cb.check();
    await card.getByRole("button", { name: "Aprovar" }).click();
    await expect
      .poll(async () => (await adm().from("qualification_checklists").select("document_status").eq("id", qual!.id).single()).data?.document_status, {
        timeout: 20_000,
        message: "a aprovação pela Central grava o documento como aprovado",
      })
      .toBe("approved");
    await ctxAdmin.close();

    // O dono publica pela tela.
    const p2 = await entrar(browser, contas.dono.email, senha);
    await p2.goto(`/dashboard/imoveis/novo?draft=${imovelId}&etapa=revisao`, { waitUntil: "domcontentloaded" });
    await noPasso(p2, "revisao", 30_000);
    await aceitarTermoIaSePreciso(p2);
    // E633: com a chave MATRICULA_OBRIGATORIA ligada (o lab das chaves), a matrícula atualizada também é obrigatória para
    // publicar; o dono envia a matrícula (fictícia, tests/fixtures) pela mesma tela. Conta como enviada qualquer conferência
    // dela (inclusive em revisão manual: prontidao-servidor.ts). Com a chave desligada (como na main), nada muda.
    if (process.env.NEXT_PUBLIC_MATRICULA_OBRIGATORIA === "on") {
      await abrirSecoesPasso10(p2, ["documento"]);
      const matricula = Buffer.concat([readFileSync("tests/fixtures/matricula-ficticia-dono.pdf"), Buffer.from(`% ${randomBytes(8).toString("hex")}\n`)]);
      await p2.getByTestId("documento-vinculo").locator('input[type="file"]').first().setInputFiles({ name: "matricula-jornada.pdf", mimeType: "application/pdf", buffer: matricula });
      await expect
        .poll(async () => ((await adm().from("property_ownership_checks").select("id").eq("property_id", imovelId)).data ?? []).length, {
          timeout: 30_000,
          message: "a matrícula enviada pela tela fica registada para o imóvel",
        })
        .toBeGreaterThan(0);
      await p2.reload({ waitUntil: "domcontentloaded" });
      await noPasso(p2, "revisao", 30_000);
      await aceitarTermoIaSePreciso(p2); // o "Revisei as informações" volta desmarcado depois de recarregar
    }
    const resolver = p2.getByTestId("conferencia-resolver-comodidades");
    const publicar = p2.getByTestId("publicar-anuncio");
    const pronto = await publicar.and(p2.locator(":enabled")).or(resolver).waitFor({ state: "visible", timeout: 20_000 }).then(() => true).catch(() => false);
    if (!pronto) console.log(`T2157 PUBLICAR bloqueado: ${(await p2.locator("main").innerText()).slice(0, 1500).replace(/\s+/g, " ")}`);
    await expect(publicar.and(p2.locator(":enabled")).or(resolver)).toBeVisible({ timeout: 5_000 });
    if (await resolver.isVisible()) {
      await resolver.click();
      await p2.getByTestId("conforto-marcar-todos").click();
      await continuarAte(p2, "comodidades", "revisao");
    }
    await expect(publicar, "com o documento aprovado, o anúncio pode ser publicado").toBeEnabled({ timeout: 20_000 });
    await publicar.click();
    // O que conta é o anúncio ficar ATIVO no servidor; a volta para Meus imóveis é o sinal da tela.
    const voltou = await p2.waitForURL(/\/dashboard\/imoveis(\?|$)/, { timeout: 30_000 }).then(() => true).catch(() => false);
    if (!voltou) {
      const alertas = await p2.locator('[role="alert"], [data-testid*="erro"], [data-testid="publicar-bloqueado"]').allInnerTexts();
      console.log(`T2157 PUBLICAR: ficou em ${p2.url()} · alertas: ${JSON.stringify(alertas)}`);
      console.log(`T2157 PUBLICAR: texto da página: ${(await p2.locator("main").innerText()).slice(0, 1500).replace(/\s+/g, " ")}`);
    }
    await expect
      .poll(async () => (await adm().from("properties").select("status").eq("id", imovelId).single()).data?.status, { timeout: 20_000, message: "o anúncio fica ativo depois de publicar pela tela" })
      .toBe("active");
    expect(voltou, "depois de publicar, a tela volta para Meus imóveis").toBe(true);
    const { data: pub } = await adm().from("properties").select("status, title, city, monthly_price").eq("id", imovelId).single();
    expect(pub, "publicado pela tela, em Uberlândia, com o título e o valor da jornada").toMatchObject({ status: "active", title: titulo, city: "Uberlândia" });
    expect(Number(pub!.monthly_price)).toBe(2157);
    jornada.publicado = imovelId;
    await p2.context().close();
  });

  // Etapa 3 (busca), preparada na ORDEM-DUET-151 e ainda NÃO aprovada: ativa-se depois da etapa 2 (#4007). O inquilino do
  // piloto procura em Uberlândia, acha na busca o anúncio publicado do dono do piloto e abre a página dele.
  // ORDEM-DUET-258: a semente saiu — o anúncio é o publicado pela tela na continuação da etapa 2 (antes, ORDEM-DUET-153,
  // nascia de criarImovelPronto).
  test("Etapa 3 — o inquilino acha na busca o anúncio que o dono publicou pela tela e abre a página dele", async ({ browser }) => {
    const titulo = `Studio da jornada T2157 ${sufixo}`;
    // ORDEM-DUET-258: sem semente — o anúncio é o que o dono publicou pela tela na etapa 2.
    expect(jornada.publicado, "o anúncio publicado pela tela na etapa 2").toBeTruthy();
    const page = await entrar(browser, contas.inquilino.email, senha);
    // E1047: conta os history.replaceState feitos pelo código da página (não os internos do Next, que levam __NA/_N): os
    // que repetem a URL atual — cada um vira um "restore" do router, que descarta o toque num card em curso — e a hora do
    // último, para clicar só com a busca assentada. O Next troca o history.replaceState ao montar o router; a armadilha no
    // setter embrulha também a versão dele, e assim o contador vê a chamada da página antes de o Next a carimbar.
    await page.context().addInitScript(() => {
      const w = window as unknown as { __e1047Repetidos: number; __e1047Ultimo: number };
      w.__e1047Repetidos = 0;
      w.__e1047Ultimo = 0;
      type Troca = (dados: unknown, nada: string, url?: string | URL | null) => void;
      const contar = (fn: Troca): Troca =>
        function (this: History, dados, nada, url) {
          const interno = !!dados && typeof dados === "object" && ("__NA" in dados || "_N" in dados);
          if (!interno) {
            if (url != null && new URL(String(url), location.href).href === location.href) w.__e1047Repetidos += 1;
            w.__e1047Ultimo = performance.now();
          }
          return fn.call(this, dados, nada, url);
        };
      let atual = contar(History.prototype.replaceState);
      Object.defineProperty(history, "replaceState", {
        configurable: true,
        get: () => atual,
        set: (fn: Troca) => {
          atual = contar(fn);
        },
      });
    });
    await page.goto("/buscar?local=Uberl%C3%A2ndia", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("card-resultado").first(), "a busca mostra resultados").toBeVisible({ timeout: 30_000 });
    const link = page.locator(`a[href="/imoveis/${jornada.publicado}"]`).first();
    await expect(link, "o anúncio do dono do piloto aparece na busca de Uberlândia").toBeVisible({ timeout: 20_000 });
    // A busca assentada: nenhum replaceState há 1 s.
    await expect
      .poll(() => page.evaluate(() => performance.now() - (window as unknown as { __e1047Ultimo: number }).__e1047Ultimo), {
        message: "a sincronização da URL da busca assenta",
        timeout: 15_000,
      })
      .toBeGreaterThan(1_000);
    expect(
      await page.evaluate(() => (window as unknown as { __e1047Repetidos: number }).__e1047Repetidos),
      "E1047: a /buscar não reescreve a URL com ela mesma (cada vez descarta um toque em curso)",
    ).toBe(0);
    const urlDoAnuncio = new RegExp(`/imoveis/${jornada.publicado}`);
    // O clique e a espera pela URL juntos; uma 2.ª tentativa só se a URL não mudar.
    const navegou = await Promise.all([page.waitForURL(urlDoAnuncio, { timeout: 10_000 }), link.click()]).then(
      () => true,
      () => false,
    );
    if (!navegou) {
      console.log("E1047: o 1.º clique no card não navegou; 2.ª tentativa");
      await Promise.all([page.waitForURL(urlDoAnuncio, { timeout: 20_000 }), link.click()]);
    }
    await expect(page, "abre a página do anúncio").toHaveURL(urlDoAnuncio, { timeout: 20_000 });
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
    await abrirPortaoDaIdentidade(pd);
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
    // E1071: "ontem" pelo dia de Brasília — o relógio da rotina que encerra (avancar_ciclo_blocos) e o jeito da t182. Com a
    // data em UTC, entre 00h e 03h UTC o "ontem" era o hoje de Brasília: o bloco não vencia e o contrato ficava "ativo".
    const hoje = hojeBR();
    const dia = (n: number) => addDiasISO(hoje, n);
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

    // E1248 (ORDENS-DUET 1317, 1318 e 1326; a ORDEM-1352 manda reescrever estes três sítios): a contestação leva o MOTIVO;
    // com a disputa aberta o dono lê só "contestada pelo morador" e a linha nova, sem o botão de registrar; ele anexa o
    // comprovante, a equipe decide no chamado que a devolução NÃO vale, e só então o dono regista de novo.
    const MOTIVO_DO_MORADOR = "Recebi R$ 100 a menos e não houve conversa sobre o desconto.";
    await test.step("extensão B — disputa: o inquilino contesta com o motivo, e o dono vê a contestação com a disputa aberta", async () => {
      await liberarLimiteChamados();
      await pi.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
      await pi.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      const caixa = pi.getByTestId("devolucao-caucao").first();
      await caixa.getByRole("button", { name: /Não recebi \/ discordo/ }).click();
      await caixa.getByTestId("devolucao-motivo").fill(MOTIVO_DO_MORADOR);
      await caixa.getByRole("button", { name: "Enviar a contestação" }).click();
      await expect.poll(async () => (await ultimoAcerto())?.status, { timeout: 20_000, message: "a contestação grava" }).toBe("desconto_contestado");
      // O estado muda primeiro; o chamado abre a seguir, na mesma ação.
      await expect
        .poll(async () => (await adm().from("caucao_acertos").select("chamado_id").eq("contrato_id", contratoId).order("created_at", { ascending: false }).limit(1).single()).data?.chamado_id ?? null, { timeout: 20_000, message: "o chamado da Central nasce" })
        .not.toBeNull();
      const { data: contestado } = await adm().from("caucao_acertos").select("contestacao_motivo, chamado_id").eq("contrato_id", contratoId).order("created_at", { ascending: false }).limit(1).single();
      expect(contestado?.contestacao_motivo, "o motivo do morador fica gravado").toBe(MOTIVO_DO_MORADOR);
      expect(contestado?.chamado_id, "o chamado da Central nasce").toBeTruthy();
      await pd.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
      const doDono = pd.getByTestId("devolucao-caucao").first();
      await expect(doDono, "o dono vê só \"contestada pelo morador\"").toContainText("contestada pelo morador.", { timeout: 20_000 });
      await expect(doDono).not.toContainText("fale pela Central de Ajuda");
      await expect(doDono.getByTestId("devolucao-disputa")).toHaveText("A equipe da Viva está analisando. O seu prazo fica suspenso até a decisão.");
      await expect(doDono.getByRole("button", { name: "Registrar devolução da caução" }), "com a disputa aberta, não regista outra").toHaveCount(0);
    });

    await test.step("extensão C — o dono anexa o comprovante e a equipe decide no chamado que a devolução não vale", async () => {
      const anexo = pd.getByTestId("devolucao-anexar").first();
      await anexo.getByTestId("devolucao-anexar-arquivo").setInputFiles({ name: "comprovante.pdf", mimeType: "application/pdf", buffer: await pdfQueAbre() });
      await anexo.getByRole("button", { name: "Anexar o comprovante" }).click();
      await expect
        .poll(async () => (await adm().from("caucao_acertos").select("comprovante_path").eq("contrato_id", contratoId).order("created_at", { ascending: false }).limit(1).single()).data?.comprovante_path ?? null, { timeout: 20_000, message: "o comprovante fica guardado" })
        .toMatch(/^[0-9a-f-]+\/[0-9a-f-]+\.pdf$/);
      const { data: ac } = await adm().from("caucao_acertos").select("chamado_id").eq("contrato_id", contratoId).order("created_at", { ascending: false }).limit(1).single();
      // O painel da equipe exige a sessão com o 2.º fator (AAL2): entra o admin do laboratório (a sessão do global-setup).
      const ctxEquipe = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
      const pe = await ctxEquipe.newPage();
      await pe.goto(`/admin/atendimento/${ac!.chamado_id}`, { waitUntil: "domcontentloaded" });
      const decisao = pe.getByTestId("central-devolucao");
      await expect(decisao).toBeVisible({ timeout: 20_000 });
      await expect(decisao.getByTestId("central-devolucao-comprovante"), "a equipe vê o comprovante").toBeVisible();
      await decisao.getByTestId("central-devolucao-motivo").fill("O valor devolvido não é o que o morador recebeu.");
      await decisao.getByTestId("central-devolucao-nao-confirmar").click();
      await expect(decisao.getByTestId("central-devolucao-decidida")).toBeVisible({ timeout: 20_000 });
      await ctxEquipe.close();
      await expect
        .poll(async () => (await adm().from("caucao_acertos").select("central_decisao").eq("contrato_id", contratoId).order("created_at", { ascending: false }).limit(1).single()).data?.central_decisao, { timeout: 20_000, message: "a decisão grava" })
        .toBe("nao_confirmada");
    });

    // 3. o dono registra pela tela a devolução integral da caução (depois do "não vale" da equipe, um novo acerto é permitido)
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

  // Etapa 10 (avaliação), preparada na ORDEM-DUET-206 e ainda NÃO aprovada: a última da sequência; ativa-se depois da etapa 9.
  // Avaliações às cegas pela tela, como na t182: o inquilino avalia o dono e a avaliação fica "enviada", sem aparecer ao dono;
  // quando o dono também avalia, as duas publicam e cada lado vê a do outro em "Avaliações recebidas".
  test("Etapa 10 — avaliação: às cegas, o inquilino avalia o dono, o dono avalia o inquilino e as duas publicam", async ({ browser }) => {
    test.setTimeout(240_000);
    const { data: contrato } = await adm().from("contratos").select("id").eq("lead_id", jornada.lead!).single();
    const contratoId = contrato!.id as string;
    // Só letras no comentário: número longo cai (com razão) no filtro de telefone e vai para a moderação (t182).
    const so = (t: string) => t.replace(/[^a-z ]/gi, "");
    const doInquilino = `Anfitriao atencioso na jornada do piloto ${so(sufixo)}`;
    const doDono = `Morador cuidadoso na jornada do piloto ${so(sufixo)}`;

    // 1. o inquilino avalia o dono, em Locações
    const pi = await entrar(browser, contas.inquilino.email, senha);
    await pi.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
    await pi.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await pi.getByRole("button", { name: "Avaliar o proprietário" }).click();
    await pi.getByRole("radio", { name: "5 estrelas" }).click();
    await pi.getByPlaceholder(/Comentário \(opcional\)/).fill(doInquilino);
    await preencherCriterios(pi);
    await pi.getByRole("button", { name: "Enviar avaliação" }).click();
    await expect(pi.getByText(/Avaliação enviada\. Ela aparece quando a outra parte também avaliar/), "a avaliação fica às cegas").toBeVisible({ timeout: 20_000 });
    await pi.context().close();
    await expect
      .poll(async () => (await adm().from("avaliacoes").select("status").eq("contrato_id", contratoId).eq("papel_autor", "inquilino").maybeSingle()).data?.status, { timeout: 20_000, message: "a avaliação do inquilino grava, ainda não publicada" })
      .toBe("enviada");

    // às cegas: o dono ainda não a vê
    const pd = await entrar(browser, contas.dono.email, senha);
    await pd.setViewportSize({ width: 1280, height: 900 });
    await pd.goto("/dashboard/avaliacoes?aba=recebidas", { waitUntil: "domcontentloaded" });
    await expect(pd.getByText("Nenhuma avaliação publicada ainda"), "o dono ainda não vê a avaliação").toBeVisible({ timeout: 20_000 });
    await expect(pd.locator("main")).not.toContainText(doInquilino);

    // 2. o dono avalia o inquilino, em Contratos: as duas publicam
    await pd.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    await pd.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await pd.getByRole("button", { name: "Avaliar o morador" }).first().click();
    await pd.getByRole("radio", { name: "5 estrelas" }).click();
    await pd.getByPlaceholder(/Comentário \(opcional\)/).fill(doDono);
    await preencherCriterios(pd);
    await pd.getByRole("button", { name: "Enviar avaliação" }).click();
    await expect(pd.getByText(/Avaliação enviada\./)).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(async () => ((await adm().from("avaliacoes").select("status").eq("contrato_id", contratoId)).data ?? []).map((a) => a.status).sort(), { timeout: 20_000, message: "as duas avaliações publicam" })
      .toEqual(["publicada", "publicada"]);

    // 3. cada lado vê a do outro
    await pd.goto("/dashboard/avaliacoes?aba=recebidas", { waitUntil: "domcontentloaded" });
    await expect(pd.getByTestId("avaliacao-recebida").filter({ hasText: doInquilino }), "o dono vê a avaliação do inquilino").toBeVisible({ timeout: 20_000 });
    await pd.context().close();
    const pi2 = await entrar(browser, contas.inquilino.email, senha);
    await pi2.goto("/dashboard/avaliacoes?aba=recebidas", { waitUntil: "domcontentloaded" });
    await expect(pi2.getByTestId("avaliacao-recebida").filter({ hasText: doDono }), "o inquilino vê a avaliação do dono").toBeVisible({ timeout: 20_000 });
    await pi2.context().close();
  });
});
