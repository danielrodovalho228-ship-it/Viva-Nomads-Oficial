import { test, expect, type Browser, type Page, type Route } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T477 — Passo 5 (Comodidades), levantamento do Daniel de 25/10: E141, E143, E144, E145, E146 e o subtítulo da internet
  do E151 (o E142 é a t428). 390 e 1280 px, com prints. Só no laboratório.
   1. E141: o nível diz que o Essencial é declarado e publica sem foto; subir de nível é "opcional"; nenhum
      "Falta foto de" no topo. E151: o item de internet medida não repete o título no subtítulo.
   2. E143: Ruído e Extras dentro do passo, atrás de toggles; "Responder sobre o ruído" liga o toggle; sem link para a
      página antiga. Ruído respondido e salvo aqui mesmo.
   3. E144 (1280): com o QR aberto, o botão "Fotografar pelo celular" sai; fechar devolve o botão.
   4. E145: a busca não respondeu → "não respondeu agora" + "Tentar de novo" (que busca de novo e mostra os lugares);
      o manual é um link discreto. Um rascunho com a lista vazia guardada busca de novo ao entrar.
   5. E146: essenciais e opcionais em linhas separadas; o contador bate com os essenciais marcados.
   6. E143 (decisão do Muse): anúncio publicado → a seção "Nível do anúncio" da edição (#secao-nivel abre sozinha, com
      Ruído e Extras); a captura no celular continua na página antiga, com "Voltar …" para o destino de cada caso.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t477.${sufixo}@lab.vivanomads.test`, nome: "Clara Comodidades", role: "owner" as const };
const ids: { dono?: string; rascunho?: string; ativo?: string } = {};
const LUGAR = { tipo: "farmacia", categoria: "saude", nome: "Farmácia do Centro (lab)", distanciaM: 220, lat: -18.91, lng: -48.27 };

async function abrir(browser: Browser, w: number, responder?: (r: Route) => Promise<void>): Promise<Page> {
  const p = await entrar(browser, dono.email, senha);
  await p.setViewportSize({ width: w, height: w === 1280 ? 900 : 844 });
  if (responder) await p.route("**/api/proximidades", responder);
  await p.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=comodidades`, { waitUntil: "domcontentloaded" });
  await expect(p.getByTestId("nivel-cadastro-agora")).toBeVisible({ timeout: 30_000 });
  return p;
}
const json = (corpo: unknown) => (r: Route) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corpo) });
const semRolagemLateral = async (p: Page) => expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

