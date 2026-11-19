import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { campoBrasiliaParaIso } from "../../../src/lib/visitas-video";

/*
  SONDA (nunca mergear; ORDEM-DUET-212 item 6): a mensagem de confirmação da visita presencial 06:30 → 09:00 traz
  ENDEREÇO, HORÁRIO e O QUE LEVAR? Dois caminhos, as mensagens impressas no log (SONDA-MSG):
   A. o morador pede 06:30; o dono propõe 09:00 (remarcar); o MORADOR aceita pela tela → confirmada às 09:00.
   B. o morador pede 09:00; o DONO confirma pela tela → confirmada às 09:00.
  Imprime tudo o que as duas partes receberam (emails_teste: evento, assunto, corpo) e o cartão do morador em Visitas.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t9998.${sufixo}@lab.vivanomads.test`, nome: "Dora Visita Sobrenome", role: "owner" as const };
const inqA = { email: `inqa.t9998.${sufixo}@lab.vivanomads.test`, nome: "Ana Remarca Sobrenome", role: "tenant" as const };
const inqB = { email: `inqb.t9998.${sufixo}@lab.vivanomads.test`, nome: "Bia Confirma Sobrenome", role: "tenant" as const };
const ids: Record<string, string | undefined> = {};
const RUA = "Rua Modesta Maria, 120, apto 302";
const amanha = (() => { const d = new Date(Date.now() + 2 * 86_400_000); return d.toISOString().slice(0, 10); })();
const as = (hhmm: string) => campoBrasiliaParaIso(`${amanha}T${hhmm}`)!;

async function imprimir(rotulo: string, usuario: string) {
  const { data } = await adm().from("emails_teste").select("evento, assunto, corpo").eq("usuario_id", usuario).order("criado_em", { ascending: true });
  for (const e of (data ?? []) as { evento: string; assunto: string | null; corpo: string }[])
    console.log(`SONDA-MSG ${rotulo} | evento=${e.evento} | assunto=${e.assunto ?? ""} | corpo=${String(e.corpo).replace(/\s+/g, " ").slice(0, 900)}`);
  if (!(data ?? []).length) console.log(`SONDA-MSG ${rotulo} | (nenhuma mensagem na caixa de teste)`);
}

test.describe("SONDA — confirmação da visita 06:30 → 09:00", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inqA = await criarConta(inqA, senha);
    ids.inqB = await criarConta(inqB, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inqA, ids.inqB]);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio visita ${sufixo}`, { ativo: true, preco: 3200 });
    await adm().from("properties").update({ exact_address: RUA }).eq("id", ids.imovel);
  });
  test.afterAll(async () => {
    if (ids.imovel) await adm().from("visitas_video").delete().eq("property_id", ids.imovel);
    await apagarContas([ids.inqA, ids.inqB, ids.dono]);
  });

  test("A. pedido 06:30 → dono propõe 09:00 → o morador aceita pela tela", async ({ browser }) => {
    const { data: v, error } = await adm().from("visitas_video").insert({ property_id: ids.imovel, owner_id: ids.dono, tenant_id: ids.inqA, modalidade: "presencial", horarios: [as("06:30")], status: "remarcar", horario_proposto: as("09:00") }).select("id").single();
    expect(error).toBeNull();
    const a = await entrar(browser, inqA.email, senha);
    await a.goto("/dashboard/visitas", { waitUntil: "domcontentloaded" });
    await a.locator(`#visita-${v!.id}`).getByTestId("visita-aceitar-remarcacao").click();
    await expect.poll(async () => (await adm().from("visitas_video").select("status, horario_confirmado").eq("id", v!.id).single()).data?.status, { timeout: 25_000 }).toBe("confirmado");
    await a.goto("/dashboard/visitas", { waitUntil: "domcontentloaded" });
    const cartao = a.locator(`#visita-${v!.id}`);
    await cartao.waitFor({ timeout: 20_000 });
    console.log(`SONDA-MSG A-cartao-morador | ${(await cartao.innerText()).replace(/\s+/g, " ").slice(0, 900)}`);
    await a.context().close();
    await new Promise((r) => setTimeout(r, 5_000));
    await imprimir("A-morador", ids.inqA!);
    await imprimir("A-dono", ids.dono!);
  });

  test("B. pedido 09:00 → o dono confirma pela tela", async ({ browser }) => {
    const { data: v, error } = await adm().from("visitas_video").insert({ property_id: ids.imovel, owner_id: ids.dono, tenant_id: ids.inqB, modalidade: "presencial", horarios: [as("09:00")], status: "pedido" }).select("id").single();
    expect(error).toBeNull();
    const d = await entrar(browser, dono.email, senha);
    await d.goto("/dashboard/visitas?de=dono", { waitUntil: "domcontentloaded" });
    await d.locator(`#visita-${v!.id}`).getByTestId("visita-confirmar").click();
    await expect.poll(async () => (await adm().from("visitas_video").select("status").eq("id", v!.id).single()).data?.status, { timeout: 25_000 }).toBe("confirmado");
    await d.context().close();
    const b = await entrar(browser, inqB.email, senha);
    await b.goto("/dashboard/visitas", { waitUntil: "domcontentloaded" });
    const cartao = b.locator(`#visita-${v!.id}`);
    await cartao.waitFor({ timeout: 20_000 });
    console.log(`SONDA-MSG B-cartao-morador | ${(await cartao.innerText()).replace(/\s+/g, " ").slice(0, 900)}`);
    await b.context().close();
    await new Promise((r) => setTimeout(r, 5_000));
    await imprimir("B-morador", ids.inqB!);
    await imprimir("B-dono", ids.dono!);
  });
});
