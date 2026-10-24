import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { test, expect, type Browser, type BrowserContext } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, entrar } from "../fixtures/laboratorio";
import { TAMANHOS, lerMassa, temContaVarredura, type ChaveConta, type Massa } from "../fixtures/varredura";
import { acharRedundancias, type Redundancia } from "../fixtures/redundancia";

/*
  T337 — VARREDURA DE REDUNDÂNCIA (Pista C, 23/10; ordem do proprietário, defeito E50: a entrada do assistente de
  anúncio diz "Anuncie seu imóvel / Em 6 passos…" e logo abaixo "Anunciar seu imóvel em 6 passos / Comece pelo CEP…").
  Em toda página do mapa de cobertura (tests/e2e/cobertura.json), por persona, mais as rotas com id da massa da
  varredura, a 390 e 1280 px: procura no <main> o mesmo título, texto, ação ou chip dito duas vezes
  (fixtures/redundancia.ts). SÓ RELATA (linhas "REDUND|…" e tests/laboratorio/saida/redundancia/*.json); a lista vai
  para o Muse, que encaminha cada correção. Só no laboratório.
*/
type Persona = "publico" | "inquilino" | "proprietario" | "admin" | "parceiro";
const CONTA: Record<Persona, ChaveConta | "VISITANTE" | "ADMIN"> = {
  publico: "VISITANTE", inquilino: "INQUILINA", proprietario: "DONO17", admin: "ADMIN", parceiro: "PARCEIRO",
};
const SECOES_CONTA = ["perfil", "seguranca", "notificacoes", "ajuda", "perfil-publico", "pagamentos", "excluir"];
const COM_ID: Record<Persona, (m: Massa) => string[]> = {
  publico: (m) => [`/imoveis/${m.imovel17}`, `/proprietario/${m.ids.DONO17}`, "/cidades/uberlandia"],
  inquilino: (m) => [`/dashboard/estadia/${m.contrato}`, ...SECOES_CONTA.map((s) => `/dashboard/conta/${s}`)],
  proprietario: (m) => [
    "/dashboard/imoveis/novo",
    `/dashboard/imoveis/${m.imovel17}/editar`,
    `/dashboard/imoveis/${m.imovel17}/nivel`,
    `/dashboard/imoveis/${m.imovel17}/conforto`,
    `/dashboard/imoveis/${m.imovel17}/desempenho`,
    `/dashboard/estadia/${m.contrato}`,
    `/dashboard/estadia/${m.contrato}/mensagens`,
    ...SECOES_CONTA.map((s) => `/dashboard/conta/${s}`),
  ],
  admin: (m) => [`/admin/contratos/${m.contrato}`],
  parceiro: () => [],
};

function rotasDe(persona: Persona, m: Massa | null): string[] {
  const c = JSON.parse(readFileSync("tests/e2e/cobertura.json", "utf8")) as { paginas: Record<string, { personas: string[] }> };
  const fixas = Object.entries(c.paginas)
    .filter(([r, v]) => v.personas.includes(persona) && !r.includes("["))
    .map(([r]) => r);
  return [...new Set([...fixas, ...(m ? COM_ID[persona](m) : [])])];
}

const MASSA = lerMassa();
const SAIDA = "tests/laboratorio/saida/redundancia";
const POR_TESTE = 8;

const sessoes = new Map<string, Awaited<ReturnType<BrowserContext["storageState"]>>>();
async function contexto(browser: Browser, persona: Persona, largura: number, altura: number) {
  const base = { viewport: { width: largura, height: altura } };
  const conta = CONTA[persona];
  if (conta === "VISITANTE") return browser.newContext({ ...base, storageState: { cookies: [], origins: [] } });
  if (conta === "ADMIN") return browser.newContext({ ...base, storageState: authFile("admin") });
  if (!sessoes.has(conta)) {
    const p = await entrar(browser, process.env[`TESTES_VARREDURA_${conta}_EMAIL`]!, process.env[`TESTES_VARREDURA_${conta}_SENHA`]!);
    sessoes.set(conta, await p.context().storageState());
    await p.context().close();
  }
  return browser.newContext({ ...base, storageState: sessoes.get(conta) });
}

test.describe("T337 — varredura de redundância (mesmo conteúdo duas vezes na tela), 390 e 1280 px", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (contas e massa da varredura)");
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
  });

  for (const persona of ["publico", "inquilino", "proprietario", "admin", "parceiro"] as Persona[]) {
    const rotas = rotasDe(persona, MASSA);
    for (let g = 0; g * POR_TESTE < rotas.length; g++) {
      const grupo = rotas.slice(g * POR_TESTE, (g + 1) * POR_TESTE);
      test(`${persona} ${g + 1}: ${grupo.length} telas`, async ({ browser }) => {
        test.setTimeout(60_000 * grupo.length);
        const conta = CONTA[persona];
        test.skip(conta !== "VISITANTE" && conta !== "ADMIN" && !temContaVarredura(conta), `sem a conta ${conta}`);
        const relatorio: { rota: string; tamanho: string; destino: string; achados: Redundancia[] }[] = [];
        for (const rota of grupo) {
          for (const tam of TAMANHOS) {
            const ctx = await contexto(browser, persona, tam.width, tam.height);
            try {
              const page = await ctx.newPage();
              const r = await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 40_000 }).catch(() => null);
              await page.locator("main").first().waitFor({ timeout: 15_000 }).catch(() => {});
              await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});
              const destino = new URL(page.url()).pathname;
              const rotulo = rota.replace(/[0-9a-f-]{36}/g, ":id");
              if (destino !== rota.split("?")[0]) {
                console.log(`REDUND-PULO|${tam.nome}|${persona}|${rotulo}|foi para ${destino.replace(/[0-9a-f-]{36}/g, ":id")}`);
                relatorio.push({ rota: rotulo, tamanho: tam.nome, destino, achados: [] });
                continue;
              }
              const achados = (r && r.status() < 400) ? await acharRedundancias(page) : [];
              for (const a of achados)
                console.log(`REDUND|${tam.nome}|${persona}|${rotulo}|${a.regra}|${a.mesmaTela ? "mesma tela" : "longe"}${a.fixo ? "|fixo" : ""}|A: ${a.ondeA} "${a.textoA}"|B: ${a.ondeB} "${a.textoB}"`);
              relatorio.push({ rota: rotulo, tamanho: tam.nome, destino, achados });
            } finally {
              await ctx.close();
            }
          }
        }
        mkdirSync(SAIDA, { recursive: true });
        writeFileSync(`${SAIDA}/${persona}-${g + 1}.json`, JSON.stringify(relatorio, null, 2));
        // Só relata: a lista vai para o Muse. O teste cobra apenas que as telas tenham sido abertas.
        expect(relatorio.length).toBe(grupo.length * TAMANHOS.length);
      });
    }
  }
});
