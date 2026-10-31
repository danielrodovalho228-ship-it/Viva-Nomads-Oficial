import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo, tornarContratoVigente } from "../fixtures/laboratorio";

/*
  T755 — AGENDA-A (Muse, 31/10), Agenda do proprietário a 1280 e 390:
   1. O período da estadia é pintado em TODOS os dias (não só na entrada e na saída): hoje, amanhã e um dia do meio no
      mês seguinte têm a marca; o dia do meio diz "Estadia em andamento · <imóvel>".
   2. E44 na Agenda: com a Agenda aberta por "?imovel=<id>" (o "Ver na Agenda" do calendário do imóvel), o filtro já vem no
      imóvel e o "Exportar para outro site" (.ics) aparece com o link; em "Todos os imóveis", a dica de escolher um.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t755.${sufixo}@lab.vivanomads.test`, nome: "Ada Agenda", role: "owner" as const };
const mor = { email: `mor.t755.${sufixo}@lab.vivanomads.test`, nome: "Rui Estadia", role: "tenant" as const };
const ids: Record<string, string> = {};

const diaBR = (deslocamento: number) => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [a, m, d] = p.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + deslocamento)).toISOString().slice(0, 10);
};

test.describe("T755 — AGENDA-A: período pintado e iCal na Agenda", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.mor = await criarConta(mor, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.mor]);
    await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    ids.im = await criarImovelPronto(ids.dono, `Studio da agenda ${sufixo}`, { ativo: true });
    await criarLead(ids.dono, ids.mor, ids.im, true);
    const t = new Date().toISOString();
    const { data: c, error } = await adm().from("contratos").insert({ property_id: ids.im, tenant_id: ids.mor, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 768, qtd_ocupantes: 1, garantia: "caucao", status: "ativo", assinado_proprietario_em: t, assinado_inquilino_em: t }).select("id").single();
    if (error) throw error;
    ids.c = c!.id as string;
    // Bloco de hoje a hoje + 59 dias.
    await tornarContratoVigente(ids.c, ids.dono);
  });
  test.afterAll(async () => {
    if (ids.c) {
      await adm().from("pagamentos_bloco").delete().eq("contrato_id", ids.c);
      await adm().from("contrato_blocos").delete().eq("contrato_id", ids.c);
      await adm().from("contratos").delete().eq("id", ids.c);
    }
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.dono, ids.mor]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px: todos os dias do período marcados; iCal com o imóvel escolhido`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/agenda", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("agenda")).toBeVisible({ timeout: 30_000 });
      for (const d of [diaBR(0), diaBR(1)]) await expect(p.getByTestId(`agenda-dia-${d}`), d).toHaveAttribute("data-estadia", "1");
      await expect(p.getByTestId("agenda-exportar-escolha")).toBeVisible();
      await p.screenshot({ path: `${SAIDA}/t755-agenda-mes-${largura}.png`, fullPage: true });

      // Um dia do MEIO do período, no mês seguinte: marcado, sem entrada nem saída, e com a estadia por nome.
      const meio = diaBR(0).slice(0, 7) === diaBR(20).slice(0, 7) ? diaBR(35) : diaBR(20);
      if (meio.slice(0, 7) !== diaBR(0).slice(0, 7)) await p.getByTestId("agenda-proximo").click();
      const celula = p.getByTestId(`agenda-dia-${meio}`);
      await expect(celula).toHaveAttribute("data-estadia", "1");
      await celula.click();
      await expect(p.getByTestId("agenda-estadia-andamento")).toContainText(`Estadia em andamento · Studio da agenda ${sufixo}`);

      // E44 na Agenda: "?imovel=" (o "Ver na Agenda" da edição) já filtra e mostra o link .ics.
      await p.goto(`/dashboard/agenda?imovel=${ids.im}`, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("agenda-filtro-imovel")).toHaveValue(ids.im);
      await expect(p.getByTestId("exportar-calendario")).toBeVisible();
      await expect(p.getByTestId("exportar-calendario-link")).toHaveValue(/\/api\/calendario\/.+\.ics$/, { timeout: 20_000 });
      await p.getByTestId("exportar-calendario").scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t755-agenda-ical-${largura}.png` });
      await p.context().close();
    });
  }
});
