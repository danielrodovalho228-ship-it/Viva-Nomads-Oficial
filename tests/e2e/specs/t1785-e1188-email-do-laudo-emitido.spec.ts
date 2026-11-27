import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, fotosDoRoteiro, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { ITENS_CHECKLIST } from "../../../src/config/checklist-avaliacao";

/*
  T1785 — E1188 @E1188 (ORDENS-DUET 852, 866 e 867; linha Parceiros). O e-mail "laudo emitido" diz os mesmos fatos que a
  tela do dono mostra do mesmo laudo: o número VIS, o resultado, o nível, quantos itens corrigir e a página pública de
  conferência. A frase vaga ("Veja o resultado, o que corrigir (se houver)…") saiu, e o assunto continua sem o número do
  documento (a régua dos assuntos; ORDEM-DUET-866).
  A spec faz o laudo sair pela tela do avaliador (um item não conforme → "com ressalvas") e lê o e-mail na caixa de
  e-mails do laboratório.
   1. O laudo sai pela tela; o e-mail do dono traz os fatos do laudo, e a tela do dono mostra os mesmos. O link do
      e-mail abre a página pública de conferência desse laudo. Print a 390 px da tela do dono.
  O que NÃO cobre (está na trava de unidade, e1188-emails-com-os-fatos-da-tela.test.ts): o laudo aprovado ("Nada a
  corrigir."), o reprovado, mais de um item e uma nova versão do laudo.
  Limite da caixa de e-mails: ela só guarda os e-mails de contas de teste. O dono desta spec é conta de teste; por isso o
  laudo que ela emite é um documento de teste (a conferência diz "documento de teste"). O texto do e-mail é o mesmo.
  Só contas de teste, numa cidade só desta spec. Laboratório; não é prova ao vivo no site.
*/
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Monte Alegre de Minas";
const PERTO = { latitude: -18.9178, longitude: -48.2772 };
const SILENCIO = { via_intensa: false, noturno_obra_100m: false, aviao_ferrovia: false, isolamento_acustico: false };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const HORA = 3_600_000;
/** O item que o avaliador marca como não conforme: é ele que torna o laudo "com ressalvas", com um item a corrigir. */
const ITEM = "iluminacao";

