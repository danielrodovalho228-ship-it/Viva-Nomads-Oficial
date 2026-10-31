import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T772 — E290 (#1685, Pista B): a visita por vídeo que acaba (cancelada ou feita) apaga o link da chamada. Antes o link
  ficava legível para as duas partes e o admin depois do fim; um link de sala fixa vazado seguia valendo. Pista C,
  bloco 102. Pelas telas de verdade (/dashboard/visitas), com contas de teste e uma visita confirmada por imóvel:
   A. o morador cancela a visita confirmada → status "cancelado" e link_chamada nulo no banco; o "Entrar na chamada"
      some dos dois lados (lista e detalhe), a 1280 e a 390 px;
   B. o proprietário, no detalhe da visita, marca a confirmada como feita → status "feito" e link_chamada nulo; sem o link nos dois
      lados.
  Antes de cada ação o link aparece (a confirmada com horário futuro mostra "Entrar na chamada").
*/
const senha = novaSenha();
const sufixo = novoSufixo();
/** Um link por visita: a lista mostra as duas, e a ainda confirmada continua com o dela. */
const LINKS = { A: `https://meet.google.com/lab-a772-${sufixo.slice(0, 3)}`, B: `https://meet.google.com/lab-b772-${sufixo.slice(0, 3)}` } as const;
const dono = { email: `dono.t772.${sufixo}@lab.vivanomads.test`, nome: "Dalia Visita", role: "owner" as const };
const morador = { email: `mor.t772.${sufixo}@lab.vivanomads.test`, nome: "Mauro Visita", role: "tenant" as const };
const ids: Record<string, string> = {};

async function abrir(browser: Browser, email: string, caminho: string, largura = 1280): Promise<Page> {
  const p = await entrar(browser, email, senha);
  await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  await p.goto(caminho, { waitUntil: "domcontentloaded" });
  return p;
}
const linha = async (id: string) => (await adm().from("visitas_video").select("status, link_chamada").eq("id", id).single()).data as { status: string; link_chamada: string | null };

async function visitaConfirmada(imovel: string, link: string): Promise<string> {
  const horario = new Date(Date.now() + 2 * 86_400_000).toISOString();
  const { data, error } = await adm()
    .from("visitas_video")
    .insert({ property_id: imovel, owner_id: ids.dono, tenant_id: ids.morador, horarios: [horario], modalidade: "video", status: "confirmado", horario_confirmado: horario, link_chamada: link })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Quantos "Entrar na chamada" com o link da visita aparecem nos dois lados (lista e detalhe), na largura dada. */
async function linkNosDoisLados(browser: Browser, id: string, link: string, largura: number): Promise<number[]> {
  const contagens: number[] = [];
  for (const email of [morador.email, dono.email]) {
    for (const caminho of ["/dashboard/visitas", `/dashboard/visitas/${id}`]) {
      const p = await abrir(browser, email, caminho, largura);
      await p.locator("main").first().waitFor({ timeout: 20_000 });
      await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      // No detalhe o cartão da visita aparece; na lista a visita encerrada pode ir para o histórico (fora da lista
      // principal): a conferência é o link em qualquer lugar da página.
      if (caminho.endsWith(id)) await expect(p.locator(`#visita-${id}`)).toBeVisible({ timeout: 20_000 });
      contagens.push(await p.locator(`a[href="${link}"]`).count());
      await p.context().close();
    }
  }
  return contagens;
}

test.describe("T772 — E290: a visita que acaba apaga o link da chamada", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    for (const id of [ids.dono, ids.morador]) await adm().from("profiles").update({ intencao: ["morar"] }).eq("id", id);
    // Um imóvel por visita: o pedido por vídeo é um aberto por morador, imóvel e tipo.
    ids.imovelA = await criarImovelPronto(ids.dono, `Studio visita A T772 ${sufixo}`, { ativo: true });
    ids.imovelB = await criarImovelPronto(ids.dono, `Studio visita B T772 ${sufixo}`, { ativo: true });
    ids.visitaA = await visitaConfirmada(ids.imovelA, LINKS.A);
    ids.visitaB = await visitaConfirmada(ids.imovelB, LINKS.B);
  });
  test.afterAll(async () => {
    await adm().from("visitas_video").delete().in("id", [ids.visitaA, ids.visitaB].filter(Boolean));
    await apagarContas([ids.dono, ids.morador]);
  });

  test("A. o morador cancela a confirmada: link nulo no banco e fora da tela dos dois lados (1280 e 390)", async ({ browser }) => {
    const p = await abrir(browser, morador.email, "/dashboard/visitas");
    const cartao = p.locator(`#visita-${ids.visitaA}`);
    await expect(cartao.getByTestId("visita-link-chamada")).toHaveAttribute("href", LINKS.A, { timeout: 20_000 });
    await cartao.getByTestId("visita-cancelar-morador").click();
    await cartao.getByTestId("visita-cancelar-confirmar").click();
    await expect.poll(() => linha(ids.visitaA), { timeout: 25_000 }).toEqual({ status: "cancelado", link_chamada: null });
    await p.context().close();
    for (const largura of [1280, 390]) expect(await linkNosDoisLados(browser, ids.visitaA, LINKS.A, largura), `sem o link a ${largura} px`).toEqual([0, 0, 0, 0]);
  });

  test("B. o proprietário marca como feita: link nulo no banco e fora da tela dos dois lados", async ({ browser }) => {
    // O proprietário abre a visita pelo detalhe (como na t593: Agenda, lista e e-mail levam a /dashboard/visitas/<id>).
    const p = await abrir(browser, dono.email, `/dashboard/visitas/${ids.visitaB}`);
    const cartao = p.locator(`#visita-${ids.visitaB}`);
    await expect(cartao.getByTestId("visita-link-chamada")).toHaveAttribute("href", LINKS.B, { timeout: 20_000 });
    await cartao.getByTestId("visita-concluir").click();
    await expect.poll(() => linha(ids.visitaB), { timeout: 25_000 }).toEqual({ status: "feito", link_chamada: null });
    await p.context().close();
    expect(await linkNosDoisLados(browser, ids.visitaB, LINKS.B, 1280)).toEqual([0, 0, 0, 0]);
  });
});
