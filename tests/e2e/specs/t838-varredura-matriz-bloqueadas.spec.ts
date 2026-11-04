import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { TAMANHOS, abrirComoConta, lerMassa, temContaVarredura, type ChaveConta } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T838 — Matriz de conformidade (Pista A, 04/11): as 16 linhas "A conferir" que o modo demonstração não alcança
  (admin, parceiro aprovado e sessão real). Com as contas do laboratório, cada tela passa pelo protocolo da varredura
  (as seis classes do t306/t352: imagem vazia ou quebrada, elemento fixo por cima, estouro horizontal, texto cortado,
  grade desalinhada e carregamento de cada imagem; página toda rolada, 390 e 1280) e por duas regras da matriz:
  - vocabulário da casa: nada de hóspede, reserva, temporada, check-in, comissão ou anfitrião no texto da tela;
  - um botão cheio por tela, no máximo (o primário da casa, data-cta).
  Linha da matriz → rota real: anúncios → /admin/imoveis; manutenção → /admin/solicitacoes; moderar →
  /admin/moderacao/ofensas; publicamos → /admin/ajuda-publicacao; visão geral → /admin.
*/
type Conta = ChaveConta | "ADMIN";
const TELAS: { linha: string; conta: Conta; rota: string }[] = [
  { linha: "admin-agentes", conta: "ADMIN", rota: "/admin/agentes" },
  { linha: "admin-anuncios", conta: "ADMIN", rota: "/admin/imoveis" },
  { linha: "admin-atendimento", conta: "ADMIN", rota: "/admin/atendimento" },
  { linha: "admin-avaliadores", conta: "ADMIN", rota: "/admin/avaliadores" },
  { linha: "admin-destinos", conta: "ADMIN", rota: "/admin/destinos" },
  { linha: "admin-documentos", conta: "ADMIN", rota: "/admin/documentos" },
  { linha: "admin-manutencao", conta: "ADMIN", rota: "/admin/solicitacoes" },
  { linha: "admin-moderar", conta: "ADMIN", rota: "/admin/moderacao/ofensas" },
  { linha: "admin-pendencias", conta: "ADMIN", rota: "/admin/pendencias" },
  { linha: "admin-publicamos", conta: "ADMIN", rota: "/admin/ajuda-publicacao" },
  { linha: "admin-servicos", conta: "ADMIN", rota: "/admin/servicos" },
  { linha: "admin-usuarios", conta: "ADMIN", rota: "/admin/usuarios" },
  { linha: "admin-visao-geral", conta: "ADMIN", rota: "/admin" },
  { linha: "parceiro-ordens", conta: "PARCEIRO", rota: "/dashboard/parceiro" },
  { linha: "perfil-01-topo-espelho", conta: "DONO17", rota: "/dashboard/conta/perfil" },
  { linha: "perfil-02-avaliacoes", conta: "DONO17", rota: "/dashboard/conta/avaliacoes" },
];
const FORA_DO_VOCABULARIO = /\b(h[óo]spedes?|reservas?|temporada|check-?in|comiss[ãa]o|anfitri[ãa]o)\b/i;
const SAIDA = "tests/laboratorio/saida/varredura-matriz";
const MASSA = lerMassa();

test.describe("T838 — matriz: telas que só abrem com sessão (admin, parceiro, conta real), 390 e 1280", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (contas de teste)");
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
  });

  for (const t of TELAS) {
    test(`${t.linha} (${t.rota})`, async ({ browser }) => {
      test.setTimeout(180_000);
      test.skip(t.conta !== "ADMIN" && (!MASSA || !temContaVarredura(t.conta)), `sem a conta ${t.conta} na massa`);
      const relatorio: Record<string, unknown> = {};
      for (const tam of TAMANHOS) {
        let page: Page;
        if (t.conta === "ADMIN") {
          const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: tam.width, height: tam.height } });
          page = await ctx.newPage();
        } else {
          page = (await abrirComoConta(browser, t.conta, tam.nome)).page;
        }
        try {
          const respostas = escutarImagens(page);
          const r = await page.goto(t.rota, { waitUntil: "domcontentloaded", timeout: 40_000 });
          expect(r?.status() ?? 0, `${t.linha} @${tam.nome}: HTTP`).toBeLessThan(400);
          expect(new URL(page.url()).pathname, `${t.linha} @${tam.nome}: caiu fora da tela`).toBe(t.rota);
          await page.locator("main").first().waitFor({ timeout: 20_000 }).catch(() => {});
          const achados = await varrerPagina(page, respostas);
          for (const classe of Object.keys(CLASSES) as Classe[]) {
            for (const a of achados[classe]) console.log(`MATRIZ|${classe}|${tam.nome}|${t.linha}|${a}`);
            expect.soft(achados[classe], `${t.linha} @${tam.nome} — ${classe}: ${CLASSES[classe]}`).toEqual([]);
          }
          const texto = (await page.locator("main").first().innerText().catch(() => "")) ?? "";
          const palavra = texto.match(FORA_DO_VOCABULARIO)?.[0] ?? null;
          expect.soft(palavra, `${t.linha} @${tam.nome}: vocabulário fora da casa`).toBeNull();
          const cheios = await page.locator('main [data-cta="primary"]').filter({ visible: true }).count();
          expect.soft(cheios, `${t.linha} @${tam.nome}: botões cheios na tela`).toBeLessThanOrEqual(1);
          relatorio[tam.nome] = { achados, vocabulario: palavra, botoesCheios: cheios };
          mkdirSync(SAIDA, { recursive: true });
          await page.screenshot({ path: `${SAIDA}/${t.linha}-${tam.nome}.png`, fullPage: true });
        } finally {
          await page.context().close();
        }
      }
      writeFileSync(`${SAIDA}/${t.linha}.json`, JSON.stringify({ linha: t.linha, rota: t.rota, relatorio }, null, 2));
    });
  }
});
