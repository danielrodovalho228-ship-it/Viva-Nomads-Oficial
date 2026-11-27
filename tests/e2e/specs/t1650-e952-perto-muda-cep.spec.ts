import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1650 — E952 (Daniel, 15/11): "O que tem por perto" nunca mostra lugares de outro endereço. Laboratório (integrações
  simuladas): o CEP 38414-536 (Jardim Europa) tem lista e ponto próprios (proximidadesDoLab); os demais CEPs, a lista de
  sempre. O rascunho já está SALVO no endereço A (ponto público, cep_proximidades e rua gravados — o caso do bug: o ponto
  velho vencia o endereço novo) e uma âncora oficial ("HC-UFU (lab E952)") fica a ~1 km do ponto A.
    1. Passo 5 com os lugares de A e o carimbo de A (a âncora aparece).
    2. Troca para B no Passo 3: de volta ao Passo 5, a lista de A NÃO está lá — "Procurando… CEP 38414-536" enquanto a
       resposta de B não chega (segurada pela rota); depois o carimbo de B e os lugares de B; NENHUM lugar de A (nem a âncora).
    3. Salvar (autosave do rascunho) e reabrir mantém a lista de B.
  390 e 1280 px, com prints rotulados "preview" em tests/laboratorio/saida/.
  Só @E952: depende da simulação do laboratório e de login (a trava do @ao-vivo-seguro do E951 não deixa — ver o PR).
*/
const SAIDA = "tests/laboratorio/saida";
const A = { cep: "38402-288", rua: "Rua Antiga E952", numero: "100" };
const B = { cep: "38414-536", rua: "Rua Nova E952", numero: "200" };
// Os que aparecem com A (até 3 por categoria: a âncora entra na Saúde no lugar do hospital, que fica a 1,8 km).
const LUGARES_A = ["Farmácia Central (exemplo do laboratório)", "Campus Santa Mônica (exemplo do laboratório)", "Supermercado do Bairro (exemplo do laboratório)", "HC-UFU (lab E952)"];
const LUGARES_B = ["Mercado Jardim Europa (exemplo do laboratório)", "Drogaria Jardim Europa (exemplo do laboratório)"];

