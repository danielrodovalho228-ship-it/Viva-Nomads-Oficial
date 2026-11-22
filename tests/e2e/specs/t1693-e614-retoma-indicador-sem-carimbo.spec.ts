import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";
import { prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T1693 — E614 (ORDEM-DUET-137, 18/11): a t2140 passava no laboratório e a produção reabria o rascunho sem o indicador
  "Salvo às HH:MM" (3ª reprodução ao vivo, ronda das 18:00). A t2140 só confere o indicador depois de ela própria
  provocar uma gravação com o código novo, num rascunho completo. Esta trava cobre os caminhos que ficaram de fora e que
  são os de produção. Fonte da hora (Gerente, ORDEM-DUET-139/140): o carimbo `salvoEm` do rascunho; na falta dele, a hora
  da última gravação da linha (`properties.updated_at`, migração 0346).
    A) Rascunho ANTERIOR à regra (sem `salvoEm` no draft_data — os 39 de produção estavam assim), só reaberto, sem tocar
       em nada: abre no passo gravado e o topo mostra "Salvo às HH:MM" com a hora da última gravação da linha; na linha
       que ainda não foi regravada depois da 0346 (updated_at nulo, como todas as de produção no dia da migração), a
       hora da criação. Abrir não grava nada: o rascunho e a hora da linha ficam como estavam (E516).
    B) Anúncio NOVO nascido pela tela (Qualificação respondida → "Começar o cadastro"): o rascunho nasce carimbado;
       "Continuar" até o Passo 2 grava o passo mesmo sem nenhum conteúdo digitado; reaberto noutra sessão, sem `etapa`,
       cai no Passo 2 e mostra "Salvo às HH:MM" da última gravação.
    C) A outra fonte da retoma, a cópia do navegador (anúncio que ainda não existe no servidor): "Continuar de onde
       parei" volta ao Passo 2 e mostra "Salvo às HH:MM" da hora em que a cópia foi guardada.
  390 e 1280 px. O navegador corre no fuso de São Paulo.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const donoDe = (tag: string) => ({ email: `dono.t1693.${tag}.${sufixo}@lab.vivanomads.test`, nome: "Rita Retoma", role: "owner" as const });
const contas: string[] = [];
const rascunhos: string[] = [];
const PASSO_FOTOS = 1;
// Tudo o que os passos pedem: sem passo gravado, o assistente abriria na Revisão, nunca no Passo 2.
const DADOS = {
  propertyType: "apartamento", bedrooms: "1", bathrooms: "1", areaM2: "40", maxGuests: "2",
  street: "Rua das Acácias", numero: "140", neighborhood: "Santa Mônica", city: "Uberlândia", uf: "MG",
  minPeriod: "30", monthlyPrice: "3200", garantias: { caucao_avista: true, caucao_parcelada: false, seguro_fianca: false },
  ordemEtapas: 5, step: PASSO_FOTOS, etapaMax: PASSO_FOTOS,
};

async function linha(id: string): Promise<{ updated_at: string | null; created_at: string }> {
  const { data, error } = await adm().from("properties").select("updated_at, created_at").eq("id", id).single();
  if (error) throw error;
  return data as { updated_at: string | null; created_at: string };
}

async function rascunho(id: string): Promise<Record<string, unknown>> {
  const { data } = await adm().from("properties").select("draft_data").eq("id", id).single();
  return (data?.draft_data as Record<string, unknown> | null) ?? {};
}

/** HH:MM de um instante em Brasília. */
const horaBR = (ms: number) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms));

async function abrir(browser: Browser, email: string, largura: number, rota: string): Promise<Page> {
  const contexto = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 }, timezoneId: "America/Sao_Paulo" });
  const page = await entrarNaPagina(await contexto.newPage(), email, senha);
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  return page;
}

/** Responde as 5 telas da Qualificação com tudo "sim" (12 de 12) e chega ao Resultado. */
async function responderQualificacao(p: Page) {
  for (const t of ["cama-sim", "apoio-sim", "ventilacao-ar"]) await p.getByTestId(`qualificacao-opcao-${t}`).click();
  await p.getByTestId("qualificacao-continuar").click();
  for (const t of ["cozinha-completa", "roupa-todos"]) await p.getByTestId(`qualificacao-opcao-${t}`).click();
  await p.getByTestId("qualificacao-continuar").click();
  for (const t of ["agua-sim", "lavanderia-imovel"]) await p.getByTestId(`qualificacao-opcao-${t}`).click();
  await p.getByTestId("qualificacao-continuar").click();
  for (const t of ["luz", "fechadura", "limpa", "mobilia"]) await p.getByTestId(`qualificacao-opcao-${t}-sim`).click();
  await p.getByTestId("qualificacao-continuar").click();
  await p.getByTestId("qualificacao-mbps").fill("300");
  await p.getByTestId("qualificacao-continuar").click();
  await expect(p.getByTestId("qualificacao-resultado")).toBeVisible({ timeout: 20_000 });
}

