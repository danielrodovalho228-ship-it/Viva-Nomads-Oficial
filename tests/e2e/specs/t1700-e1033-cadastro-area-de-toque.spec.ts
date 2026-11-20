import { test, expect } from "@playwright/test";
import { areaDeToque } from "../fixtures/area-toque";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrarNaPagina, fotosReais, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso, type PassoCadastro } from "../fixtures/cadastro";

/*
  T1700 — E1033, passo 3, família "cadastro do anúncio": os 5 usos soltos têm a área de toque REAL de 44 × 44 px (helper
  do passo 1), em tela de toque (390 px) e com rato (1280 px): "−" e "+" de TODOS os contadores (Detalhes), "Ver
  fotógrafos na cidade do imóvel" (Fotos), "Adicionar faixa de desconto" (Preço) e "Faltam N itens…" (Revisão).
  Antes: a classe antiga só dava a área em tela de toque; com rato nenhum dos cinco a tinha.
  O miolo do contador (o número, vizinho encostado do "−" e do "+") também é medido: a área de um não tira a do outro.
  A t817 continua a cobrir o toque a 390 e 768 px (o primeiro elemento de cada tipo); esta mede todos, nos dois perfis.
  Fatia 2 (ORDEM-DUET-292): os controles do cadastro que nunca usaram a classe e ficavam abaixo de 44 px — os links
  soltos ("Resolver", "Como pôr um vídeo no anúncio", "Vídeo do imóvel"), as linhas de abrir e fechar, os botões de 36
  a 42 px e os 7 "Editar" da Revisão. Uns aparecem num rascunho novo; outros só num rascunho PREENCHIDO (imóvel
  completo, com fotos).
  Fora desta trava, por pedirem desenho (PR #4059): os links em frase que quebram de linha a 390 px (os 3 atalhos do
  Tipo e "Termos de Uso"/"Política de Privacidade" da Revisão — a área de um cobriria o texto do vizinho), o índice
  dos passos, os botões sobre as fotos, "Remover faixa" e as grades dos calendários.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1700.${sufixo}@lab.vivanomads.test`, nome: "Rita Rato", role: "owner" as const };
// Conta à parte para o rascunho preenchido: com um rascunho na conta, o cadastro novo abre a oferta de o retomar.
const donoCheio = { email: `dono.cheio.t1700.${sufixo}@lab.vivanomads.test`, nome: "Rui Rascunho", role: "owner" as const };
const ids: Record<string, string> = {};

/** etapa, seletor, rótulo, quantos no mínimo têm de existir (nada de pular em silêncio). */
// A área de cada elemento é cobrada com expect.soft: o teste reprova no fim e lista TODOS os que falham, não só o primeiro.
const ALVOS: [PassoCadastro, string, string, number][] = [
  ["detalhes", '[data-testid="contador"] button', "− e + dos contadores", 4],
  ["detalhes", '[data-testid="contador-miolo"]', "o número dos contadores", 2],
  ["fotos", '[data-testid="porta-fotografo-link"]', "Ver fotógrafos na cidade do imóvel", 1],
  ["preco", '[data-testid="adicionar-faixa"]', "Adicionar faixa de desconto", 1],
  ["revisao", '[data-testid="publicar-motivo"]', "Faltam N itens antes de publicar", 1],
  // Fatia 2, rascunho novo.
  ["tipo", '[data-testid^="trava-"][data-testid$="-resolver"]', "Resolver (o que a Viva pede para publicar)", 1],
  ["fotos", "main details > summary", "Ver dicas de foto", 1],
  ["fotos", '[data-testid="video-ajuda"]', "Como pôr um vídeo no anúncio", 1],
  ["comodidades", '[data-testid="conforto-marcar-todos"]', "Confirmo todos", 1],
  ["comodidades", "main details > summary", "Pratos e talheres (opcional)", 1],
  ["revisao", '[data-testid="melhorar-video"]', "Vídeo do imóvel", 1],
  ["revisao", '[data-testid="convite-foto-anuncio-botao"]', "Adicionar foto", 1],
];

