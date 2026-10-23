import path from "node:path";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, lerSaida, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T346 — Prompt 53: importar o calendário do Airbnb/Booking (só datas).
 *   1. o dono cola o link .ics → as datas ocupadas viram bloqueios "Importado"; o link nunca aparece inteiro (só o domínio);
 *   2. o evento sai do outro site → "Atualizar agora" libera a data aqui; o bloqueio MANUAL do dono fica;
 *   3. a busca com entrada nas datas importadas não mostra o imóvel (e mostra fora delas, inclusive com datas flexíveis);
 *   4. data importada cruza uma candidatura da Viva → e-mail ao dono (decisão), nada cancelado;
 *   5. o link deixa de responder 3 vezes seguidas → a causa na tela e 1 e-mail ao dono.
 * O "Airbnb falso" é a rota do laboratório /api/lab/ical, que serve o arquivo escrito aqui (nada vai à rede).
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t346.${sufixo}@lab.vivanomads.test`, nome: "Dalva Calendário", role: "owner" as const };
const morador = { email: `mor.t346.${sufixo}@lab.vivanomads.test`, nome: "Miro Calendário", role: "tenant" as const };
const titulo = `Studio calendário ${sufixo}`;
const arquivo = `t346-${sufixo}.ics`;
const link = `https://ical.lab.vivanomads.test/calendar/ical/${arquivo}?s=segredo${sufixo}`;
const ids: { dono?: string; morador?: string; imovel?: string } = {};

const dia = (n: number) => new Date(Date.now() - 3 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);
const compacta = (d: string) => d.replaceAll("-", "");
// Reserva A: dias 40–44 (DTEND exclusivo = 45); reserva B: dias 70–72.
const A = { inicio: dia(40), fim: dia(44) };
const B = { inicio: dia(70), fim: dia(72) };
const pastaIcal = () => path.join(path.dirname(process.env.LAB_OUTBOX ?? "tests/laboratorio/saida/x"), "ical");

