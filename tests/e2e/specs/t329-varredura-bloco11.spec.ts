// Rodada 19 da vigia (Pista C, 25/10, lote A): varredura completa na main com o PROP-1 (#1337), a 390 e 1280 px.
import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { TAMANHOS, abrirComoConta, lerMassa, temContaVarredura, type ChaveConta, type Massa } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T329 — VARREDURA DA PÁGINA INTEIRA, BLOCO 11 (Pista C, 23/10). O mesmo protocolo da t306 (seis classes, página toda
  rolada, 390 e 1280 px, carregamento real de cada imagem) nas telas que nenhuma varredura cobria (conferido contra o
  tests/e2e/cobertura.json e as listas da t279 e dos blocos 3 a 10): a tela do código da entrada, as conversas, os
  pedidos do morador, as sete seções da conta, as três telas da estadia (alteração, encerrar, ocupantes) e o contrato
  no admin. Ficam fora: /auth/intencao (com sessão e intenção já escolhida redireciona; fica com a t300 e a t317) e a
  visão do convidado (precisa de convite ativo; fica com a t327). Só no laboratório.
  Rodadas fora do lab completo (teto L-5): no lab-crítico do PR que toca a spec; 23/10 (#1165) e 23/10 à tarde (#1170 a #1173).
*/
type Conta = ChaveConta | "ADMIN" | "VISITANTE";
interface Tela {
  conta: Conta;
  papel: string;
  rota: (m: Massa) => string;
  nome: string;
}
const SECOES_CONTA = [
  ["perfil", "Perfil"],
  ["seguranca", "Segurança"],
  ["notificacoes", "Notificações"],
  ["ajuda", "Ajuda"],
  ["perfil-publico", "Perfil público"],
  ["pagamentos", "Pagamentos"],
  ["excluir", "Sair da Viva"],
] as const;
const TELAS: Tela[] = [
  // Públicas primeiro.
  { conta: "VISITANTE", papel: "visitante", rota: () => "/auth/verificar-codigo", nome: "Código da entrada" },
  // Logadas.
  { conta: "INQUILINA", papel: "inquilina", rota: () => "/dashboard/mensagens", nome: "Mensagens" },
  { conta: "DONO17", papel: "proprietário", rota: () => "/dashboard/mensagens", nome: "Mensagens" },
  { conta: "INQUILINA", papel: "inquilina", rota: () => "/dashboard/pedidos", nome: "Meus pedidos" },
  ...SECOES_CONTA.map(([secao, nome]) => ({ conta: "INQUILINA" as const, papel: "inquilina", rota: () => `/dashboard/conta/${secao}`, nome: `Conta · ${nome}` })),
  { conta: "INQUILINA", papel: "inquilina", rota: (m) => `/dashboard/estadia/${m.contrato}/alteracao`, nome: "Estadia · alteração" },
  { conta: "INQUILINA", papel: "inquilina", rota: (m) => `/dashboard/estadia/${m.contrato}/encerrar`, nome: "Estadia · encerrar" },
  { conta: "INQUILINA", papel: "inquilina", rota: (m) => `/dashboard/estadia/${m.contrato}/ocupantes`, nome: "Estadia · ocupantes" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: (m) => `/admin/contratos/${m.contrato}`, nome: "Contrato no admin" },
];

const MASSA = lerMassa();
const SAIDA = "tests/laboratorio/saida/varredura-bloco11";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

test.describe("T329 — varredura da página inteira, bloco 11 (telas sem varredura) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (contas da massa da varredura)");
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
    expect(MASSA, "laboratório sem a massa da varredura (scripts/lab/massa-varredura.mjs)").not.toBeNull();
  });

  for (const t of TELAS) {
    test(`${t.papel} — ${t.nome}: as seis classes, rolando a página inteira`, async ({ browser }) => {
      test.setTimeout(180_000);
      test.skip(t.conta !== "ADMIN" && t.conta !== "VISITANTE" && !temContaVarredura(t.conta), `sem a conta ${t.conta} na massa`);
      const rota = t.rota(MASSA!);
      const relatorio: Record<string, Record<string, string[]>> = {};
      for (const tam of TAMANHOS) {
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
          await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 40_000 });
          expect(new URL(page.url()).pathname, `${t.papel} — ${t.nome} @${tam.nome}: caiu fora da tela (login ou redirecionamento)`).toBe(rota.split("?")[0]);
          await page.locator("main").first().waitFor({ timeout: 20_000 }).catch(() => {});
          const achados = await varrerPagina(page, respostas);
          relatorio[tam.nome] = achados;
          for (const classe of Object.keys(CLASSES) as Classe[]) {
            await test.step(`${classe} @${tam.nome}`, async () => {
              for (const a of achados[classe]) console.log(`VARREDURA|${classe}|${tam.nome}|${t.papel}|${rota.replace(/[0-9a-f-]{36}/g, ":id")}|${a}`);
              expect.soft(achados[classe], `${t.papel} — ${t.nome} @${tam.nome} — ${classe}: ${CLASSES[classe]}`).toEqual([]);
            });
          }
        } finally {
          await page.context().close();
        }
      }
      mkdirSync(SAIDA, { recursive: true });
      writeFileSync(`${SAIDA}/${slug(`${t.papel}-${t.nome}`)}.json`, JSON.stringify({ papel: t.papel, tela: t.nome, achados: relatorio }, null, 2));
    });
  }
});