test.describe("T477 — Passo 5: comodidades, nível opcional, por perto", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.rascunho = await criarImovelPronto(ids.dono, `Studio do passo 5 ${sufixo}`);
    const { data } = await adm().from("properties").select("draft_data").eq("id", ids.rascunho).single();
    // A lista vazia guardada de uma busca que falhou (o caso do E145) e 3 essenciais + 2 opcionais marcados (E146).
    const d: Record<string, unknown> = {
      ...((data?.draft_data as Record<string, unknown>) ?? {}),
      cep: "38400-100",
      street: "Avenida Afonso Pena",
      numero: "100",
      city: "Uberlândia",
      uf: "MG",
      proxOsm: [],
      amenityKeys: { home_office: true, mesa_trabalho: true, cadeira_ergonomica: true, ambiente_silencioso: true, iluminacao_boa: true },
    };
    await adm().from("properties").update({ draft_data: d }).eq("id", ids.rascunho);
    ids.ativo = await criarImovelPronto(ids.dono, `Studio publicado ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`1–2, 4–5. a ${w} px`, async ({ browser }) => {
      let chamadas = 0;
      // 1ª chamada: o provedor não respondeu; a 2ª ("Tentar de novo") acha um lugar.
      const p = await abrir(browser, w, async (r) => {
        chamadas++;
        await json(chamadas === 1 ? { itens: [], fonte: "sem_ponto" } : { itens: [LUGAR], fonte: "osm" })(r);
      });

      // 1. E141 — uma cobrança só, e o Essencial declarado.
      await expect(p.getByTestId("deteccao-falta")).toHaveCount(0);
      await expect(p.getByTestId("nivel-cadastro-declarado")).toHaveText("O Essencial é o que você declara no padrão mínimo: publica sem foto nenhuma.");
      const subir = p.getByTestId("nivel-cadastro-subir");
      if (await subir.count()) await expect(subir).toContainText("opcional");
      // E151 — o subtítulo do item de internet medida não repete o título.
      const internet = p.getByTestId("nivel-cadastro-item-internet_medida_quarto");
      if (await internet.count()) await expect(internet).not.toContainText("Medição válida no quarto principal");

      // 5. E146 — duas linhas; o contador bate com os essenciais marcados.
      const essenciais = p.getByTestId("trabalho-essenciais");
      const marcados = await essenciais.locator('button[aria-pressed="true"]').count();
      expect(marcados).toBe(3);
      await expect(p.getByTestId("trabalho-contador")).toHaveText(`${marcados} de 4 itens essenciais`);
      await expect(p.getByTestId("trabalho-opcionais").locator('button[aria-pressed="true"]')).toHaveCount(2);
      await p.getByTestId("pronto-trabalhar").scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t477-trabalho-${w}.png` });

      // 4. E145 — a lista vazia guardada buscou de novo ao entrar; "não respondeu" ≠ "não há lugares".
      const perto = p.getByTestId("proximidades-osm");
      await expect(perto).toHaveAttribute("data-estado", "indisponivel", { timeout: 30_000 });
      expect(chamadas).toBeGreaterThanOrEqual(1);
      await expect(p.getByTestId("proximidades-vazio")).toHaveCount(0);
      const manual = p.getByTestId("proximidades-adicionar");
      await expect(manual).toHaveText("Adicionar um lugar");
      expect(await manual.evaluate((e) => getComputedStyle(e).textDecorationLine)).toContain("underline");
      await perto.scrollIntoViewIfNeeded();
      await perto.screenshot({ path: `${SAIDA}/t477-perto-indisponivel-${w}.png` });
      await p.getByTestId("proximidades-tentar").click();
      await expect(perto).toHaveAttribute("data-estado", "achou", { timeout: 20_000 });
      await expect(perto.getByTestId("proximidade-item")).toHaveCount(1);
      await perto.screenshot({ path: `${SAIDA}/t477-perto-achou-${w}.png` });

      // 2. E143 — Ruído e Extras no passo, com toggles; nenhum link para a página antiga.
      await expect(p.locator('a[href*="/nivel"]')).toHaveCount(0);
      const ruido = p.getByTestId("bloco-nivel-ruido");
      const extras = p.getByTestId("bloco-nivel-extras");
      // Na 1ª largura nada foi salvo: os dois nascem desligados (na 2ª, o ruído salvo faz o bloco nascer ligado).
      if (w === 390) await expect(ruido).toHaveAttribute("data-ligado", "nao");
      await expect(extras).toHaveAttribute("data-ligado", "nao");
      const responder = p.locator('[data-testid^="nivel-cadastro-ruido-"]').first();
      if (await responder.count()) await responder.click();
      else if ((await ruido.getAttribute("data-ligado")) === "nao") await p.getByTestId("bloco-nivel-ruido-toggle").click();
      await expect(ruido).toHaveAttribute("data-ligado", "sim");
      const form = ruido.getByTestId("ruido-form");
      for (const nao of await form.locator('input[data-testid$="-nao"]').all()) await nao.check();
      await form.getByTestId("ruido-salvar").click();
      await expect(form.getByTestId("ruido-resultado")).toBeVisible({ timeout: 20_000 });
      await p.getByTestId("bloco-nivel-extras-toggle").click();
      await expect(extras.getByTestId("extras-form")).toBeVisible();
      await semRolagemLateral(p);
      await p.getByTestId("nivel-cadastro").scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t477-nivel-${w}.png` });
      await p.context().close();
    });
  }

  test("3. E144 a 1280: com o QR aberto, um caminho por vez", async ({ browser }) => {
    const p = await abrir(browser, 1280, json({ itens: [LUGAR], fonte: "osm" }));
    const botao = p.locator('[data-testid^="nivel-cadastro-foto-"][data-testid$="-botao"]').first();
    await expect(botao).toHaveText("Fotografar pelo celular", { timeout: 30_000 });
    const id = (await botao.getAttribute("data-testid"))!.replace(/-botao$/, "");
    const chave = id.replace(/^nivel-cadastro-foto-/, "");
    await botao.click();
    const caixa = p.getByTestId(`prova-celular-${chave}`);
    await expect(caixa).toBeVisible({ timeout: 20_000 });
    await expect(p.getByTestId(`${id}-botao`)).toHaveCount(0);
    await caixa.scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${SAIDA}/t477-qr-aberto-1280.png` });
    await caixa.getByTestId("prova-celular-fechar").click();
    await expect(p.getByTestId(`${id}-botao`)).toBeVisible();
    await p.context().close();
  });

  for (const w of [390, 1280] as const) {
    test(`6. a ${w} px: publicado → nível na edição; captura com o caminho de volta`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 1280 ? 900 : 844 });
      await p.goto(`/dashboard/imoveis/${ids.ativo}/editar#secao-nivel`, { waitUntil: "domcontentloaded" });
      const secao = p.getByTestId("secao-nivel");
      await expect(secao).toHaveAttribute("data-aberta", "true", { timeout: 30_000 });
      await expect(secao.getByTestId("nivel-cadastro-agora")).toBeVisible({ timeout: 30_000 });
      await expect(secao.getByTestId("bloco-nivel-ruido")).toBeVisible();
      await expect(secao.getByTestId("bloco-nivel-extras")).toBeVisible();
      await expect(secao.getByRole("button", { name: "Salvar seção" })).toHaveCount(0);
      await semRolagemLateral(p);
      await secao.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t477-edicao-nivel-${w}.png` });

      // A captura (o destino do QR) continua na página antiga e volta ao lugar de cada caso.
      await p.goto(`/dashboard/imoveis/${ids.ativo}/nivel?fotografar=cozinha_microondas#nivel-itens`, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("nivel-captura-voltar")).toHaveAttribute("href", `/dashboard/imoveis/${ids.ativo}/editar#secao-nivel`, { timeout: 30_000 });
      await expect(p.getByTestId("nivel-captura-voltar")).toHaveText("Voltar à edição do anúncio");
      await p.goto(`/dashboard/imoveis/${ids.rascunho}/nivel?fotografar=cozinha_microondas#nivel-itens`, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("nivel-captura-voltar")).toHaveAttribute("href", `/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=comodidades#nivel-cadastro`, { timeout: 30_000 });
      await p.context().close();
    });
  }
});
