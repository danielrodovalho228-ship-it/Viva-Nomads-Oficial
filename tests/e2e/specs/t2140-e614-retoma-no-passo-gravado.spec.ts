import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";
import { prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T2140 — E614 (seguimento: a retoma) @E614. Trava escrita antes da correção (DUET-1519, item 3; a correção é do Code 2).
  Regra: o assistente grava em que passo o dono está (draft_data.step, com ordemEtapas), e reabrir o rascunho
  (`/dashboard/imoveis/novo?draft=<id>`, sem `etapa`) cai NESSE passo. No Passo 3 (Onde fica), a edição do dono grava e
  o topo mostra o indicador "Salvo às HH:MM".
  A montagem não deixa a retoma passar por acaso: o rascunho já tem tudo o que os passos pedem, por isso o "primeiro
  passo incompleto" (o que o assistente usa quando NÃO há passo gravado) nunca é o Passo 3. Abre gravado no Passo 2
  (Fotos), com ordemEtapas 5. Só chega ao Passo 3 se a navegação do dono tiver sido gravada.
    1. Reaberto sem `etapa`, o rascunho abre no Passo 2: confere a leitura do passo gravado antes de navegar.
    2. "Continuar" leva ao Passo 3, e o rascunho grava step = 2 (Passo 3), sem nenhuma edição.
    3. Reaberto noutra sessão, sem `etapa`, cai no Passo 3.
    4. (rascunho próprio, já gravado no Passo 3) No Passo 3, digitar o complemento mostra "Salvo às HH:MM", e o
       complemento fica gravado; reaberto sem `etapa`, segue no Passo 3 com o complemento.
    5. Regra nova do Gerente (DUET-1719, item 2): o rascunho RETOMADO mostra sempre a hora da última gravação, também no
       Passo 3, sem nenhuma edição. Reaberto (nos casos 3 e 4), o topo mostra "Salvo às HH:MM", com a hora da última
       gravação do rascunho, em Brasília (o navegador corre no fuso de São Paulo). Hoje o banco não guarda essa hora
       (properties não tem updated_at; a correção decide onde a guarda), por isso a spec mede a janela da última
       gravação que ela própria provoca: do clique/digitação até ao rascunho gravado, com um minuto de folga.
       Trava: vermelha na main até a correção do Code 2, depois da prova ao vivo das 20:00 (o Gerente viu ao vivo, duas
       vezes, que o indicador não aparece).
  390 e 1280 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
// Um dono por teste: os testes do arquivo correm em paralelo (fullyParallel).
const donoDe = (tag: string) => ({ email: `dono.t2140.${tag}.${sufixo}@lab.vivanomads.test`, nome: "Rita Retoma", role: "owner" as const });
const ids: Record<string, string> = {};
const PASSO_FOTOS = 1;
const PASSO_ENDERECO = 2;
// Tudo o que os passos pedem: sem passo gravado, o assistente abriria na Revisão, nunca no Passo 3.
const DADOS = {
  propertyType: "apartamento", bedrooms: "1", bathrooms: "1", areaM2: "40", maxGuests: "2",
  street: "Rua das Acácias", numero: "140", neighborhood: "Santa Mônica", city: "Uberlândia", uf: "MG",
  minPeriod: "30", monthlyPrice: "3200", garantias: { caucao_avista: true, caucao_parcelada: false, seguro_fianca: false },
  ordemEtapas: 5, step: PASSO_FOTOS, etapaMax: PASSO_FOTOS,
};

async function rascunho(id: string): Promise<Record<string, unknown>> {
  const { data } = await adm().from("properties").select("draft_data").eq("id", id).single();
  return (data?.draft_data as Record<string, unknown> | null) ?? {};
}

/** HH:MM de um instante em Brasília. */
const horaBR = (ms: number) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms));

/**
 * Regra 5: reaberto, sem editar nada, o topo mostra "Salvo às HH:MM" com a hora da última gravação do rascunho, que
 * aconteceu entre `desde` (a ação do dono) e `ate` (o rascunho já gravado no banco). Um minuto de folga para cada lado.
 */
async function salvoAsAoReabrir(page: Page, desde: number, ate: number) {
  const aceitas = new Set<string>();
  for (let t = desde - 60_000; t <= ate + 60_000; t += 30_000) aceitas.add(`Salvo às ${horaBR(t)}`);
  aceitas.add(`Salvo às ${horaBR(ate + 60_000)}`);
  const estado = page.getByTestId("estado-salvamento");
  await expect(estado, "o rascunho retomado mostra o indicador de salvamento, sem edição").toBeVisible({ timeout: 20_000 });
  await expect(estado, `com a hora da última gravação (${[...aceitas].join(" | ")})`).toHaveText(new RegExp([...aceitas].join("|")));
}