async function escreverIcs(eventos: { inicio: string; fim: string }[]) {
  const linhas = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Airbnb Inc//Hosting Calendar 1.0//EN"];
  for (const e of eventos) {
    const saida = new Date(`${e.fim}T00:00:00Z`);
    saida.setUTCDate(saida.getUTCDate() + 1);
    linhas.push("BEGIN:VEVENT", `DTSTART;VALUE=DATE:${compacta(e.inicio)}`, `DTEND;VALUE=DATE:${compacta(saida.toISOString().slice(0, 10))}`, "SUMMARY:Reserved", "DESCRIPTION:Phone Number (Last 4 Digits): 4321", "END:VEVENT");
  }
  linhas.push("END:VCALENDAR");
  await mkdir(pastaIcal(), { recursive: true });
  await writeFile(path.join(pastaIcal(), arquivo), linhas.join("\r\n") + "\r\n", "utf8");
}
async function bloqueios(): Promise<{ inicio: string; fim: string; origem: string }[]> {
  const { data } = await adm().from("property_blocks").select("inicio, fim, origem").eq("property_id", ids.imovel!).order("inicio");
  return (data ?? []) as { inicio: string; fim: string; origem: string }[];
}
async function abrirCalendario(page: Page) {
  await page.goto(`/dashboard/imoveis/${ids.imovel}/editar#calendario`, { waitUntil: "domcontentloaded" });
  const painel = page.getByTestId("importar-calendario");
  await painel.scrollIntoViewIfNeeded({ timeout: 30_000 });
  await expect(painel).toBeVisible();
  return painel;
}
async function emailsDoDono(assunto: RegExp) {
  return (await lerSaida()).filter((l) => l.servico === "email" && l.para === dono.email && assunto.test(String(l.assunto ?? "")));
}
async function naBusca(page: Page, entrada: string, flex = false): Promise<boolean> {
  await page.goto(`/buscar?entrada=${entrada}${flex ? "&flex=1" : ""}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("busca-lista")).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(500);
  return (await page.locator(`[data-testid="card-resultado"][data-id="${ids.imovel}"]`).count()) > 0;
}

test.describe("T346 — Prompt 53: importar calendário do Airbnb/Booking", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.imovel = await criarImovelPronto(ids.dono, titulo, { ativo: true, preco: 2800 });
    await adm().from("properties").update({ available_from: dia(0) }).eq("id", ids.imovel);
    // Bloqueio MANUAL do dono (dias 110–112): a importação nunca mexe nele. Fica depois do dia 99 para não cruzar a
    // estadia mínima de 30 dias que o caso 3 busca a partir do dia 70 (passaBloqueios: entrada + 29 dias).
    await adm().from("property_blocks").insert({ property_id: ids.imovel, inicio: dia(110), fim: dia(112) });
    await escreverIcs([A, B]);
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await rm(path.join(pastaIcal(), arquivo), { force: true });
    await apagarContas([ids.dono, ids.morador]);
  });

  test("1–2. importa as datas, mostra só o domínio; removida lá, a data é liberada aqui e o manual fica", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 390, height: 844 });
    const painel = await abrirCalendario(page);
    await painel.getByTestId("importacao-link").fill(link);
    await painel.getByTestId("importacao-adicionar").click();
    await expect(painel.getByTestId("importacao-msg")).toContainText("Calendário importado: 2 períodos ocupados", { timeout: 30_000 });
    await expect(painel.getByTestId("importacao-item")).toContainText("ical.lab.vivanomads.test");
    await expect(painel).not.toContainText(`segredo${sufixo}`);
    await expect.poll(bloqueios).toEqual([
      { ...A, origem: "importado" },
      { ...B, origem: "importado" },
      { inicio: dia(110), fim: dia(112), origem: "manual" },
    ]);
    await expect(page.locator(`[data-testid="bloqueio-item"][data-origem="importado"]`)).toHaveCount(2);
    await expect(page.locator(`[data-testid="bloqueio-item"][data-origem="importado"]`).first().getByRole("button", { name: "Remover" })).toHaveCount(0);
    await painel.screenshot({ path: "tests/laboratorio/saida/t346-importar-390.png" });

    // A reserva B some do outro site → "Atualizar agora" libera as datas dela; o manual fica.
    await escreverIcs([A]);
    await painel.getByTestId("importacao-atualizar").click();
    await expect(painel.getByTestId("importacao-msg")).toContainText("1 liberado");
    await expect.poll(bloqueios).toEqual([
      { ...A, origem: "importado" },
      { inicio: dia(110), fim: dia(112), origem: "manual" },
    ]);
    await page.setViewportSize({ width: 1280, height: 900 });
    await painel.screenshot({ path: "tests/laboratorio/saida/t346-importar-1280.png" });
    await page.context().close();
  });

  test("3. a busca não mostra o imóvel nas datas importadas (com e sem datas flexíveis)", async ({ page }) => {
    expect(await naBusca(page, dia(30)), "estadia de 30 dias a partir do dia 30 cruza a reserva A").toBe(false);
    expect(await naBusca(page, dia(45)), "a partir do dia 45 está livre").toBe(true);
    expect(await naBusca(page, dia(35), true), "flexível: entrar no dia 45 cabe (até 15 dias depois)").toBe(true);
    expect(await naBusca(page, dia(70)), "a reserva B foi liberada").toBe(true);
  });

  test("4. data importada cruza uma candidatura da Viva → aviso ao dono, nada cancelado", async ({ browser }) => {
    const lead = await criarLead(ids.dono!, ids.morador!, ids.imovel!, false);
    await adm().from("leads").update({ inicio_desejado: dia(38) }).eq("id", lead);
    const page = await entrar(browser, dono.email, senha);
    const painel = await abrirCalendario(page);
    await painel.getByTestId("importacao-atualizar").click();
    await expect(painel.getByTestId("importacao-msg")).toContainText("Atualizado");
    await expect.poll(async () => (await emailsDoDono(/cruzam um compromisso/)).length, { timeout: 20_000 }).toBe(1);
    const { data: l } = await adm().from("leads").select("status").eq("id", lead).single();
    expect(l?.status, "a candidatura continua como estava").toBe("new");
    // Atualizar de novo não repete o aviso do mesmo conflito.
    await painel.getByTestId("importacao-atualizar").click();
    await expect(painel.getByTestId("importacao-msg")).toContainText("Atualizado");
    expect((await emailsDoDono(/cruzam um compromisso/)).length).toBe(1);
    await page.context().close();
  });

  test("5. o link deixa de responder 3 vezes seguidas → causa na tela e 1 aviso ao dono", async ({ browser }) => {
    await rm(path.join(pastaIcal(), arquivo), { force: true });
    const page = await entrar(browser, dono.email, senha);
    const painel = await abrirCalendario(page);
    for (let i = 0; i < 3; i++) {
      await painel.getByTestId("importacao-atualizar").click();
      await expect(painel.getByTestId("importacao-msg")).toContainText("deixou de responder");
    }
    await expect(painel.getByTestId("importacao-erro")).toContainText("O link deixou de responder: gere um novo");
    await expect.poll(async () => (await emailsDoDono(/Não conseguimos ler o calendário/)).length, { timeout: 20_000 }).toBe(1);
    // Falha não apaga o que já foi importado (as datas continuam bloqueadas até ler de novo).
    expect((await bloqueios()).filter((b) => b.origem === "importado")).toHaveLength(1);
    await page.context().close();
  });
});
