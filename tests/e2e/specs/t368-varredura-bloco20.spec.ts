// Rodada 19 da vigia (Pista C, 25/10, lote B): varredura completa na main com o PROP-1 (#1337), a 390 e 1280 px.
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm } from "../fixtures/laboratorio";
import { TAMANHOS, abrirComoConta, cliqueResponde, lerMassa, temContaVarredura, type ChaveConta, type Massa } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T368 — VARREDURA DA PÁGINA INTEIRA, BLOCO 20 (Pista C, 24/10). O protocolo da t354 (seis classes, página toda rolada,
  carregamento real de cada imagem, 390 e 1280 px, HTTP abaixo de 400) mais a sétima classe pedida para este bloco:
  CLIQUE NO BOTÃO PRIMÁRIO (`data-cta="primary"` dentro do main) com resposta visível em até 3 s (cliqueResponde, a
  mesma régua do critério f da t249). Cobre as telas de detalhe que nunca tinham sido varridas: a página pública do
  parceiro, o pedido de serviço visto pelo cliente, pelo parceiro e pelo admin (um pedido novo por tela, apagado no
  fim) e o "Refazer duas etapas" do admin (sem o clique: o primário de lá manda código por e-mail). Nas públicas, o
  clique do primário nas telas de entrada que a t274 já varre sem clicar. Só no laboratório.
*/
type Conta = ChaveConta | "ADMIN" | "VISITANTE";
interface Tela {
  conta: Conta;
  papel: string;
  nome: string;
  /** Monta a rota; o que criar no banco registra a limpeza em `limpar`. */
  rota: (m: Massa, limpar: (() => Promise<unknown>)[]) => string | Promise<string>;
  /** false: não clica no primário (ação com efeito fora da tela). */
  clicar?: boolean;
}

/** Pedido de serviço novo do cliente INQUILINA para o parceiro da massa (status "solicitado"). */
async function pedidoNovo(m: Massa, limpar: (() => Promise<unknown>)[]): Promise<string> {
  const { data, error } = await adm()
    .from("parceiro_pedidos")
    .insert({
      codigo: `VN-SV-${randomBytes(4).toString("hex").toUpperCase()}`,
      parceiro_id: m.parceiro,
      cliente_id: m.ids.INQUILINA,
      categoria: "fotografia",
      descricao: "Fotos do apartamento (varredura do bloco 20).",
      status: "solicitado",
    })
    .select("id")
    .single();
  if (error) throw error;
  limpar.push(async () => adm().from("parceiro_pedidos").delete().eq("id", data.id));
  return data.id as string;
}

const PUBLICAS: [string, string][] = [
  ["/", "Início"],
  ["/buscar", "Buscar"],
  ["/para-proprietarios", "Para proprietários"],
  ["/como-funciona", "Como funciona"],
  ["/empresas", "Empresas"],
  ["/precos", "Preços"],
  ["/parceiros/buscar", "Parceiros — buscar"],
  ["/guias", "Guias"],
  ["/guia-fotos", "Guia de fotos"],
  ["/pedidos/novo", "Novo pedido (visitante)"],
];
const TELAS: Tela[] = [
  ...PUBLICAS.map(([rota, nome]): Tela => ({ conta: "VISITANTE", papel: "visitante", rota: () => rota, nome })),
  {
    conta: "VISITANTE",
    papel: "visitante",
    nome: "Página pública do parceiro",
    rota: async (m) => `/parceiros/${(await adm().from("parceiros").select("slug").eq("id", m.parceiro).single()).data!.slug as string}`,
  },
  { conta: "INQUILINA", papel: "inquilina", nome: "Pedido de serviço (cliente)", rota: async (m, l) => `/dashboard/servicos/pedidos/${await pedidoNovo(m, l)}` },
  { conta: "PARCEIRO", papel: "parceiro", nome: "Pedido de serviço (parceiro)", rota: async (m, l) => `/dashboard/servicos/pedidos/${await pedidoNovo(m, l)}` },
  { conta: "ADMIN", papel: "admin", nome: "Pedido de serviço (admin)", rota: async (m, l) => `/admin/parceiros/pedidos/${await pedidoNovo(m, l)}` },
  { conta: "ADMIN", papel: "admin", nome: "Refazer duas etapas", rota: () => "/admin/2fa/refazer", clicar: false },
];

/**
 * Achados do clique já registrados como defeito de produto (L-*): ficam anotados no relatório e não derrubam o teste;
 * qualquer outro achado derruba. Quando a pista dona corrigir, o achado some e a linha sai daqui.
 */
const CONHECIDOS: { rota: RegExp; achado: RegExp; l: string }[] = [
  { rota: /^\/buscar$/, achado: /"Aplicar nos filtros" desabilitado sem explicar o motivo/, l: "L-51" },
  { rota: /^\/dashboard\/servicos\/pedidos\/:id$/, achado: /"Enviar orçamento" desabilitado sem explicar o motivo/, l: "L-52" },
];
const conhecido = (rotulo: string, a: string) => CONHECIDOS.find((c) => c.rota.test(rotulo) && c.achado.test(a));