async function reabrir(browser: Browser, email: string, id: string, largura: number, etapa = ""): Promise<Page> {
  const contexto = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 }, timezoneId: "America/Sao_Paulo" });
  const page = await entrarNaPagina(await contexto.newPage(), email, senha);
  await page.goto(`/dashboard/imoveis/novo?draft=${id}${etapa ? `&etapa=${etapa}` : ""}`, { waitUntil: "domcontentloaded" });
  return page;
}

test.describe("T2140 — E614: reabrir o rascunho cai no passo gravado; o rascunho retomado mostra \"Salvo às\" @E614", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "default", timeout: 180_000 });

  test.afterAll(async () => {
    for (const k of Object.keys(ids).filter((k) => k.startsWith("r"))) await adm().from("properties").delete().eq("id", ids[k]);
    await apagarContas(Object.keys(ids).filter((k) => k.startsWith("dono")).map((k) => ids[k]));
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — Continuar até o Passo 3 grava o passo; reaberto sem etapa, cai no Passo 3`, async ({ browser }) => {
      const dono = donoDe(`a${largura}`);
      const donoId = (ids[`donoA${largura}`] = await criarConta(dono, senha));
      const id = (ids[`r${largura}`] = await prepararRascunho(donoId, `Rascunho T2140 ${largura} ${sufixo}`, DADOS, 8));

      // 1. a leitura do passo gravado: reaberto sem etapa, abre no Passo 2 (o gravado), não na Revisão
      const p1 = await reabrir(browser, dono.email, id, largura);
      await noPasso(p1, "fotos", 30_000);
      await p1.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

      // 2. Continuar: Passo 3, e o rascunho grava o passo (a navegação grava em silêncio, sem edição)
      await expect(p1.getByTestId("cadastro-continuar")).toBeEnabled({ timeout: 30_000 });
      const gravouDesde = Date.now();
      await p1.getByTestId("cadastro-continuar").click();
      await noPasso(p1, "endereco", 30_000);
      await expect
        .poll(async () => (await rascunho(id)).step, { timeout: 20_000, message: "o rascunho grava o passo em que o dono está (Passo 3 = step 2)" })
        .toBe(PASSO_ENDERECO);
      const gravouAte = Date.now();
      await p1.context().close();

      // 3. reaberto noutra sessão, sem etapa: cai no Passo 3
      const p2 = await reabrir(browser, dono.email, id, largura);
      await noPasso(p2, "endereco", 30_000);
      // 5. retomado no Passo 3, sem editar: "Salvo às" com a hora da última gravação
      await salvoAsAoReabrir(p2, gravouDesde, gravouAte);
      await p2.context().close();
    });

    test(`${largura} px — no Passo 3, a edição mostra "Salvo às HH:MM" e fica gravada; reaberto, segue no Passo 3`, async ({ browser }) => {
      // Rascunho próprio (já gravado no Passo 3): este teste não depende do anterior.
      const dono = donoDe(`b${largura}`);
      const donoId = (ids[`donoB${largura}`] = await criarConta(dono, senha));
      const id = (ids[`r2-${largura}`] = await prepararRascunho(donoId, `Rascunho T2140 b ${largura} ${sufixo}`, { ...DADOS, step: PASSO_ENDERECO, etapaMax: PASSO_ENDERECO }, 8));
      const complemento = `Bloco B ${sufixo}`;
      const p1 = await reabrir(browser, dono.email, id, largura, "endereco");
      await noPasso(p1, "endereco", 30_000);
      await p1.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      const gravouDesde = Date.now();
      await p1.getByTestId("cadastro-complemento").fill(complemento);
      const estado = p1.getByTestId("estado-salvamento");
      await expect(estado, "o indicador do topo diz que salvou").toHaveAttribute("data-estado", "saved", { timeout: 20_000 });
      await expect(estado).toHaveText(/Salvo às \d{2}:\d{2}/);
      await expect
        .poll(async () => (await rascunho(id)).complemento, { timeout: 20_000, message: "o complemento fica gravado no rascunho" })
        .toBe(complemento);
      const gravouAte = Date.now();
      await p1.context().close();

      const p2 = await reabrir(browser, dono.email, id, largura);
      await noPasso(p2, "endereco", 30_000);
      await expect(p2.getByTestId("cadastro-complemento")).toHaveValue(complemento, { timeout: 20_000 });
      // 5. retomado no Passo 3, sem editar: "Salvo às" com a hora da última gravação
      await salvoAsAoReabrir(p2, gravouDesde, gravouAte);
      await p2.context().close();
    });
  }
});