test.describe("T1785 — E1188: o e-mail do laudo emitido diz os fatos da tela @E1188", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t1785.${sufixo}@lab.vivanomads.test`, nome: "Dora Laudo", role: "owner" as const };
  const avaliador = { email: `aval.t1785.${sufixo}@lab.vivanomads.test`, nome: "Valdo Laudo", role: "tenant" as const };
  const TITULO = `Casa laudo t1785 ${sufixo}`;
  const ids: Record<string, string> = {};
  const cred = { id: "", numero: "" };

  async function comChave(page: Page) {
    await page.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(page.url()).origin }]);
  }
  async function entrarComChave(browser: Browser, email: string): Promise<Page> {
    const p = await entrar(browser, email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await comChave(p);
    return p;
  }
  type Email = { assunto: string; corpo: string };
  const emailsDoLaudo = async () =>
    (((await adm().from("emails_teste").select("assunto, corpo").eq("usuario_id", ids.dono).eq("evento", "vistoria_laudo_emitido")).data ?? []) as Email[]).filter((e) => e.corpo.includes(TITULO));

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.avaliador = await criarConta(avaliador, senha);
    // A caixa de e-mails do laboratório só guarda os de contas de teste.
    const t = await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    if (t.error) throw t.error;
    const { data: parc, error: eP } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.avaliador, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: avaliador.nome, slug: `aval-t1785-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (eP) throw eP;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "MAM" });
    const { data: c, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: parc.id, cidade: CIDADE, numero_credenciado: n, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test", conduta_versao: "2026-10-23", ativado_em: "2026-01-01T00:00:00Z" })
      .select("id, numero_credenciado")
      .single();
    if (eC) throw eC;
    cred.id = c.id as string;
    cred.numero = c.numero_credenciado as string;
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true, preco: 2600 });
    const im = await adm().from("properties").update({ city: CIDADE, lat: -18.9186, lng: -48.2772, lat_exata: -18.9186, lng_exata: -48.2772 }).eq("id", ids.imovel);
    if (im.error) throw im.error;
    // O pedido já com a visita marcada (duas horas atrás): o caminho até aqui — escolha, proposta, aceite e agenda — é da t1765.
    const { data: p, error: ePed } = await adm()
      .from("vistoria_pedidos")
      .insert({ property_id: ids.imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, status: "agendado", avaliador_id: cred.id, designado_em: new Date().toISOString(), agendado_para: new Date(Date.now() - 2 * HORA).toISOString() })
      .select("id")
      .single();
    if (ePed) throw ePed;
    ids.pedido = p.id as string;
    const d = await adm().from("vistoria_designacoes").insert({ pedido_id: ids.pedido, avaliador_id: cred.id, resposta: "aceita", respondido_em: new Date().toISOString() });
    if (d.error) throw d.error;
    // Tudo conforme (limpeza "pronto"), menos o item que o avaliador marca na tela; ruído e internet já medidos.
    const linhas = ITENS_CHECKLIST.filter((i) => i.chave !== ITEM).map((i) => ({ pedido_id: ids.pedido, chave: i.chave, valor: "tipo" in i && i.tipo === "limpeza" ? "pronto" : "conforme", observacao: null }));
    const ch = await adm().from("vistoria_checklist").upsert(linhas, { onConflict: "pedido_id,chave" });
    if (ch.error) throw ch.error;
    await adm().from("vistoria_pedidos").update({ ruido_respostas: SILENCIO }).eq("id", ids.pedido);
    const med = await adm().from("vistoria_medicoes").insert([
      { pedido_id: ids.pedido, tipo: "internet", ponto: "quarto_principal", download_mbps: 328, upload_mbps: 42, latencia_ms: 12, distancia_m: 90 },
      { pedido_id: ids.pedido, tipo: "internet", ponto: "trabalho", download_mbps: 328, upload_mbps: 42, latencia_ms: 12, distancia_m: 90 },
    ]);
    if (med.error) throw med.error;
  });

  test.afterAll(async () => {
    if (ids.dono) await adm().from("emails_teste").delete().eq("usuario_id", ids.dono);
    if (ids.imovel) {
      await adm().from("vistoria_bloqueios").delete().eq("property_id", ids.imovel);
      await adm().from("vistoria_laudos").delete().eq("property_id", ids.imovel);
      await adm().from("vistoria_pedidos").delete().eq("property_id", ids.imovel);
    }
    if (cred.id) await adm().from("avaliadores_credenciamento").delete().eq("id", cred.id);
    await apagarContas([ids.avaliador, ids.dono].filter(Boolean));
  });

  test("1. o laudo sai pela tela: o e-mail do dono diz o número, o resultado, o que corrigir e onde conferir — como a tela", async ({ browser }) => {
    test.setTimeout(240_000);

    // O avaliador faz a visita: um item não conforme, com a foto; conclui e assina o laudo.
    const a = await entrarComChave(browser, avaliador.email);
    await a.context().grantPermissions(["geolocation"]);
    await a.context().setGeolocation(PERTO);
    await a.goto(`/dashboard/parceiro/avaliacao/${ids.pedido}`, { waitUntil: "domcontentloaded" });
    await a.getByTestId(`item-${ITEM}-nao_conforme`).click({ timeout: 30_000 });
    await expect.poll(async () => (await adm().from("vistoria_checklist").select("valor").eq("pedido_id", ids.pedido).eq("chave", ITEM).maybeSingle()).data?.valor, { timeout: 15_000 }).toBe("nao_conforme");
    await a.getByTestId(`foto-item-${ITEM}`).locator('input[type="file"]').setInputFiles({ name: "item.png", mimeType: "image/png", buffer: PNG });
    await expect.poll(async () => ((await adm().from("vistoria_checklist_fotos").select("id").eq("pedido_id", ids.pedido).eq("item_chave", ITEM)).data ?? []).length, { timeout: 30_000 }).toBe(1);
    await fotosDoRoteiro(ids.pedido); // concluir exige a foto de cada ambiente do roteiro (preparo, direto no banco)
    await a.reload({ waitUntil: "domcontentloaded" });
    await a.getByTestId("concluir-visita").getByRole("button", { name: "Concluir a visita" }).click();
    await expect.poll(async () => (await adm().from("vistoria_pedidos").select("status").eq("id", ids.pedido).single()).data?.status, { timeout: 20_000 }).toBe("realizada");
    await a.reload({ waitUntil: "domcontentloaded" });
    await expect(a.getByTestId("laudo-revisao")).toHaveAttribute("data-resultado", "com_ressalvas");
    await a.getByTestId("enviar-laudo").getByTestId("laudo-nivel-conforto").click();
    await a.getByTestId("assino-laudo").getByRole("checkbox").check();
    await a.getByTestId("enviar-laudo").getByRole("button", { name: "Assinar laudo" }).click();
    await expect.poll(async () => (await adm().from("vistoria_pedidos").select("status").eq("id", ids.pedido).single()).data?.status, { timeout: 30_000 }).toBe("laudo_emitido");
    await a.context().close();

    const laudo = (await adm().from("vistoria_laudos").select("numero, versao, resultado").eq("pedido_id", ids.pedido).order("versao", { ascending: false }).limit(1).single()).data as { numero: string; versao: number; resultado: string };
    expect(laudo.resultado).toBe("com_ressalvas");
    expect(laudo.numero).toMatch(/^VIS-\d{4}-\d{6}$/);

    // O e-mail que o dono recebeu.
    await expect.poll(async () => (await emailsDoLaudo()).length, { timeout: 30_000, message: `o e-mail do laudo de ${TITULO}` }).toBe(1);
    const [email] = await emailsDoLaudo();

    // A tela do dono, do mesmo laudo.
    const d = await entrarComChave(browser, dono.email);
    await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
    const naTela = d.getByTestId("laudo-dono-resultado");
    await expect(naTela).toHaveAttribute("data-resultado", "com_ressalvas", { timeout: 30_000 });
    await expect(naTela).toContainText(`Laudo ${laudo.numero} · Com ressalvas · nível sustentado: Conforto`);
    const itens = await d.getByTestId("laudo-ressalva").count();
    expect(itens, "a lista 'O que corrigir' da tela").toBe(1);
    const conferir = await d.getByTestId("laudo-conferir").getAttribute("href");
    const codigo = new URL(conferir!, "http://lab.vivanomads.test").searchParams.get("codigo");
    expect(codigo, "o código do link 'Conferir o laudo' da tela").toMatch(/^[0-9a-f]{8,}$/);
    expect(await d.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await naTela.scrollIntoViewIfNeeded();
    await d.screenshot({ path: `${SAIDA}/t1785-laudo-na-tela-do-dono-390.png` });

    // O e-mail diz os mesmos fatos: o número, o resultado, o nível, quantos itens e o prazo da reverificação.
    expect(email.corpo).toContain(
      `o laudo de avaliação de ${TITULO} foi emitido e assinado pelo avaliador credenciado nº ${cred.numero}; a Viva guarda o registro. Laudo ${laudo.numero}. Resultado: Com ressalvas. Nível sustentado: Conforto. O que corrigir: ${itens} item. A reverificação desse item está incluída, pelo mesmo avaliador, em até 15 dias. Para conferir: `,
    );
    // A frase vaga saiu.
    expect(email.corpo).not.toMatch(/Veja o resultado|se houver/);
    // O assunto é o de sempre, sem o número do documento (a régua dos assuntos).
    expect(email.assunto).toMatch(/^O laudo de avaliação de Casa laudo t/);
    expect(email.assunto).not.toContain("VIS-");
    // O link do e-mail é o endereço direto da página pública de conferência — o mesmo código do link da tela.
    const link = email.corpo.split("Para conferir: ")[1].split(/\s/)[0];
    expect(link, "o endereço direto, legível na caixa de e-mails").toMatch(new RegExp(`^https?://[^\\s/]+/conferir/${codigo}$`));

    // E abre a conferência desse laudo.
    await d.goto(new URL(link).pathname, { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("conferir-numero")).toHaveText(laudo.numero, { timeout: 30_000 });
    await expect(d.getByTestId("conferir-resultado")).toHaveText("Com ressalvas");
    await d.context().close();
  });
});
