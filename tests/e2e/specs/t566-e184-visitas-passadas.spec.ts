import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T566 — E184: visita confirmada cujo horário já passou não segue "Confirmada" nem oferece "Cancelar" (morador e dono);
  a presencial confirmada mostra o endereço — sem a linha exata gravada, vale a rua/número do cadastro; sem nenhum dos
  dois, o texto diz que o proprietário ainda não informou (nada de "aparece quando for confirmada"). Visita por vídeo
  que já passou não mostra mais "Entrar na chamada"; a futura mostra.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t566.${sufixo}@lab.vivanomads.test`, nome: "Dora Visitas", role: "owner" as const };
const mor = { email: `mor.t566.${sufixo}@lab.vivanomads.test`, nome: "Mia Visitas", role: "tenant" as const };
const ids: Record<string, string> = {};
const H = 3600_000;

async function visita(imovel: string, horario: Date) {
  const { error } = await adm()
    .from("visitas_video")
    .insert({ property_id: imovel, owner_id: ids.dono, tenant_id: ids.mor, horarios: [horario.toISOString()], modalidade: "presencial", status: "confirmado", horario_confirmado: horario.toISOString() });
  if (error) throw error;
}

test.describe("T566 — E184: visitas passadas e endereço da presencial", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.mor = await criarConta(mor, senha);
    ids.passada = await criarImovelPronto(ids.dono, `Visita passada t566 ${sufixo}`, { ativo: true });
    ids.rascunho = await criarImovelPronto(ids.dono, `Visita rascunho t566 ${sufixo}`, { ativo: true });
    ids.semEndereco = await criarImovelPronto(ids.dono, `Visita sem endereço t566 ${sufixo}`, { ativo: true });
    await adm().from("properties").update({ exact_address: null, draft_data: { street: "Rua do Rascunho", numero: "77" } }).eq("id", ids.rascunho);
    await adm().from("properties").update({ exact_address: null, draft_data: {} }).eq("id", ids.semEndereco);
    await visita(ids.passada, new Date(Date.now() - 4 * 24 * H));
    await visita(ids.rascunho, new Date(Date.now() + 2 * 24 * H));
    await visita(ids.semEndereco, new Date(Date.now() + 3 * 24 * H));
    ids.videoPassada = await criarImovelPronto(ids.dono, `Vídeo passada t566 ${sufixo}`, { ativo: true });
    ids.videoFutura = await criarImovelPronto(ids.dono, `Vídeo futura t566 ${sufixo}`, { ativo: true });
    for (const [imovel, h] of [[ids.videoPassada, new Date(Date.now() - 2 * 24 * H)], [ids.videoFutura, new Date(Date.now() + 2 * 24 * H)]] as const) {
      const { error } = await adm()
        .from("visitas_video")
        .insert({ property_id: imovel, owner_id: ids.dono, tenant_id: ids.mor, horarios: [h.toISOString()], modalidade: "video", status: "confirmado", horario_confirmado: h.toISOString(), link_chamada: "https://meet.google.com/abc-defg-hij" });
      if (error) throw error;
    }
  });

  test.afterAll(async () => {
    await adm().from("visitas_video").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.mor, ids.dono]);
  });

  const cartao = (p: import("@playwright/test").Page, titulo: string) => p.getByTestId("cartao-visita").filter({ hasText: titulo });

  test("390 px — morador: a passada diz 'Horário passou' sem cancelar; endereço do cadastro; sem endereço, o aviso certo", async ({ browser }) => {
    const p = await entrar(browser, mor.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto("/dashboard/visitas", { waitUntil: "domcontentloaded" });
    const passada = cartao(p, "Visita passada t566");
    await expect(passada.getByTestId("visita-status")).toHaveText("Horário passou", { timeout: 30_000 });
    await expect(passada.getByTestId("visita-cancelar-morador")).toHaveCount(0);
    await expect(passada.getByTestId("visita-endereco")).toHaveCount(0);
    await expect(cartao(p, "Visita rascunho t566").getByTestId("visita-endereco")).toContainText("Rua do Rascunho, 77");
    const sem = cartao(p, "Visita sem endereço t566");
    await expect(sem.getByTestId("visita-status")).toHaveText("Confirmada");
    await expect(sem.getByTestId("visita-endereco-pendente")).toHaveText("O proprietário ainda não informou o endereço exato. Peça pelas mensagens antes de sair.");
    await expect(sem.getByTestId("visita-endereco-oculto")).toHaveCount(0);
    await p.screenshot({ path: `${SAIDA}/t566-morador-390.png`, fullPage: true });
    await p.context().close();
  });

  test("1280 px — dono: a passada sem 'Cancelar' (só 'Marcar como feita'); a futura ainda cancela", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto("/dashboard/visitas?de=dono", { waitUntil: "domcontentloaded" });
    const passada = cartao(p, "Visita passada t566");
    await expect(passada.getByTestId("visita-status")).toHaveText("Horário passou", { timeout: 30_000 });
    await expect(passada.getByTestId("visita-cancelar")).toHaveCount(0);
    await expect(passada.getByTestId("visita-concluir")).toBeVisible();
    await expect(cartao(p, "Visita rascunho t566").getByTestId("visita-cancelar")).toBeVisible();
    await p.screenshot({ path: `${SAIDA}/t566-dono-1280.png`, fullPage: true });
    await p.context().close();
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — morador: vídeo já passada sem "Entrar na chamada"; a futura ainda mostra`, async ({ browser }) => {
      const p = await entrar(browser, mor.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/visitas", { waitUntil: "domcontentloaded" });
      const passada = cartao(p, "Vídeo passada t566");
      await expect(passada.getByTestId("visita-status")).toHaveText("Horário passou", { timeout: 30_000 });
      await expect(passada.getByTestId("visita-link-chamada")).toHaveCount(0);
      await expect(cartao(p, "Vídeo futura t566").getByTestId("visita-link-chamada")).toHaveText("Entrar na chamada");
      await passada.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t566-video-${largura}.png`, fullPage: true });
      await p.context().close();
    });
  }
});
