import { test, expect } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1160 — E482 (#2645, 05/11): o aviso de mensagem nova diz QUEM escreveu e traz a prévia. Antes o sino dizia só "Você
 * tem uma nova mensagem". Agora o título é "Nova mensagem de <primeiro nome> · <imóvel>" e a prévia (até 140 caracteres)
 * vai em avisos.texto (0298), numa linha própria — o título segue sem texto do usuário. O E482 entrou só com teste de
 * unidade; aqui é o caminho real: a moradora escreve pela tela de Mensagens e o dono vê o aviso.
 *   1. o aviso do dono tem o título com o primeiro nome da moradora e o imóvel, e a prévia no texto (não no título);
 *   2. a lista de avisos de Notificações mostra a prévia (aviso-texto) no item, a 390 e a 1280, sem estouro.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1160.${sufixo}@lab.vivanomads.test`, nome: "Otávio Aviso", role: "owner" as const };
const morador = { email: `inq.t1160.${sufixo}@lab.vivanomads.test`, nome: "Lia Remetente", role: "tenant" as const };
const TITULO_IMOVEL = `Studio do aviso ${sufixo}`;
const MENSAGEM = `Oi! Posso visitar no sábado de manhã? Ref ${sufixo}`;
const ids: { dono?: string; morador?: string; imovel?: string } = {};

type Aviso = { titulo: string; texto: string | null };

test.describe("T1160 — E482: o aviso de mensagem nova nomeia quem escreveu e traz a prévia", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.imovel = await criarImovelPronto(ids.dono, TITULO_IMOVEL, { ativo: true });
    await criarLead(ids.dono, ids.morador, ids.imovel, true);
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    if (ids.dono) await adm().from("avisos").delete().eq("usuario_id", ids.dono);
    if (ids.imovel) await adm().from("messages").delete().eq("property_id", ids.imovel);
    if (ids.dono) await adm().from("leads").delete().eq("owner_id", ids.dono);
    await apagarContas([ids.morador, ids.dono]);
  });

  test("1. a moradora escreve pela tela; o aviso do dono tem remetente, imóvel e a prévia no texto", async ({ browser }) => {
    const p = await entrar(browser, morador.email, senha);
    try {
      await p.goto(`/dashboard/mensagens?conversa=${conversationId(ids.dono!, ids.morador!, ids.imovel!)}`, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("mensagem-campo")).toBeVisible({ timeout: 30_000 });
      await p.getByTestId("mensagem-campo").fill(MENSAGEM);
      await p.getByRole("button", { name: "Enviar" }).click();
      await expect(p.getByText(MENSAGEM).first()).toBeVisible({ timeout: 20_000 });
    } finally {
      await p.context().close();
    }

    let aviso: Aviso | undefined;
    await expect(async () => {
      const { data } = await adm().from("avisos").select("titulo, texto").eq("usuario_id", ids.dono!).ilike("titulo", "Nova mensagem de%").order("criado_em", { ascending: false }).limit(1);
      aviso = (data as Aviso[] | null)?.[0];
      expect(aviso, "aviso de mensagem nova do dono").toBeTruthy();
    }).toPass({ timeout: 30_000 });
    expect(aviso!.titulo).toContain("Nova mensagem de Lia");
    expect(aviso!.titulo).toContain(TITULO_IMOVEL);
    expect(aviso!.titulo, "o título não leva texto da pessoa").not.toContain("sábado");
    expect(aviso!.texto ?? "").toContain("Posso visitar no sábado de manhã?");
    expect((aviso!.texto ?? "").length).toBeLessThanOrEqual(140);
  });

  for (const w of [390, 1280] as const) {
    test(`2. a lista de avisos mostra a prévia no item (${w})`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      try {
        await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
        await p.goto("/dashboard/notificacoes", { waitUntil: "domcontentloaded" });
        const item = p.getByTestId("avisos-item").filter({ hasText: "Nova mensagem de Lia" }).first();
        await expect(item).toBeVisible({ timeout: 30_000 });
        await expect(item.getByTestId("aviso-texto")).toContainText("Posso visitar no sábado de manhã?");
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      } finally {
        await p.context().close();
      }
    });
  }
});
