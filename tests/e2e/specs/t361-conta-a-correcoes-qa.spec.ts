import { test, expect, type Browser, type Page } from "@playwright/test";
import sharp from "sharp";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * Rodada da vigia 24/10 (Pista C): re-teste dos instáveis do #1230 (run 40072532185) e do #1232 (run 40075189536).
 * Rodada da vigia 24/10 (Pista C): confirmação dos merges no lab-crítico do bloco 19 (t354).
 * L-43 (vigia, 24/10): a Conta não assenta em "networkidle" (C9 a 1280 estourou 30 s no reload); espera até 10 s e segue.
 * T361 — CONTA-A, rodada de correções do QA do Muse (24/10), em /dashboard/conta:
 *   C1. a linha de faltas lista TUDO o que falta (cadastro + barra) e anda depois de salvar;
 *   C2. o motivo da estadia tem um estado só: não conta como falta no Perfil e mora só em Dados ("Prefiro não informar");
 *   C3. cada conteúdo uma vez: um "Salvar perfil", um título "Notificações", sem o resumo repetido do perfil público,
 *       sem títulos "Perfil profissional"/"Seu perfil", sem região/título aninhados em "Papéis e intenção";
 *   C4. o "Fale com a Viva" (redondo no painel) nunca senta sobre o conteúdo durante a rolagem (1280);
 *   C5. foto: escolher pelo seletor de arquivo de verdade → RECORTE (arrastar/zoom) → salvar → topo, cabeçalho e espelho
 *       mudam na hora e ficam depois de recarregar (1280 e 390);
 *   C6. nada pisca no carregamento: nenhum "Carregando…" e o celular em Privacidade não alterna de estado;
 *   C8. a foto aparece uma vez como herói (o topo); o espelho a mostra MENOR; cabeçalho e barra lateral só iniciais nesta
 *       página; a ordem dos blocos confere com o desenho (Topo · Perfil · Avaliações · Papéis · Dados · Privacidade ·
 *       Notificações · Pagamentos · Ajuda/Sair);
 *   C9/E56. padrão TOGGLE nos blocos opcionais da Conta. Convertidos nesta rodada (a lista vem de BLOCOS_TOGGLE_CONTA):
 *       "Meus pets" ("Você tem pet?"), "Meu local de trabalho" ("Quer ver o tempo até o trabalho?") e as redes privadas
 *       ("Quer informar suas redes sociais?", atrás da chave REDES_USUARIO_ATIVO). Fechado sem dados; aberto com dados;
 *       desligar com dados pede confirmação na tela e só então limpa. O medidor não conta pets/local/redes (não penaliza).
 *   C7. sem vão grande depois do último bloco; o avatar do rodapé da barra lateral sem o selo "Q".
 * Prints: tests/laboratorio/saida/t361-<FASE>-conta-<largura>.png (FASE=antes|depois) — o teste "prints" roda nas duas.
 */
const SAIDA = "tests/laboratorio/saida";
const FASE = process.env.T361_FASE ?? "depois";