test.describe("T1693 — E614: o rascunho retomado mostra \"Salvo às\" também sem carimbo, no anúncio nascido pela tela e pela cópia do navegador @E614", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "default", timeout: 180_000 });

  test.afterAll(async () => {
    for (const id of rascunhos) await adm().from("properties").delete().eq("id", id);
    await apagarContas(contas);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — A) rascunho anterior à regra (sem carimbo), só reaberto: Passo 2 com "Salvo às" da última gravação da linha; abrir não grava`, async ({ browser }) => {
      const dono = donoDe(`a${largura}`);
      const donoId = await criarConta(dono, senha);
      contas.push(donoId);
      // Horas de outro dia e de outra altura do dia: o indicador tem de mostrar a hora gravada, não a de agora.
      const criadoEm = Date.now() - (5 * 24 * 60 + 557) * 60_000;
      const atualizadoEm = Date.now() - (2 * 24 * 60 + 313) * 60_000;
      const montar = async (tag: string, updatedAt: string | null) => {
        const id = await prepararRascunho(donoId, `Rascunho T1693 ${tag} ${largura} ${sufixo}`, DADOS, 8);
        rascunhos.push(id);
        // Por último, e de propósito: o gatilho da 0346 respeita a hora gravada assim.
        const { error } = await adm().from("properties").update({ created_at: new Date(criadoEm).toISOString(), updated_at: updatedAt }).eq("id", id);
        if (error) throw error;
        expect((await rascunho(id)).salvoEm, "a montagem: o rascunho não tem carimbo, como os anteriores à regra").toBeUndefined();
        expect((await linha(id)).updated_at === null, "a montagem: a hora da linha é a pedida").toBe(updatedAt === null);
        return id;
      };
      const regravado = await montar("regravado", new Date(atualizadoEm).toISOString());
      const intocado = await montar("intocado", null);
      const horas = new Set([horaBR(criadoEm), horaBR(atualizadoEm), horaBR(Date.now()), horaBR(Date.now() + 60_000), horaBR(Date.now() + 120_000)]);
      expect(horas.size, "a montagem distingue a hora da criação, a da última gravação e a de agora").toBe(5);

      for (const [id, hora, qual] of [[regravado, horaBR(atualizadoEm), "a da última gravação da linha"], [intocado, horaBR(criadoEm), "a da criação (linha ainda não regravada)"]] as const) {
        const antes = await linha(id);
        const p = await abrir(browser, dono.email, largura, `/dashboard/imoveis/novo?draft=${id}`);
        await noPasso(p, "fotos", 30_000);
        const estado = p.getByTestId("estado-salvamento");
        await expect(estado, "o rascunho retomado mostra o indicador de salvamento, sem edição").toBeVisible({ timeout: 20_000 });
        await expect(estado).toHaveAttribute("data-estado", "saved");
        await expect(estado, `com a hora conhecida da gravação: ${qual}`).toHaveText(`Salvo às ${hora}`);

        // Abrir não é editar (E516): passado o tempo do autosave, o rascunho e a hora da linha continuam como estavam.
        await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
        await p.waitForTimeout(4_000);
        const depois = await rascunho(id);
        expect(depois.salvoEm, "abrir não grava carimbo no rascunho").toBeUndefined();
        expect(depois.step, "abrir não muda o passo gravado").toBe(PASSO_FOTOS);
        expect(await linha(id), "abrir não regrava a linha do imóvel").toEqual(antes);
        await expect(estado, "e o indicador não muda de hora sozinho").toHaveText(`Salvo às ${hora}`);
        await p.context().close();
      }
    });

    test(`${largura} px — B) anúncio novo pela Qualificação: nasce carimbado; Continuar até o Passo 2 grava o passo sem conteúdo; reaberto, Passo 2 com "Salvo às"`, async ({ browser }) => {
      const dono = donoDe(`b${largura}`);
      const donoId = await criarConta(dono, senha);
      contas.push(donoId);

      const p1 = await abrir(browser, dono.email, largura, "/dashboard/imoveis/novo");
      await expect(p1.getByTestId("qualificacao")).toBeVisible({ timeout: 40_000 });
      await responderQualificacao(p1);
      const nasceuDesde = Date.now();
      await p1.getByTestId("qualificacao-comecar").click();
      await noPasso(p1, "tipo", 30_000);
      await expect(p1).toHaveURL(/draft=/, { timeout: 20_000 });
      const id = new URL(p1.url()).searchParams.get("draft")!;
      rascunhos.push(id);
      // O rascunho criado ao sair da Qualificação já nasce com a hora da gravação.
      const aoNascer = await rascunho(id);
      expect(typeof aoNascer.salvoEm, "o rascunho criado pela Qualificação nasce carimbado").toBe("string");
      const carimbo = Date.parse(aoNascer.salvoEm as string);
      expect(carimbo).toBeGreaterThanOrEqual(nasceuDesde - 60_000);
      expect(carimbo).toBeLessThanOrEqual(Date.now() + 60_000);

      // Continuar até o Passo 2, sem digitar nada: o passo tem de chegar ao servidor.
      const gravouDesde = Date.now();
      await p1.getByTestId("cadastro-continuar").click();
      await noPasso(p1, "fotos", 30_000);
      await expect
        .poll(async () => (await rascunho(id)).step, { timeout: 20_000, message: "o rascunho sem conteúdo grava o passo em que o dono está (Passo 2 = step 1)" })
        .toBe(PASSO_FOTOS);
      const gravouAte = Date.now();
      await p1.context().close();

      // Reaberto noutra sessão, sem etapa: Passo 2 e "Salvo às" da última gravação.
      const p2 = await abrir(browser, dono.email, largura, `/dashboard/imoveis/novo?draft=${id}`);
      await noPasso(p2, "fotos", 30_000);
      const aceitas = new Set<string>();
      for (let t = gravouDesde - 60_000; t <= gravouAte + 60_000; t += 30_000) aceitas.add(`Salvo às ${horaBR(t)}`);
      aceitas.add(`Salvo às ${horaBR(gravouAte + 60_000)}`);
      const estado = p2.getByTestId("estado-salvamento");
      await expect(estado, "o rascunho retomado mostra o indicador de salvamento, sem edição").toBeVisible({ timeout: 20_000 });
      await expect(estado, `com a hora da última gravação (${[...aceitas].join(" | ")})`).toHaveText(new RegExp(`^\\s*(${[...aceitas].join("|")})\\s*$`));
      await p2.context().close();
    });

    test(`${largura} px — C) retoma pela cópia do navegador (anúncio ainda sem rascunho no servidor): "Continuar de onde parei" volta ao Passo 2 com "Salvo às"`, async ({ browser }) => {
      const dono = donoDe(`c${largura}`);
      const donoId = await criarConta(dono, senha);
      contas.push(donoId);
      const chave = `vivanomads-novo-draft:${donoId}`;
      const copia = (p: Page) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "{}") as Record<string, unknown>, chave);

      const p = await abrir(browser, dono.email, largura, "/dashboard/imoveis/novo");
      await expect(p.getByTestId("qualificacao")).toBeVisible({ timeout: 40_000 });
      // Uma resposta dada e "Responder depois": o anúncio fica só no navegador (nada digitado que crie o rascunho).
      await p.getByTestId("qualificacao-opcao-cama-sim").click();
      await p.getByTestId("qualificacao-depois").click();
      await noPasso(p, "tipo", 30_000);
      const guardouDesde = Date.now();
      await p.getByTestId("cadastro-continuar").click();
      await noPasso(p, "fotos", 30_000);
      await expect.poll(async () => (await copia(p)).step, { timeout: 20_000, message: "a cópia do navegador guarda o passo em que o dono está" }).toBe(PASSO_FOTOS);
      const guardouAte = Date.now();
      expect(typeof (await copia(p)).salvoEm, "a cópia do navegador leva a hora em que foi guardada").toBe("string");
      const { count } = await adm().from("properties").select("id", { count: "exact", head: true }).eq("owner_id", donoId);
      expect(count, "a montagem: não há rascunho no servidor — a retoma só pode vir da cópia do navegador").toBe(0);

      // Entra de novo no "Novo anúncio", no mesmo navegador: o aviso oferece a retomada da cópia local.
      await p.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("rascunho-aviso")).toBeVisible({ timeout: 40_000 });
      await p.getByTestId("rascunho-continuar").click();
      await noPasso(p, "fotos", 30_000);
      const aceitas = new Set<string>();
      for (let t = guardouDesde - 60_000; t <= guardouAte + 60_000; t += 30_000) aceitas.add(`Salvo às ${horaBR(t)}`);
      aceitas.add(`Salvo às ${horaBR(guardouAte + 60_000)}`);
      const estado = p.getByTestId("estado-salvamento");
      await expect(estado, "a retoma pela cópia do navegador mostra o indicador de salvamento").toBeVisible({ timeout: 20_000 });
      await expect(estado, `com a hora em que a cópia foi guardada (${[...aceitas].join(" | ")})`).toHaveText(new RegExp(`^\\s*(${[...aceitas].join("|")})\\s*$`));
      await p.context().close();
    });
  }
});