const MASSA = lerMassa();
const SAIDA = "tests/laboratorio/saida/varredura-bloco20";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
const CLIQUE = "clique no botão primário sem resposta visível em 3 s";

test.describe("T368 — varredura da página inteira, bloco 20 (detalhes e clique no primário) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (contas da massa da varredura)");
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
    expect(MASSA, "laboratório sem a massa da varredura (scripts/lab/massa-varredura.mjs)").not.toBeNull();
  });

  for (const t of TELAS) {
    test(`${t.papel} — ${t.nome}: as seis classes e o clique no primário, rolando a página inteira`, async ({ browser }) => {
      test.setTimeout(180_000);
      test.skip(t.conta !== "ADMIN" && t.conta !== "VISITANTE" && !temContaVarredura(t.conta), `sem a conta ${t.conta} na massa`);
      const limpar: (() => Promise<unknown>)[] = [];
      const relatorio: Record<string, Record<string, string[]>> = {};
      try {
        for (const tam of TAMANHOS) {
          // Rota por tamanho: o clique do primário pode mudar o pedido, então cada tamanho abre um pedido novo.
          const rota = await t.rota(MASSA!, limpar);
          let page: Page;
          if (t.conta === "VISITANTE") {
            const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: tam.width, height: tam.height } });
            page = await ctx.newPage();
          } else if (t.conta === "ADMIN") {
            const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: tam.width, height: tam.height } });
            page = await ctx.newPage();
          } else {
            page = (await abrirComoConta(browser, t.conta, tam.nome)).page;
          }
          try {
            const respostas = escutarImagens(page);
            const resposta = await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 40_000 });
            expect(resposta?.status() ?? 0, `${t.papel} — ${t.nome} @${tam.nome}: HTTP`).toBeLessThan(400);
            expect(new URL(page.url()).pathname, `${t.papel} — ${t.nome} @${tam.nome}: caiu fora da tela (login ou redirecionamento)`).toBe(rota.split(/[?#]/)[0]);
            await page.locator("main").first().waitFor({ timeout: 20_000 }).catch(() => {});
            const achados = await varrerPagina(page, respostas);
            const rotulo = rota.replace(/[0-9a-f-]{36}/g, ":id");
            for (const classe of Object.keys(CLASSES) as Classe[]) {
              await test.step(`${classe} @${tam.nome}`, async () => {
                for (const a of achados[classe]) console.log(`VARREDURA|${classe}|${tam.nome}|${t.papel}|${rotulo}|${a}`);
                expect.soft(achados[classe], `${t.papel} — ${t.nome} @${tam.nome} — ${classe}: ${CLASSES[classe]}`).toEqual([]);
              });
            }
            let clique: string[] = [];
            if (t.clicar !== false) {
              await test.step(`clique @${tam.nome}`, async () => {
                const primario = page.locator('main [data-cta="primary"]:visible').first();
                if ((await primario.count()) === 0) {
                  console.log(`VARREDURA|clique|${tam.nome}|${t.papel}|${rotulo}|sem primário visível no main (nada a clicar)`);
                  return;
                }
                await primario.scrollIntoViewIfNeeded().catch(() => {});
                const nome = ((await primario.innerText().catch(() => "")) || (await primario.getAttribute("aria-label")) || "primário").trim().slice(0, 60);
                const href = await primario.evaluate((el) => (el instanceof HTMLAnchorElement ? el.href : null)).catch(() => null);
                if (href) {
                  // Primário que é link: a resposta é a navegação. O cliqueResponde lia a página no meio do
                  // redirecionamento (/para-proprietarios → /dashboard/imoveis/novo → /auth) e travava até o teto de 180 s.
                  const antes = page.url();
                  await primario.click({ timeout: 5_000, noWaitAfter: true }).catch(() => {});
                  const navegou = await page
                    .waitForURL((u) => u.href !== antes, { timeout: 3_000, waitUntil: "commit" })
                    .then(() => true)
                    .catch(() => false);
                  clique = navegou ? [] : [`clique em "${nome}" (link) sem navegação em 3 s`];
                } else {
                  clique = await cliqueResponde(page, primario, nome);
                }
                for (const a of clique) console.log(`VARREDURA|clique|${tam.nome}|${t.papel}|${rotulo}|${a}`);
                for (const a of clique) {
                  const c = conhecido(rotulo, a);
                  if (c) test.info().annotations.push({ type: c.l, description: `${rotulo} @${tam.nome}: ${a}` });
                }
                const novos = clique.filter((a) => !conhecido(rotulo, a));
                expect.soft(novos, `${t.papel} — ${t.nome} @${tam.nome} — clique: ${CLIQUE}`).toEqual([]);
              });
            }
            relatorio[tam.nome] = { ...achados, clique };
          } finally {
            await page.context().close();
          }
        }
      } finally {
        for (const f of limpar) await f().catch(() => {});
      }
      mkdirSync(SAIDA, { recursive: true });
      writeFileSync(`${SAIDA}/${slug(`${t.papel}-${t.nome}`)}.json`, JSON.stringify({ papel: t.papel, tela: t.nome, achados: relatorio }, null, 2));
    });
  }
});
