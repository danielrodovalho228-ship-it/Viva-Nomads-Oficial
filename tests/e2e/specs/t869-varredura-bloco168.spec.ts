import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, criarLead } from "../fixtures/laboratorio";
import { TAMANHOS, abrirComoConta, escutarErros, lerMassa, temContaVarredura, type ChaveConta, type Massa } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T869 — VARREDURA DA PÁGINA INTEIRA, BLOCO 168 (Pista C, 01/11), 6ª volta do ciclo. O protocolo do bloco 21 (t385):
  seis classes (imagem pelo carregamento real, elemento fixo sobre conteúdo, cartão sem foto, estouro horizontal, texto
  cortado, grade), página toda rolada, 390 e 1280 px, HTTP abaixo de 400; e o console (erro de console ou de página,
  régua da t249) no relatório. As telas varridas há mais tempo depois do bloco 167 (registro de cobertura: última
  varredura no bloco 154, t849): as de DETALHE com id — a proposta (validade sempre à vista) e a visita, pelos dois lados
  (INQUILINA e DONO17 da massa). Semeia como a t599: uma proposta do DONO17 para a INQUILINA no imovel17 (com uma versão)
  e uma visita por vídeo confirmada (se já houver uma aberta no imóvel, usa ela e não a apaga). O que é semeado aqui é
  apagado no fim. Defeito novo entra como test.fail ligado a um item (L-84 / D-V11 são os próximos livres).
*/
type Conta = ChaveConta | "VISITANTE" | "SOCIO";
interface Tela {
  conta: Conta;
  papel: string;
  nome: string;
  rota: (m: Massa) => string;
}

const ids: { lead?: string; proposta?: string; visita?: string; visitaCriada?: boolean } = {};
const emDias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const TELAS: Tela[] = [
  { conta: "INQUILINA", papel: "morador", nome: "Proposta recebida", rota: () => `/dashboard/propostas/${ids.proposta}` },
  { conta: "DONO17", papel: "proprietário", nome: "Proposta enviada", rota: () => `/dashboard/propostas/${ids.proposta}` },
  { conta: "INQUILINA", papel: "morador", nome: "Visita marcada", rota: () => `/dashboard/visitas/${ids.visita}` },
  { conta: "DONO17", papel: "proprietário", nome: "Visita marcada", rota: () => `/dashboard/visitas/${ids.visita}` },
];

/** Achados já registrados como defeito de produto (L-*) ou que são o desenho pedido: ficam anotados e não derrubam o teste. */
const CONHECIDOS: { rota: RegExp; achado: RegExp; l: string; classe?: Classe }[] = [
  // Desenho do E248 (#1536): o "›" sólido da fileira que rola senta sobre o item da borda (t662).
  { rota: /^\/dashboard(\/|\?|$)/, classe: "fixo", achado: /coberto por button "Ver mais itens"$/, l: "E248-desenho" },
];
const conhecido = (rotulo: string, a: string, classe?: Classe) => CONHECIDOS.find((c) => c.classe === classe && c.rota.test(rotulo) && c.achado.test(a));

const CODIGO_SOCIOS = process.env.SOCIOS_ACCESS_CODE;
const MASSA = lerMassa();
const SAIDA = "tests/laboratorio/saida/varredura-bloco168";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

