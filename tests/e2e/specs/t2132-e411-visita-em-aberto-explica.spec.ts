import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2132 — E411 @E411: com uma visita em aberto, o anúncio explica por que não dá para pedir outra igual e o caminho.
  Regra decidida (E411; unitário src/lib/visitas/um-pedido-aberto.test.ts): uma visita em aberto por modalidade
  (índice da 0165). O botão leva a Visitas e, logo abaixo, a explicação. A outra modalidade continua livre.
  O t774 já prova o caso "vídeo PEDIDA" (a explicação de pedida) e o botão "Ver minha visita". Esta spec prova o que ele
  não cobre:
    A. presencial AGENDADA (confirmada, horário futuro): "Visita agendada" → /dashboard/visitas, com a explicação
       "Sua visita presencial já está marcada. Para mudar o horário, cancele em Visitas e peça de novo."; a visita por
       vídeo segue oferecida (outra modalidade, livre);
    B. vídeo confirmada e JÁ PASSADA (resíduo do E411): sob "Ver minha visita", a explicação "Sua visita por vídeo já
       passou do horário. Um novo pedido fica liberado quando o proprietário marcar esta visita como feita; combine pela
       conversa."; a presencial segue oferecida.
  Os textos esperados estão escritos aqui, pela regra. 390 e 1280 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: string[] = [];
const EXPLICA_AGENDADA_PRESENCIAL = "Sua visita presencial já está marcada. Para mudar o horário, cancele em Visitas e peça de novo.";
const EXPLICA_VER_VIDEO = "Sua visita por vídeo já passou do horário. Um novo pedido fica liberado quando o proprietário marcar esta visita como feita; combine pela conversa.";

async function conta(papel: "owner" | "tenant", nome: string) {
  const email = `${papel}.t2132.${novoSufixo()}.${sufixo}@lab.vivanomads.test`;
  const id = await criarConta({ email, nome, role: papel }, senha);
  ids.push(id);
  await adm().from("profiles").update({ is_teste: true }).eq("id", id);
  return { id, email };
}

test.describe("T2132 — E411: visita em aberto explica a regra e o caminho; a outra modalidade segue livre @E411", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas de teste).");
  test.setTimeout(150_000);
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — A: presencial agendada explica e o vídeo segue livre; B: vídeo passada explica e a presencial segue livre`, async ({ browser }) => {
      const dono = await conta("owner", `Dora Visita${largura} Sobrenome`);
      const inq = await conta("tenant", `Ivo Visita${largura} Sobrenome`);
      const imovel = await criarImovelPronto(dono.id, `Studio Visita ${largura} ${sufixo}`, { ativo: true, preco: 3200 });
      const daqui3 = new Date(Date.now() + 3 * 86_400_000);
      daqui3.setUTCHours(17, 0, 0, 0);

      // A. presencial confirmada, no futuro
      const { data: vp, error: ep } = await adm()
        .from("visitas_video")
        .insert({ property_id: imovel, owner_id: dono.id, tenant_id: inq.id, horarios: [daqui3.toISOString()], modalidade: "presencial", status: "confirmado", horario_confirmado: daqui3.toISOString() })
        .select("id")
        .single();
      if (ep) throw ep;

      const page = await entrar(browser, inq.email, senha);
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto(`/imoveis/${imovel}`, { waitUntil: "domcontentloaded" });
      const agendada = page.getByTestId("visita-presencial-agendada").first();
      await expect(agendada).toBeAttached({ timeout: 25_000 });
      await expect(agendada).toHaveText(/Visita agendada/);
      await expect(agendada).toHaveAttribute("href", "/dashboard/visitas");
      await expect(page.getByTestId("visita-presencial-agendada-explica").first()).toHaveText(EXPLICA_AGENDADA_PRESENCIAL);
      await expect(page.getByTestId("agendar-visita"), "a presencial não oferece outro pedido").toHaveCount(0);
      await expect(page.getByTestId("visita-video-abrir").first(), "a visita por vídeo (outra modalidade) segue livre").toBeAttached();

      // B. a presencial sai; uma visita por vídeo confirmada que JÁ PASSOU
      await adm().from("visitas_video").delete().eq("id", vp!.id);
      const ontem = new Date(Date.now() - 86_400_000).toISOString();
      const { error: ev } = await adm()
        .from("visitas_video")
        .insert({ property_id: imovel, owner_id: dono.id, tenant_id: inq.id, horarios: [ontem], modalidade: "video", status: "confirmado", horario_confirmado: ontem, link_chamada: "https://meet.google.com/abc-defg-hij" });
      if (ev) throw ev;
      await page.reload({ waitUntil: "domcontentloaded" });
      const ver = page.getByTestId("visita-video-ver").first();
      await expect(ver).toBeAttached({ timeout: 25_000 });
      await expect(page.getByTestId("visita-video-ver-explica").first()).toHaveText(EXPLICA_VER_VIDEO);
      await expect(page.getByTestId("visita-video-abrir"), "o vídeo não oferece outro pedido").toHaveCount(0);
      await expect(page.getByTestId("agendar-visita").first(), "a presencial (outra modalidade) segue livre").toBeAttached();
      await page.context().close();
    });
  }
});
