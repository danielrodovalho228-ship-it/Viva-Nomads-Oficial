import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { TAMANHOS, abrirComoConta, cliqueResponde, lerMassa, temContaVarredura, type Massa } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T621 — VARREDURA DA PÁGINA INTEIRA, BLOCO 55 (Pista C, 29/10). O protocolo do bloco 21 (t385): seis classes (imagem
  vazia/quebrada, sobreposição de elemento fixo, texto cortado, grade desalinhada…), página toda rolada, carregamento
  real de cada imagem, 390 e 1280 px, HTTP abaixo de 400 e o clique no primário com resposta visível em até 3 s.
  Segue a ordem dos merges depois do bloco 54 (#1494 e #1495 só mexeram em spec/cobertura):
    · E218 (#1492, L-71): o checklist de ativação do dono ("Para publicar seu anúncio") voltou ao Início do PROP-6 —
      DENTRO do bloco "Anuncie seu primeiro imóvel" (dono novo, sem nada) e ABAIXO do bloco principal (dono com
      rascunho: DONO0 da massa, rascunho sem fotos). Além da varredura, confere que o checklist aparece no lugar certo
      no dono novo;
    · E193 (#1496): um só estilo de controle no assistente de cadastro (pílulas para várias escolhas, cartão para uma) —
      a entrada e as dez etapas no rascunho da massa (DONO17), sem clicar no primário (ele avança o cadastro). O "sem
      caixas nem listas" é a t620 que prova; aqui é a varredura visual das seis classes depois da troca.
  O dono novo é criado e apagado aqui. Só no laboratório.
*/
type Conta = "NOVO" | "DONO0" | "DONO17";
interface Tela {
  conta: Conta;
  papel: string;
  nome: string;
  rota: (m: Massa) => string;
  /** false: não clica no primário (ação com efeito fora da tela). */
  clicar?: boolean;
  /** Onde o checklist do dono tem de estar (E218), quando a tela é o Início. */
  checklist?: "dentro";
}

const PASSOS = ["tipo", "fotos", "endereco", "detalhes", "comodidades", "regras", "descricao", "preco", "disponibilidade", "revisao"] as const;

const TELAS: Tela[] = [
  { conta: "NOVO", papel: "proprietário", nome: "Início do dono novo, checklist dentro de \"Anuncie seu primeiro imóvel\" (E218)", rota: () => "/dashboard", checklist: "dentro" },
  { conta: "DONO0", papel: "proprietário", nome: "Início do dono com rascunho, checklist abaixo do bloco (E218)", rota: () => "/dashboard" },
  { conta: "DONO17", papel: "proprietário", nome: "Entrada do cadastro (E193)", rota: () => "/dashboard/imoveis/novo", clicar: false },
  ...PASSOS.map(
    (passo, i): Tela => ({
      conta: "DONO17",
      papel: "proprietário",
      nome: `Cadastro com um controle só (E193), passo ${i + 1} (${passo})`,
      rota: (m) => `/dashboard/imoveis/novo?draft=${m.rascunho1}&etapa=${passo}`,
      clicar: false,
    }),
  ),
];

/**
 * Achados já registrados como defeito de produto (L-*): ficam anotados no relatório e não derrubam o teste;
 * qualquer outro achado derruba. Quando a pista dona corrigir, o achado some e a linha sai daqui.
 */
const CONHECIDOS: { rota: RegExp; achado: RegExp; l: string; classe?: Classe }[] = [
  // L-63 (Pista A + Daniel): as 7 fotos dos cartões de tipo do #1312 ainda não estão em public/images/imoveis/.
  { rota: /^\/dashboard\/imoveis\/novo(\?|$)/, classe: "imagem", achado: /\/images\/imoveis\/(tipo-(casa|studio|loft|cobertura|casa-condominio|flat)|placeholder-imovel-chacara)\.webp/, l: "L-63" },
  { rota: /^\/dashboard\/imoveis\/novo(\?|$)/, classe: "foto", achado: /área de foto vazia \(aspect-ratio 4 \/ 3\).*"Imagem ilustrativa"/, l: "L-63" },
];
const conhecido = (rotulo: string, a: string, classe?: Classe) => CONHECIDOS.find((c) => c.classe === classe && c.rota.test(rotulo) && c.achado.test(a));

const MASSA = lerMassa();
const SAIDA = "tests/laboratorio/saida/varredura-bloco55";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
const CLIQUE = "clique no botão primário sem resposta visível em 3 s";
const sufixo = novoSufixo();
const senha = novaSenha();
const novo = { email: `novo.t621.${sufixo}@lab.vivanomads.test`, nome: "Nina Primeira", role: "owner" as const };
const ids: Record<string, string> = {};

async function abrir(browser: Parameters<typeof abrirComoConta>[0], conta: Conta, tam: (typeof TAMANHOS)[number]): Promise<Page> {
  if (conta === "NOVO") {
    const page = await entrar(browser, novo.email, senha);
    await page.setViewportSize({ width: tam.width, height: tam.height });
    return page;
  }
  return (await abrirComoConta(browser, conta, tam.nome)).page;
}

test.describe("T621 — varredura da página inteira, bloco 55 (Início do dono com o checklist do E218 e cadastro do E193) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (contas da massa da varredura)");
  // Um worker só: o dono novo vale para a primeira tela; sem o modo serial, uma falha não pula as outras.
  test.describe.configure({ mode: "default" });
  test.beforeAll(async ({}, info) => {
    if (!NO_LABORATORIO || info.project.name !== "chromium") return;
    ids.novo = await criarConta(novo, senha);
    await adm().from("profiles").update({ is_teste: true, intencao: ["anunciar"] }).eq("id", ids.novo);
  });
  test.afterAll(async ({}, info) => {
    if (!NO_LABORATORIO || info.project.name !== "chromium") return;
    await apagarContas([ids.novo].filter(Boolean));
  });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
    expect(MASSA, "laboratório sem a massa da varredura (scripts/lab/massa-varredura.mjs)").not.toBeNull();
  });

  for (const t of TELAS) {
    test(`${t.papel} — ${t.nome}: as seis classes e o clique no primário, rolando a página inteira`, async ({ browser }) => {
      test.setTimeout(180_000);
      test.skip(t.conta !== "NOVO" && !temContaVarredura(t.conta), `sem a conta ${t.conta} na massa`);
      const relatorio: Record<string, Record<string, string[]>> = {};
      for (const tam of TAMANHOS) {
        const rota = t.rota(MASSA!);
        const page = await abrir(browser, t.conta, tam);
        try {
          const respostas = escutarImagens(page);
          const resposta = await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 40_000 });
          expect(resposta?.status() ?? 0, `${t.papel} — ${t.nome} @${tam.nome}: HTTP`).toBeLessThan(400);
          expect(new URL(page.url()).pathname, `${t.papel} — ${t.nome} @${tam.nome}: caiu fora da tela (login ou redirecionamento)`).toBe(rota.split(/[?#]/)[0]);
          await page.locator("main").first().waitFor({ timeout: 20_000 }).catch(() => {});
          if (t.rota(MASSA!) === "/dashboard") {
            const lista = page.locator('[data-testid="checklist-ativacao"][data-papel="proprietario"]');
            const visivel = await lista.first().isVisible({ timeout: 15_000 }).catch(() => false);
            console.log(`VARREDURA|checklist|${tam.nome}|${t.conta}|/dashboard|checklist do dono ${visivel ? "visível" : "ausente"}`);
            if (t.checklist === "dentro") {
              await test.step(`checklist do dono dentro do bloco principal @${tam.nome}`, async () => {
                await expect.soft(lista, `${t.nome} @${tam.nome}: o checklist do dono (E218) aparece`).toBeVisible({ timeout: 15_000 });
                await expect.soft(lista).toContainText("Para publicar seu anúncio");
                const principal = page.getByTestId("inicio-dono-principal");
                await expect.soft(principal, `${t.nome} @${tam.nome}: o bloco principal é "Anuncie seu primeiro imóvel"`).toHaveAttribute("data-tipo", "primeiro_anuncio");
                await expect.soft(principal.locator('[data-testid="checklist-ativacao"]'), `${t.nome} @${tam.nome}: o checklist fica dentro do bloco principal`).toHaveCount(1);
              });
            }
          }
          const achados = await varrerPagina(page, respostas);
          const rotulo = rota.replace(/[0-9a-f-]{36}/g, ":id");
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
                // Primário que é link: a resposta é a navegação (ou a troca da tela sem navegar).
                const antes = page.url();
                const textoAntes = await page.locator("main").first().innerText().catch(() => "");
                await primario.click({ timeout: 5_000, noWaitAfter: true }).catch(() => {});
                const navegou = await page
                  .waitForURL((u) => u.href !== antes, { timeout: 3_000, waitUntil: "commit" })
                  .then(() => true)
                  .catch(() => false);
                const mudou = navegou || (await page.locator("main").first().innerText().catch(() => textoAntes)) !== textoAntes;
                clique = mudou ? [] : [`clique em "${nome}" (link) sem navegação nem mudança na tela em 3 s`];
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
      mkdirSync(SAIDA, { recursive: true });
      writeFileSync(`${SAIDA}/${slug(`${t.papel}-${t.nome}`)}.json`, JSON.stringify({ papel: t.papel, tela: t.nome, achados: relatorio }, null, 2));
    });
  }
});
