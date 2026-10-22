import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { TAMANHOS, abrirComoConta, lerMassa, temContaVarredura, type ChaveConta, type Massa } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T279 — VARREDURA DA PÁGINA INTEIRA nas telas LOGADAS (ordem do Muse, 22/10, bloco 2). O mesmo protocolo da t274
  (seis classes, página toda rolada, 390 e 1280 px) com as contas da massa da varredura (scripts/lab/massa-varredura.mjs):
  proprietário com 17 fotos e com rascunho vazio, inquilina com contrato completo, parceiro e a conta com os três papéis;
  e o admin em MODO LEITURA (só abre e rola; nenhum clique). Só no laboratório: produção não tem as contas de teste.
*/
type Conta = ChaveConta | "ADMIN";
interface Tela {
  conta: Conta;
  papel: string;
  rota: (m: Massa) => string;
  nome: string;
}
const TELAS: Tela[] = [
  { conta: "DONO17", papel: "proprietário", rota: () => "/dashboard", nome: "Painel" },
  { conta: "DONO17", papel: "proprietário", rota: () => "/dashboard/imoveis", nome: "Meus imóveis" },
  { conta: "DONO17", papel: "proprietário", rota: (m) => `/dashboard/imoveis/${m.imovel17}/editar`, nome: "Editar anúncio ativo" },
  { conta: "DONO17", papel: "proprietário", rota: () => "/dashboard/fechamento", nome: "Fechamento" },
  { conta: "DONO17", papel: "proprietário", rota: () => "/dashboard/contratos", nome: "Contratos" },
  { conta: "DONO17", papel: "proprietário", rota: () => "/dashboard/solicitacoes", nome: "Solicitações" },
  { conta: "DONO17", papel: "proprietário", rota: () => "/dashboard/carteira", nome: "Carteira" },
  { conta: "DONO17", papel: "proprietário", rota: () => "/dashboard/ferramentas", nome: "Ferramentas" },
  { conta: "DONO0", papel: "proprietário", rota: (m) => `/dashboard/imoveis/novo?draft=${m.rascunho0}`, nome: "Cadastro com 0 fotos" },
  { conta: "INQUILINA", papel: "morador", rota: () => "/dashboard", nome: "Painel" },
  { conta: "INQUILINA", papel: "morador", rota: () => "/dashboard/locacoes", nome: "Minhas locações" },
  { conta: "INQUILINA", papel: "morador", rota: (m) => `/dashboard/locacoes/${m.contrato}`, nome: "Locação (contrato completo)" },
  { conta: "INQUILINA", papel: "morador", rota: (m) => `/dashboard/estadia/${m.contrato}`, nome: "Estadia" },
  { conta: "INQUILINA", papel: "morador", rota: () => "/dashboard/favoritos", nome: "Favoritos" },
  { conta: "INQUILINA", papel: "morador", rota: () => "/dashboard/buscas", nome: "Buscas salvas" },
  { conta: "INQUILINA", papel: "morador", rota: () => "/dashboard/conta", nome: "Conta" },
  { conta: "PARCEIRO", papel: "parceiro", rota: () => "/dashboard/parceiro", nome: "Painel do parceiro" },
  { conta: "TRES", papel: "três papéis", rota: () => "/dashboard", nome: "Painel" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin", nome: "Visão geral" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/usuarios", nome: "Usuários" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/imoveis", nome: "Imóveis" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/documentos", nome: "Documentos" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/parceiros", nome: "Parceiros" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/contratos", nome: "Contratos" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/atendimento", nome: "Atendimento" },
  { conta: "ADMIN", papel: "admin (leitura)", rota: () => "/admin/financeiro", nome: "Financeiro" },
];

const MASSA = lerMassa();
const SAIDA = "tests/laboratorio/saida/varredura-logada";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

test.describe("T279 — varredura da página inteira nas telas logadas (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (contas da massa da varredura)");
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
    expect(MASSA, "laboratório sem a massa da varredura (scripts/lab/massa-varredura.mjs)").not.toBeNull();
  });

  for (const t of TELAS) {
    test(`${t.papel} — ${t.nome}: as seis classes, rolando a página inteira`, async ({ browser }) => {
      test.setTimeout(180_000);
      test.skip(t.conta !== "ADMIN" && !temContaVarredura(t.conta), `sem a conta ${t.conta} na massa`);
      const rota = t.rota(MASSA!);
      const relatorio: Record<string, Record<string, string[]>> = {};
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
