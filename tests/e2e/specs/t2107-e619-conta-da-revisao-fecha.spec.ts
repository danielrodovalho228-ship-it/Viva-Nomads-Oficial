import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2107 — E619 (Pista 3; varredura "sem spec" das 142, lote F) @E619 — sem @ao-vivo-seguro: precisa de sessão e do
  laboratório (VERMELHO PENDENTE DE LABORATÓRIO).
  Regra decidida (E619; unitário e619-conta-da-revisao.test.ts): o "Faltam N itens" da Revisão fecha à primeira
  leitura. Logo abaixo do título da lista vem a linha "A conta: X itens em Y passos da lista + Z no “Antes de
  publicar” = N." — e, sem o aceite do termo da IA, "Também falta o aceite do termo da IA, no fim desta coluna.".
  O que se mede (sem fixar números do rascunho, que dependem da prontidão do dia):
    - a linha da conta existe, abaixo do título, enquanto não dá para publicar;
    - X = os subitens pendentes da lista (data-faltam da lista), Y = os passos pendentes (linhas com data-ok="0");
    - a soma da conta é o N do título "Faltam N…";
    - o aceite do termo aparece à parte (rascunho novo ainda sem aceite).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2107.${sufixo}@lab.vivanomads.test`, nome: "Conta Revisao", role: "owner" as const };
const ids: Record<string, string> = {};

const RE_CONTA = /^A conta: (?:(\d+) (?:item|itens) em (\d+) (?:passo|passos) da lista)?(?: \+ )?(?:(\d+) no “Antes de publicar”)?(?: = (\d+))?\./;

test.describe("T2107 — E619: a conta da Revisão fecha o Faltam N do título @E619", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    // Rascunho com faltas em vários passos (sem fotos, sem tipo de entrada, sem o padrão mínimo, sem documento).
    const { data, error } = await adm()
      .from("properties")
      .insert({
        owner_id: ids.dono, title: `Rascunho T2107 ${sufixo}`, description: "Rascunho do laboratório para conferir a conta da Revisão, com faltas em vários passos.",
        property_type: "Apartamento", address: "Centro", city: "Uberlândia", state: "MG", bedrooms: 1, bathrooms: 1, area_m2: 40, max_guests: 2,
        min_period_days: 30, max_period_days: 180, monthly_price: 3000, status: "draft",
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.rascunho = data.id as string;
  });

  test.afterAll(async () => {
    if (ids.rascunho) await adm().from("properties").delete().eq("id", ids.rascunho);
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — a linha da conta soma o que a lista e o Antes de publicar mostram`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=revisao`, { waitUntil: "domcontentloaded" });

      const lista = p.getByTestId("lista-conferencia");
      await expect(lista).toBeVisible({ timeout: 30_000 });
      const conta = p.getByTestId("conferencia-conta");
      await expect(conta, "a conta à vista enquanto não dá para publicar").toBeVisible();
      // Logo abaixo do título da lista.
      const vizinho = await conta.evaluate((e) => e.previousElementSibling?.id ?? "");
      expect(vizinho).toBe("lista-conferencia-titulo");

      const texto = (await conta.innerText()).trim();
      const m = texto.match(RE_CONTA);
      expect(m, `a linha segue o formato da conta: ${texto}`).not.toBeNull();
      const naLista = Number(m![1] ?? 0);
      const passos = Number(m![2] ?? 0);
      const naRevisao = Number(m![3] ?? 0);
      const soma = m![4] === undefined ? naLista + naRevisao : Number(m![4]);
      expect(naLista + naRevisao, "a soma da conta fecha").toBe(soma);
      if (naLista > 0 && naRevisao > 0) expect(m![4], "com as duas partes, a conta mostra o total").toBeDefined();

      // As partes batem com o que a lista mostra.
      expect(String(naLista), "X = subitens pendentes da lista").toBe(await lista.getAttribute("data-faltam"));
      expect(passos, "Y = passos pendentes da lista").toBe(await lista.locator('li[data-ok="0"]').count());

      // E o total é o N do título.
      const titulo = (await p.locator("#lista-conferencia-titulo").innerText()).trim();
      const n = titulo.match(/Faltam? (\d+) (?:item|itens)/);
      expect(n, `o título diz quantos faltam (Falta 1 item / Faltam N itens): ${titulo}`).not.toBeNull();
      expect(Number(n![1]), "o N do título é a soma da conta").toBe(soma);

      // O aceite do termo da IA fica à parte, dito na mesma linha.
      await expect(conta).toContainText("Também falta o aceite do termo da IA, no fim desta coluna.");
      await p.context().close();
    });
  }
});