test.describe("T361 — CONTA-A: correções do QA (C1–C7)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const inq = { email: `inq.t357.${sufixo}@lab.vivanomads.test`, nome: "Teo Lima", role: "tenant" as const };
  const ids: Record<string, string> = {};

  async function como(browser: Browser, w: number): Promise<Page> {
    const p = await entrar(browser, inq.email, senha);
    await p.setViewportSize({ width: w, height: w === 1280 ? 900 : 844 });
    return p;
  }

  test.beforeAll(async () => {
    ids.inq = await criarConta(inq, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.inq]);
  });

  for (const w of [1280, 390]) {
    test(`prints (${FASE}) a ${w} px`, async ({ browser }) => {
      const p = await como(browser, w);
      await p.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
      await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await p.getByTestId("complete-perfil").waitFor();
      // No computador o painel rola DENTRO da coluna: solta a rolagem para o print pegar a página inteira.
      await p.evaluate(() => {
        for (let el = document.querySelector("main") as HTMLElement | null; el && el !== document.body; el = el.parentElement) {
          el.style.height = "auto";
          el.style.maxHeight = "none";
          el.style.overflow = "visible";
        }
      });
      await p.screenshot({ path: `${SAIDA}/t361-${FASE}-conta-${w}.png`, fullPage: true });
      await p.context().close();
    });
  }

  test.describe("correções", () => {
  test.skip(FASE === "antes", "Na fase 'antes' só os prints.");

  // 390 primeiro: o caso de 1280 salva a frase (e ela sai da linha de faltas).
  for (const w of [390, 1280]) {
    test(`C1/C2. a ${w} px: a linha de faltas lista tudo; o motivo não conta e está só em Dados`, async ({ browser }) => {
      const p = await como(browser, w);
      await p.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
      await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      const falta = p.getByTestId("perfil-falta");
      // (A conta do laboratório já nasce com documento; o item entra na linha quando falta — unit do medidor.)
      for (const item of ["Foto de perfil", "Uma frase sobre você", "Idiomas", "Cidade", "Profissão"]) {
        await expect(falta, item).toContainText(item);
      }
      // Cada item que falta na lista de marcação está na linha (o medidor declara o que conta).
      const naLista = await p.getByTestId("complete-perfil").locator("li").evaluateAll((els) => els.length);
      expect(Number(await falta.getAttribute("data-faltam"))).toBeLessThanOrEqual(naLista);
      // C2: um estado só para o motivo.
      await expect(p.getByTestId("complete-perfil")).not.toContainText("Motivo da estadia");
      await expect(p.getByTestId("perfil-motivo-estadia")).toHaveCount(0);
      if (w === 1280) {
        // O medidor anda: salvar a frase tira "Uma frase sobre você" da linha, sem recarregar.
        await p.locator("#perfil-bio").fill("Engenheiro em projeto de seis meses, tranquilo.");
        await p.getByTestId("perfil-salvar").click();
        await expect(p.getByTestId("perfil-salvar-msg")).toHaveText("Alterações salvas.");
        await expect(falta).not.toContainText("Uma frase sobre você");
      }
      // A1: o motivo mora só na tela Dados.
      await p.goto("/dashboard/conta/dados", { waitUntil: "domcontentloaded" });
      await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await expect(p.getByTestId("perfil-motivo-estadia")).toHaveCount(1);
      await expect(p.getByTestId("perfil-motivo-estadia").locator("option:checked")).toHaveText("Prefiro não informar");
      await p.context().close();
    });
  }

  for (const w of [1280, 390]) {
    test(`C5. a ${w} px: escolher a foto → recortar → salvar → topo, cabeçalho e espelho atualizam`, async ({ browser }) => {
      const p = await como(browser, w);
      await p.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
      await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      const jpg = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#3a6ea5" } }).jpeg().toBuffer();
      const fc = p.waitForEvent("filechooser", { timeout: 5_000 });
      await p.getByTestId("topo-foto").click();
      await (await fc).setFiles({ name: "minha-foto.jpg", mimeType: "image/jpeg", buffer: jpg });
      // A etapa de recorte aparece ANTES de salvar: enquadrar (zoom e arrastar) e só então "Salvar foto".
      const recorte = p.getByTestId("foto-recorte");
      await expect(recorte).toBeVisible();
      await p.getByTestId("foto-zoom").fill("1.6");
      const area = p.getByTestId("foto-recorte-area");
      await area.focus();
      await p.keyboard.press("ArrowRight");
      await p.screenshot({ path: `${SAIDA}/t361-depois-c5-recorte-${w}.png` });
      await p.getByTestId("foto-salvar").click();
      await expect(recorte).toBeHidden();
      await expect(p.getByTestId("topo-foto-msg")).toContainText("Foto atualizada");
      const comFoto = async () => {
        await expect(p.getByTestId("topo-conta").locator("img")).toHaveCount(1);
        await expect(p.locator('[data-testid="espelho-perfil"]:visible img:visible')).toHaveCount(1);
        // Mockup perfil-01 (decisão de 24/10, no lugar da C8): o cabeçalho e a barra lateral mostram a foto.
        await expect(p.locator('[data-testid="papel-ativo"]:visible img')).toHaveCount(1);
        await expect(p.getByTestId("barra-avatar").locator("img")).toHaveCount(1);
      };
      await comFoto();
      // C8: só duas aparições da foto na página (topo e espelho), e a do espelho menor que a do topo.
      const tamanhos = await p.locator("main img").evaluateAll((els) =>
        els.filter((e) => (e as HTMLImageElement).src.includes("avatar") && e.getBoundingClientRect().width > 0).map((e) => Math.round(e.getBoundingClientRect().width)),
      );
      expect(tamanhos.length, tamanhos.join(",")).toBe(2);
      const topoW = Math.round((await p.getByTestId("topo-conta").locator("img").boundingBox())!.width);
      const espelhoW = Math.round((await p.locator('[data-testid="espelho-perfil"]:visible img:visible').boundingBox())!.width);
      expect(espelhoW).toBeLessThan(topoW);
      await p.screenshot({ path: `${SAIDA}/t361-depois-c5-salva-${w}.png` });
      await p.reload({ waitUntil: "domcontentloaded" });
      await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await comFoto();
      // Fora da Conta, o cabeçalho mostra a foto nova.
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(p.locator('[data-testid="papel-ativo"]:visible img')).toHaveCount(1);
      await p.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
      await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      // Volta ao estado sem foto para o próximo tamanho começar igual.
      await p.getByTestId("topo-foto-remover").click();
      await expect(p.getByTestId("topo-conta").locator("img")).toHaveCount(0);
      await p.context().close();
    });
  }

  for (const w of [390, 1280]) {
    test(`C9. a ${w} px: "Você tem pet?" fechado → aberto → com pet nasce aberto → desligar pede confirmação e limpa`, async ({ browser }) => {
      const p = await como(browser, w);
      await p.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
      await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      const bloco = p.getByTestId("pets-toggle-bloco");
      const toggle = p.getByTestId("pets-toggle-bloco-toggle");
      await expect(toggle).toHaveAttribute("aria-checked", "false");
      await expect(p.getByTestId("pets-form")).toHaveCount(0);
      await expect(bloco.locator("input, select")).toHaveCount(0);
      await bloco.scrollIntoViewIfNeeded();
      await p.locator("#pets").screenshot({ path: `${SAIDA}/t361-depois-c9-pets-fechado-${w}.png` });
      await toggle.click();
      const form = p.getByTestId("pets-form");
      for (const campo of ["Nome", "Espécie", "Porte", "Idade (anos)", "Raça (opcional)", "Castrado?"]) await expect(form.getByLabel(campo)).toBeVisible();
      await p.locator("#pets").screenshot({ path: `${SAIDA}/t361-depois-c9-pets-aberto-${w}.png` });
      await form.getByLabel("Nome").fill(`Thor${w}`);
      await form.getByRole("button", { name: "Adicionar pet" }).click();
      await expect(p.getByTestId("pets-lista")).toContainText(`Thor${w}`);
      await expect(form.getByRole("button", { name: "Adicionar outro pet" })).toBeVisible();
      // Com pet salvo, recarregar abre o bloco ligado.
      await p.reload({ waitUntil: "domcontentloaded" });
      await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await expect(toggle).toHaveAttribute("aria-checked", "true");
      await expect(p.getByTestId("pets-lista")).toContainText(`Thor${w}`);
      // Desligar com pet: confirmação na tela; "Manter" não apaga; "Remover" limpa e fecha.
      await toggle.click();
      await expect(p.getByTestId("pets-toggle-bloco-confirma")).toContainText("Remover os pets do seu perfil? Eles saem da sua candidatura.");
      await p.getByTestId("pets-toggle-bloco-confirma-manter").click();
      await expect(toggle).toHaveAttribute("aria-checked", "true");
      await expect(p.getByTestId("pets-lista")).toContainText(`Thor${w}`);
      await toggle.click();
      await p.getByTestId("pets-toggle-bloco-confirma-remover").click();
      await expect(toggle).toHaveAttribute("aria-checked", "false");
      await expect(p.getByTestId("pets-lista")).toHaveCount(0);
      await p.reload({ waitUntil: "domcontentloaded" });
      await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await expect(toggle).toHaveAttribute("aria-checked", "false");
      // O medidor não lista pets nem local de trabalho como falta.
      await expect(p.getByTestId("perfil-falta")).not.toContainText(/pet|trabalho/i);
      // O outro bloco convertido (A1: na tela Dados): o local de trabalho também nasce fechado sem dados.
      await p.goto("/dashboard/conta/dados", { waitUntil: "domcontentloaded" });
      await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await expect(p.getByTestId("local-toggle-bloco-toggle").last()).toHaveAttribute("aria-checked", "false");
      await expect(p.getByTestId("meu-local-trabalho")).toHaveCount(0);
      await p.context().close();
    });
  }

  test("C3. cada conteúdo uma vez (1280; A1: uma tela por seção)", async ({ browser }) => {
    const p = await como(browser, 1280);
    await p.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
    await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await expect(p.getByRole("button", { name: "Salvar alterações" }).locator("visible=true")).toHaveCount(1);
    await expect(p.getByTestId("seu-perfil-publico")).toHaveCount(0);
    await expect(p.locator('[data-testid="espelho-perfil"]:visible')).toHaveCount(1);
    const titulos = await p.getByTestId("perfil-tela").locator("h2:visible, h3:visible").allInnerTexts();
    expect(titulos).not.toContain("Seu perfil");
    expect(titulos.filter((t) => t === "Perfil profissional").length, titulos.join(" | ")).toBeLessThanOrEqual(1);
    await p.goto("/dashboard/conta/notificacoes", { waitUntil: "domcontentloaded" });
    await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await expect(p.getByRole("heading", { name: "Notificações", exact: true })).toHaveCount(1);
    await p.goto("/dashboard/conta/papeis", { waitUntil: "domcontentloaded" });
    await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await expect(p.getByRole("heading", { name: "Papéis e intenção", exact: true })).toHaveCount(1);
    await p.context().close();
  });

  test("C4. o 'Fale com a Viva' nunca senta sobre o conteúdo durante a rolagem (1280)", async ({ browser }) => {
    const p = await como(browser, 1280);
    // A1: Dados é a tela mais longa da Conta.
    await p.goto("/dashboard/conta/dados", { waitUntil: "domcontentloaded" });
    await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    const flut = p.getByTestId("fale-com-a-viva");
    await expect(flut).toBeVisible();
    await expect(flut).toHaveAttribute("data-compacto", "1");
    const total = await p.evaluate(() => {
      const m = document.querySelector("[data-painel-main]") as HTMLElement;
      return Math.max(m.scrollHeight, document.documentElement.scrollHeight);
    });
    for (let y = 0; y < total; y += 400) {
      await p.evaluate((y) => {
        const m = document.querySelector("[data-painel-main]") as HTMLElement;
        m.scrollTo(0, y);
        window.scrollTo(0, y);
      }, y);
      const sobre = await p.evaluate(() => {
        const b = document.querySelector('[data-testid="fale-com-a-viva"]')!.getBoundingClientRect();
        const m = document.querySelector("[data-painel-main]") as HTMLElement;
        const direitaDoConteudo = m.getBoundingClientRect().right - parseFloat(getComputedStyle(m).paddingRight);
        return b.left < direitaDoConteudo ? `${Math.round(b.left)} < ${Math.round(direitaDoConteudo)}` : null;
      });
      expect(sobre, `rolagem ${y}px`).toBeNull();
    }
    await p.context().close();
  });

  for (const w of [1280, 390]) {
    test(`C6. a ${w} px: nada pisca no carregamento (Carregando… e o celular em Privacidade)`, async ({ browser }) => {
      const p = await como(browser, w);
      // Grava, desde o primeiro quadro, cada texto "Carregando…" na Conta e cada estado do item Celular.
      await p.addInitScript(() => {
        const w = window as unknown as { __vistos: string[]; __celular: string[] };
        w.__vistos = [];
        w.__celular = [];
        new MutationObserver(() => {
          const main = document.querySelector("[data-painel-main]");
          if (main && /Carregando…/.test((main as HTMLElement).innerText)) w.__vistos.push("Carregando…");
          const cel = document.querySelector('[data-testid="confianca-celular"]');
          const s = cel?.getAttribute("data-situacao");
          if (s && w.__celular[w.__celular.length - 1] !== s) w.__celular.push(s);
        }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
      });
      for (let i = 0; i < 2; i++) {
        await p.goto("/dashboard/conta/privacidade", { waitUntil: "domcontentloaded" });
        await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
        await expect(p.getByTestId("confianca-lista")).toHaveAttribute("aria-busy", "false");
        // Lê os registros do script de início (o objeto window inteiro não serializa; lê só as duas listas).
        const r = await p.evaluate(() => {
          const w = window as unknown as { __vistos?: string[]; __celular?: string[] };
          return { __vistos: w.__vistos ?? [], __celular: w.__celular ?? [] };
        });
        expect(r.__vistos, "nenhum 'Carregando…' na Conta").toEqual([]);
        // No máximo: carregando → estado final (nunca "falta" e depois "em_breve", nem o contrário).
        const reais = r.__celular.filter((s) => s !== "carregando");
        expect(reais.length, r.__celular.join(" → ")).toBeLessThanOrEqual(1);
      }
      await p.context().close();
    });
  }

  test("C7. sem vão grande depois do último bloco; avatar do rodapé da barra lateral sem selo (1280)", async ({ browser }) => {
    const p = await como(browser, 1280);
    await p.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
    await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    const vao = await p.evaluate(() => {
      const m = document.querySelector("[data-painel-main]") as HTMLElement;
      const ultimo = document.querySelector('[data-testid="perfil-tela"]') as HTMLElement;
      const fimConteudo = ultimo.getBoundingClientRect().bottom - m.getBoundingClientRect().top + m.scrollTop;
      return Math.round(m.scrollHeight - fimConteudo);
    });
    // A folga só cobre o botão flutuante (7 rem = 112 px) e um respiro.
    expect(vao).toBeLessThanOrEqual(160);
    await expect(p.locator("aside .avatar-swap")).toHaveCount(0);
    await p.context().close();
  });
  });
});