/** Fatia 2, rascunho PREENCHIDO: controles que só existem com conteúdo. */
const ALVOS_PREENCHIDO: [PassoCadastro, string, string, number][] = [
  ["comodidades", '[data-testid^="nivel-cadastro-"][data-testid$="-botao"]', "Fotografar pelo celular e Meça agora", 2],
  ["disponibilidade", 'main button:has-text("Bloquear período")', "Bloquear período", 1],
  ["disponibilidade", '[data-testid="importacao-link"]', "o campo do link do calendário", 1],
  ["disponibilidade", '[data-testid="importacao-adicionar"]', "Importar (o link do calendário)", 1],
  ["disponibilidade", '[data-testid="exportar-calendario-copiar"]', "Copiar link", 1],
  ["revisao", '[data-testid^="conferencia-editar-"]', "os Editar da conferência", 6],
];

test.describe("T1700 — cadastro: área de toque 44×44 com qualquer apontador", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    // O rascunho preenchido: imóvel completo do laboratório, com fotos reais, ainda em rascunho.
    ids.donoCheio = await criarConta(donoCheio, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.donoCheio);
    ids.imovel = await criarImovelPronto(ids.donoCheio, `Rascunho preenchido t1700 ${sufixo}`, { ativo: false });
    await fotosReais(ids.imovel, ids.donoCheio);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono, ids.donoCheio]);
  });

  for (const largura of [390, 1280] as const) {
    const toque = largura === 390;
    test(`${largura} px, ${toque ? "toque" : "rato"}: os 5 usos soltos do cadastro`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: largura, height: toque ? 844 : 900 }, hasTouch: toque, isMobile: toque });
      const p = await entrarNaPagina(await ctx.newPage(), dono.email, senha);
      for (const [etapa, sel, rotulo, minimo] of ALVOS) {
        await p.goto(`/dashboard/imoveis/novo?etapa=${etapa}`, { waitUntil: "domcontentloaded" });
        await noPasso(p, etapa, 30_000);
        const todos = p.locator(sel);
        await expect(todos.first(), `${etapa}: ${rotulo} não apareceu`).toBeVisible({ timeout: 20_000 });
        const n = await todos.count();
        expect(n, `${etapa}: ${rotulo}`).toBeGreaterThanOrEqual(minimo);
        for (let i = 0; i < n; i++) {
          const el = todos.nth(i);
          const nome = (await el.getAttribute("aria-label")) ?? (await el.textContent())?.trim().slice(0, 40) ?? `${i}`;
          expect.soft((await areaDeToque(el)).faltam, `${etapa}: ${rotulo} — "${nome}" (${toque ? "toque" : "rato"})`).toEqual([]);
        }
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${etapa}: sem rolagem lateral`).toBeLessThanOrEqual(1);
      }
      await ctx.close();
    });

    test(`${largura} px, ${toque ? "toque" : "rato"}: rascunho preenchido — os controles que só existem com conteúdo`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: largura, height: toque ? 844 : 900 }, hasTouch: toque, isMobile: toque });
      const p = await entrarNaPagina(await ctx.newPage(), donoCheio.email, senha);
      for (const [etapa, sel, rotulo, minimo] of ALVOS_PREENCHIDO) {
        await p.goto(`/dashboard/imoveis/novo?draft=${ids.imovel}&etapa=${etapa}`, { waitUntil: "domcontentloaded" });
        await noPasso(p, etapa, 30_000);
        const todos = p.locator(sel);
        await expect(todos.first(), `${etapa}: ${rotulo} não apareceu`).toBeVisible({ timeout: 20_000 });
        // "Importar" só fica ativo com um link escrito; desativado não recebe o toque, e não haveria o que medir.
        if (sel.includes("importacao-adicionar")) {
          await p.getByTestId("importacao-link").fill("https://exemplo.test/calendario.ics");
          await expect(todos.first()).toBeEnabled();
        }
        const n = await todos.count();
        let medidos = 0;
        for (let i = 0; i < n; i++) {
          const el = todos.nth(i);
          if (!(await el.isVisible())) continue;
          medidos++;
          const nome = (await el.getAttribute("aria-label")) ?? (await el.getAttribute("data-testid")) ?? `${i}`;
          expect.soft((await areaDeToque(el)).faltam, `${etapa}: ${rotulo} — "${nome}" (${toque ? "toque" : "rato"})`).toEqual([]);
        }
        // Os escondidos não se medem, mas o mínimo conta só os que foram medidos: nada passa por não aparecer.
        expect(medidos, `${etapa}: ${rotulo} (medidos)`).toBeGreaterThanOrEqual(minimo);
        expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${etapa}: sem rolagem lateral`).toBeLessThanOrEqual(1);
      }
      await ctx.close();
    });
  }
});