test.describe("T1650 — E952: mudar o CEP troca o que tem por perto", { tag: ["@E952"] }, () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (lista simulada por CEP).");
  test.describe.configure({ mode: "serial", timeout: 240_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });
  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t1650.${sufixo}@lab.vivanomads.test`, nome: "Rita Endereço", role: "owner" as const };
  const ids: { dono?: string; destino?: string } = {};

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    // Âncora oficial a ~1 km do ponto A do laboratório (-18.918, -48.258) e a ~7 km do ponto B (Jardim Europa).
    const { data, error } = await adm()
      .from("destinos")
      .insert({ slug: `hc-ufu-lab-e952-${sufixo}`, nome: "HC-UFU (lab E952)", tipo: "hospital", cidade: "Uberlândia", uf: "MG", lat: -18.9175, lng: -48.2485, ativo: true })
      .select("id")
      .single();
    expect(error).toBeNull();
    ids.destino = (data as { id: string }).id;
  });
  test.afterAll(async () => {
    if (ids.destino) await adm().from("destinos").delete().eq("id", ids.destino);
    await apagarContas([ids.dono]);
  });

  /** Rascunho SALVO no endereço A: draft_data com A, e o ponto público/CEP/rua gravados juntos (como uma gravação completa). */
  async function rascunhoEmA(): Promise<string> {
    const id = await criarImovelPronto(ids.dono!, `Studio E952 ${novoSufixo()}`);
    const { data } = await adm().from("properties").select("draft_data").eq("id", id).single();
    const d: Record<string, unknown> = { ...((data?.draft_data as Record<string, unknown>) ?? {}), cep: A.cep, street: A.rua, numero: A.numero, city: "Uberlândia", uf: "MG" };
    delete d.proxOsm;
    delete d.proxChave;
    const { error } = await adm().from("properties").update({ draft_data: d, lat: -18.918, lng: -48.258, cep_proximidades: A.cep.replace("-", ""), exact_address: `${A.rua}, ${A.numero}` }).eq("id", id);
    expect(error).toBeNull();
    return id;
  }

  async function abrir(browser: Browser, w: number, id: string, etapa: string): Promise<Page> {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: w, height: w === 1280 ? 900 : 844 });
    await p.goto(`/dashboard/imoveis/novo?draft=${id}&etapa=${etapa}`, { waitUntil: "domcontentloaded" });
    return p;
  }
  async function print(p: Page, nome: string, w: number) {
    const bloco = p.getByTestId("proximidades-osm");
    await bloco.scrollIntoViewIfNeeded();
    await bloco.screenshot({ path: `${SAIDA}/t1650-preview-${nome}-${w}.png` });
  }

  for (const w of [390, 1280]) {
    test(`a ${w} px: A → B troca a lista e o carimbo; nada de A sobra; salvar e reabrir mantém B`, async ({ browser }) => {
      const id = await rascunhoEmA();

      // 1. Passo 5 com A.
      const p = await abrir(browser, w, id, "comodidades");
      const bloco = p.getByTestId("proximidades-osm");
      await expect(bloco).toHaveAttribute("data-estado", "achou", { timeout: 30_000 });
      await expect(p.getByTestId("proximidades-carimbo")).toHaveText(`Perto de: ${A.rua}, CEP ${A.cep}`);
      for (const n of LUGARES_A) await expect(bloco, n).toContainText(n);
      await print(p, "cep-a", w);

      // 2. Troca para B (Passo 3), com a resposta de B segurada para ver o estado do meio.
      let soltar: () => void = () => {};
      const segura = new Promise<void>((ok) => (soltar = ok));
      await p.route("**/api/proximidades", async (r) => {
        const corpo = r.request().postDataJSON() as { cep?: string } | null;
        if (corpo?.cep?.replace(/\D/g, "") === "38414536") await segura;
        await r.continue();
      });
      // Navega pela barra de passos (o rascunho de teste não tem os Detalhes completos, que o "Continuar" exige).
      await p.getByRole("button", { name: /^3\. Endereço/ }).click();
      await expect(p.getByTestId("cadastro-cep")).toBeVisible();
      await p.getByTestId("cadastro-cep").fill(B.cep);
      await p.getByTestId("cadastro-rua").fill(B.rua);
      await p.getByTestId("cadastro-numero").fill(B.numero);
      await p.getByTestId("cadastro-bairro").fill("Jardim Europa");
      await p.getByRole("button", { name: /^5\. Comodidades/ }).click();
      await expect(bloco).toBeVisible({ timeout: 20_000 });
      // Enquanto B não chega: nada de A na tela, e o aviso já diz o endereço novo.
      await expect(bloco).toHaveAttribute("data-estado", "carregando");
      await expect(p.getByTestId("proximidades-procurando")).toHaveText(`Procurando o que tem perto de ${B.rua}, CEP ${B.cep}…`);
      for (const n of LUGARES_A) await expect(bloco, `${n} não pode sobrar`).not.toContainText(n);
      await print(p, "procurando-b", w);
      soltar();

      await expect(bloco).toHaveAttribute("data-estado", "achou", { timeout: 30_000 });
      await expect(p.getByTestId("proximidades-carimbo")).toHaveText(`Perto de: ${B.rua}, CEP ${B.cep}`);
      for (const n of LUGARES_B) await expect(bloco, n).toContainText(n);
      for (const n of LUGARES_A) await expect(bloco, `${n} não pode aparecer depois da troca`).not.toContainText(n);
      await print(p, "cep-b", w);

      // 3. O autosave grava B (rascunho); reabrir mantém a lista de B.
      await expect
        .poll(async () => {
          const { data } = await adm().from("properties").select("draft_data").eq("id", id).single();
          const d = (data?.draft_data ?? {}) as { cep?: string; proxChave?: string | null; proxOsm?: { nome: string }[] };
          return d.cep === B.cep && !!d.proxChave && (d.proxOsm ?? []).some((l) => l.nome === LUGARES_B[0]);
        }, { timeout: 30_000 })
        .toBe(true);
      await p.context().close();

      const q = await abrir(browser, w, id, "comodidades");
      const de = q.getByTestId("proximidades-osm");
      await expect(de).toHaveAttribute("data-estado", "achou", { timeout: 30_000 });
      await expect(q.getByTestId("proximidades-carimbo")).toHaveText(`Perto de: ${B.rua}, CEP ${B.cep}`);
      for (const n of LUGARES_B) await expect(de, n).toContainText(n);
      for (const n of LUGARES_A) await expect(de, n).not.toContainText(n);
      await print(q, "reaberto-b", w);
      await q.context().close();
    });
  }
});