test.describe("T869 — varredura da página inteira, bloco 168 (6ª volta, proposta e visita, pelos dois lados) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (contas da massa da varredura)");
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
    expect(MASSA, "laboratório sem a massa da varredura (scripts/lab/massa-varredura.mjs)").not.toBeNull();
  });
  test.beforeAll(async () => {
    if (!MASSA) return;
    const dono = MASSA.ids.DONO17;
    const morador = MASSA.ids.INQUILINA;
    // A proposta nasce de uma candidatura (lead_id é obrigatório).
    ids.lead = await criarLead(dono, morador, MASSA.imovel17, true);
    const { data: numero } = await adm().rpc("next_document_number", { p_type: "orcamento", p_year: new Date().getFullYear() });
    const { data: pr, error: ep } = await adm()
      .from("propostas")
      .insert({ numero, lead_id: ids.lead, property_id: MASSA.imovel17, owner_id: dono, tenant_id: morador, status: "enviada", versao_atual: 1, validade_dias: 7, valida_ate: `${emDias(7)}T23:00:00Z` })
      .select("id")
      .single();
    if (ep) throw ep;
    ids.proposta = pr.id as string;
    const { error: ev } = await adm().from("proposta_versoes").insert({
      proposta_id: ids.proposta, versao: 1, autor: "owner", valor_base: 3200, valor_mensal: 3200, meses: 4, data_entrada: emDias(10),
      total_mensal: 3200, total_contrato: 12_800, mensagem: "Proposta da varredura do bloco 97.",
    });
    if (ev) throw ev;
    const horario = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const { data: vi } = await adm()
      .from("visitas_video")
      .insert({ property_id: MASSA.imovel17, owner_id: dono, tenant_id: morador, horarios: [horario], modalidade: "video", status: "confirmado", horario_confirmado: horario, link_chamada: "https://meet.google.com/abc-defg-hij" })
      .select("id")
      .maybeSingle();
    if (vi) {
      ids.visita = (vi as { id: string }).id;
      ids.visitaCriada = true;
    } else {
      // Visita única por imóvel e modalidade: usa a que outra spec deixou aberta.
      const { data: aberta } = await adm().from("visitas_video").select("id").eq("property_id", MASSA.imovel17).eq("tenant_id", morador).eq("modalidade", "video").in("status", ["pedido", "confirmado"]).limit(1).maybeSingle();
      ids.visita = (aberta as { id?: string } | null)?.id;
    }
  });
  test.afterAll(async () => {
    if (ids.proposta) {
      await adm().from("proposta_versoes").delete().eq("proposta_id", ids.proposta);
      await adm().from("propostas").delete().eq("id", ids.proposta);
    }
    if (ids.visita && ids.visitaCriada) await adm().from("visitas_video").delete().eq("id", ids.visita);
    if (ids.lead) await adm().from("leads").delete().eq("id", ids.lead);
  });

  for (const t of TELAS) {
    test(`${t.papel} — ${t.nome}: as seis classes, rolando a página inteira`, async ({ browser }) => {
      test.setTimeout(180_000);
      test.skip(t.conta !== "VISITANTE" && t.conta !== "SOCIO" && !temContaVarredura(t.conta), `sem a conta ${t.conta} na massa`);
      test.skip(t.conta === "SOCIO" && !CODIGO_SOCIOS, "SOCIOS_ACCESS_CODE não definido neste ambiente");
      const rota = t.rota(MASSA!);
      test.skip(rota.endsWith("/undefined"), "não deu para semear o registro desta tela");
      const rotulo = rota.replace(/[0-9a-f-]{36}/g, ":id");
      const relatorio: Record<string, Record<string, string[]>> = {};
      mkdirSync(SAIDA, { recursive: true });
      for (const tam of TAMANHOS) {
        let page: Page;
        if (t.conta === "VISITANTE" || t.conta === "SOCIO") {
          const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: tam.width, height: tam.height } });
          page = await ctx.newPage();
          if (t.conta === "SOCIO") {
            // A porta única dos sócios: o código grava o cookie vn_socios e devolve para a página pedida (como na t307).
            await page.goto(`/acesso-socios?next=${encodeURIComponent(rota)}`, { waitUntil: "domcontentloaded", timeout: 40_000 });
            await page.locator('input[name="codigo"]').fill(CODIGO_SOCIOS!);
            await page.getByRole("button", { name: "Entrar" }).click();
            await page.waitForURL((u) => u.pathname === rota, { timeout: 30_000 });
          }
        } else {
          page = (await abrirComoConta(browser, t.conta, tam.nome)).page;
        }
        try {
          const respostas = escutarImagens(page);
          // Console e erro de página (critério d da t249, com as exceções de terceiros de lá) também entram no relatório.
          const erros = escutarErros(page);
          const resposta = await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 40_000 });
          expect(resposta?.status() ?? 0, `${t.papel} — ${t.nome} @${tam.nome}: HTTP`).toBeLessThan(400);
          expect(new URL(page.url()).pathname, `${t.papel} — ${t.nome} @${tam.nome}: caiu fora da tela (login ou redirecionamento)`).toBe(rota.split(/[?#]/)[0]);
          await page.locator("main").first().waitFor({ timeout: 20_000 }).catch(() => {});
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
          const achados = await varrerPagina(page, respostas);
          for (const classe of Object.keys(CLASSES) as Classe[]) {
            await test.step(`${classe} @${tam.nome}`, async () => {
              for (const a of achados[classe]) console.log(`VARREDURA|${classe}|${tam.nome}|${t.papel}|${rotulo}|${a}`);
              for (const a of achados[classe]) {
                const c = conhecido(rotulo, a, classe);
                if (c) test.info().annotations.push({ type: c.l, description: `${rotulo} @${tam.nome} (${classe}): ${a}` });
              }
              const novos = achados[classe].filter((a) => !conhecido(rotulo, a, classe));
              expect.soft(novos, `${t.papel} — ${t.nome} @${tam.nome} — ${classe}: ${CLASSES[classe]}`).toEqual([]);
            });
          }
          const consoleErros = erros.lista();
          await test.step(`console @${tam.nome}`, async () => {
            for (const a of consoleErros) console.log(`VARREDURA|console|${tam.nome}|${t.papel}|${rotulo}|${a}`);
            expect.soft(consoleErros, `${t.papel} — ${t.nome} @${tam.nome} — console: erro de console ou de página`).toEqual([]);
          });
          await page.screenshot({ path: `${SAIDA}/${slug(`${t.papel}-${t.nome}`)}-${tam.width}.png`, fullPage: true }).catch(() => {});
          relatorio[tam.nome] = { ...achados, console: consoleErros };
        } finally {
          await page.context().close();
        }
      }
      writeFileSync(`${SAIDA}/${slug(`${t.papel}-${t.nome}`)}.json`, JSON.stringify({ papel: t.papel, tela: t.nome, achados: relatorio }, null, 2));
    });
  }
});
