import { readFileSync } from "node:fs";
import { test, expect, type Browser, type Page } from "@playwright/test";
import {
  NO_LABORATORIO,
  adm,
  apagarContas,
  confirmarContatoDaConta,
  criarConta,
  entrar,
  novaSenha,
  novoSufixo,
} from "../fixtures/laboratorio";

/**
 * T388 — Perfil (perfil-01), correções do print do Daniel (24/10, celular):
 *   E62. Medidor a 100%: estado de sucesso curto ("Perfil completo" + uma linha), sem "Cadastro completo: sim", sem
 *        porcentagem, barra nem a lista do que já foi feito. Abaixo de 100%: só o que FALTA. 390 e 1280.
 *   E61. No celular o "Salvar alterações" vem logo depois do conteúdo: sem vão entre o medidor e o botão nem altura
 *        morta depois dele (só a barra de abas). Salvar continua gravando.
 *   E60. O "Fale com a Viva" não aparece na tela Perfil; nas outras telas do celular fica INTEIRO na tela e ACIMA da
 *        barra de abas, também depois de arrastado para baixo.
 */
const SAIDA = "tests/laboratorio/saida";
const ROTA = "/dashboard/conta/perfil";

test.describe("T388 — Perfil: E60 (botão flutuante), E61 (Salvar), E62 (medidor a 100%)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });
  const senha = novaSenha();
  const completa = {
    email: `inq.t378c.${novoSufixo()}@lab.vivanomads.test`,
    nome: "Ana Ribeiro",
    role: "tenant" as const,
  };
  const nova = {
    email: `inq.t378n.${novoSufixo()}@lab.vivanomads.test`,
    nome: "Bruno Lima",
    role: "tenant" as const,
  };
  const ids: string[] = [];

  test.beforeAll(async () => {
    const id = await criarConta(completa, senha);
    ids.push(id, await criarConta(nova, senha));
    await confirmarContatoDaConta(completa.email);
    // Foto de verdade no armazenamento (o caminho que a própria tela grava).
    const foto = readFileSync("public/images/home/persona-executivo.webp");
    const up = await adm()
      .storage.from("avatars")
      .upload(`${id}/avatar.webp`, foto, {
        contentType: "image/webp",
        upsert: true,
      });
    if (up.error) throw up.error;
    const { error } = await adm()
      .from("profiles")
      .update({
        avatar_url: `${id}/avatar.webp`,
        bio: "Médica em residência, organizada e tranquila.",
        idiomas: ["Português"],
        cidade: "Uberlândia (MG)",
        professional_category: "saude_medico_residente",
      })
      .eq("id", id);
    if (error) throw error;
  });
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  async function como(
    browser: Browser,
    email: string,
    w: number,
  ): Promise<Page> {
    const p = await entrar(browser, email, senha);
    await p.setViewportSize({ width: w, height: w === 1280 ? 900 : 844 });
    await p.goto(ROTA, { waitUntil: "domcontentloaded" });
    await p.getByTestId("perfil-tela").waitFor({ timeout: 20_000 });
    await p
      .waitForLoadState("networkidle", { timeout: 10_000 })
      .catch(() => {});
    return p;
  }

  for (const w of [390, 1280]) {
    test(`E62. a ${w} px: a 100% o medidor é um estado de sucesso curto`, async ({
      browser,
    }) => {
      const p = await como(browser, completa.email, w);
      const medidor = p.getByTestId("complete-perfil");
      await expect(medidor).toHaveAttribute("data-completo", "sim", {
        timeout: 20_000,
      });
      await expect(p.getByTestId("perfil-completo")).toContainText(
        "Perfil completo",
      );
      await expect(medidor).not.toContainText(
        /Cadastro completo|nada faltando|% completo|\bsim\b/,
      );
      await expect(medidor.locator("li")).toHaveCount(0);
      await expect(medidor.locator('[style*="width"]')).toHaveCount(0);
      await expect(p.getByTestId("fale-com-a-viva-raiz")).toHaveCount(0);
      expect(
        await p.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      ).toBeLessThanOrEqual(1);
      // No computador quem rola é o <main> do painel: leva o medidor para a vista antes do print.
      await medidor.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t388-perfil-completo-${w}.png`, fullPage: w === 390 });
      await p.context().close();
    });

    test(`E62. a ${w} px: abaixo de 100% o medidor lista só o que falta`, async ({
      browser,
    }) => {
      const p = await como(browser, nova.email, w);
      const medidor = p.getByTestId("complete-perfil");
      await expect(medidor).toHaveAttribute("data-completo", "nao", {
        timeout: 20_000,
      });
      await expect(p.getByTestId("perfil-progresso")).toContainText(
        "% completo",
      );
      const falta = p.getByTestId("perfil-falta");
      for (const item of [
        "Foto de perfil",
        "Uma frase sobre você",
        "Idiomas",
        "Cidade",
      ])
        await expect(falta).toContainText(item);
      // Nome e e-mail confirmado já estão feitos: não aparecem.
      await expect(falta).not.toContainText(/^Nome$|E-mail confirmado/);
      expect(Number(await falta.getAttribute("data-faltam"))).toBe(
        await falta.locator("li").count(),
      );
      await expect(medidor).not.toContainText(
        /Cadastro completo|nada faltando/,
      );
      // Extra do E62: tocar numa falta leva ao campo dela; o Salvar mostra o estado. (Só na última largura: salvar
      // a frase tira "Uma frase sobre você" das faltas da conta.)
      if (w === 1280) {
        await p.getByTestId("perfil-falta-bio").click();
        await expect(p.locator("#perfil-bio")).toBeFocused();
        await expect(
          p.locator('[data-testid="perfil-salvar-estado"]:visible'),
        ).toHaveText("Tudo salvo");
        await p
          .locator("#perfil-bio")
          .fill("Engenheira em projeto de seis meses.");
        await expect(
          p.locator('[data-testid="perfil-salvar-estado"]:visible'),
        ).toHaveText("Há alterações para salvar");
        await p
          .getByTestId(w < 1024 ? "perfil-salvar-celular" : "perfil-salvar")
          .click();
        await expect(p.getByTestId("perfil-salvar-msg")).toHaveText(
          "Alterações salvas.",
          { timeout: 20_000 },
        );
        await expect(
          p.locator('[data-testid="perfil-salvar-estado"]:visible'),
        ).toHaveText("Tudo salvo");
      }
      await p.context().close();
    });
  }

  test("E61 + E60. a 390 px: o Salvar vem logo depois do conteúdo, sem vão; sem botão flutuante no Perfil", async ({
    browser,
  }) => {
    const p = await como(browser, nova.email, 390);
    await expect(p.getByTestId("fale-com-a-viva-raiz")).toHaveCount(0);
    const salvar = p.getByTestId("perfil-salvar-celular");
    await salvar.scrollIntoViewIfNeeded();
    const m = await p.evaluate(() => {
      const med = document
        .querySelector('[data-testid="complete-perfil"]')!
        .getBoundingClientRect();
      const btn = document
        .querySelector('[data-testid="perfil-salvar-celular"]')!
        .getBoundingClientRect();
      const abas = [...document.querySelectorAll("nav[data-papel]")].find(
        (n) =>
          (n as HTMLElement).offsetParent !== null ||
          getComputedStyle(n).position === "fixed",
      );
      const altAbas = abas ? abas.getBoundingClientRect().height : 0;
      window.scrollTo(0, document.documentElement.scrollHeight);
      const fimBtn = document
        .querySelector('[data-testid="perfil-salvar-celular"]')!
        .getBoundingClientRect().bottom;
      return {
        vaoAntes: btn.top - med.bottom,
        depois: window.innerHeight - altAbas - fimBtn,
        altAbas,
      };
    });
    // Entre o medidor e o botão: o espaço de um bloco para outro (24 px), não um deserto.
    expect(m.vaoAntes, JSON.stringify(m)).toBeLessThanOrEqual(32);
    // No fim da rolagem, do botão até a barra de abas sobra só o respiro da página (nada de altura morta).
    expect(m.depois, JSON.stringify(m)).toBeGreaterThanOrEqual(0);
    expect(m.depois, JSON.stringify(m)).toBeLessThanOrEqual(120);
    await p.screenshot({
      path: `${SAIDA}/t388-perfil-fim-390.png`,
      fullPage: false,
    });
    await p
      .locator("#perfil-bio")
      .fill("Pesquisador em projeto de seis meses.");
    await salvar.click();
    await expect(p.getByTestId("perfil-salvar-msg")).toHaveText(
      "Alterações salvas.",
      { timeout: 20_000 },
    );
    await p.context().close();
  });

  test("E60. a 390 px: nas outras telas o botão fica inteiro e acima da barra de abas, também depois de arrastado", async ({
    browser,
  }) => {
    const p = await entrar(browser, nova.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    const medir = () =>
      p.evaluate(() => {
        const b = document
          .querySelector(
            '[data-testid="fale-com-a-viva-raiz"] button:last-of-type',
          )!
          .getBoundingClientRect();
        const abas = [...document.querySelectorAll("nav[data-papel]")]
          .map((n) => n.getBoundingClientRect())
          .find((r) => r.height > 0);
        return {
          direita: b.right,
          largura: window.innerWidth,
          base: b.bottom,
          topoAbas: abas ? abas.top : window.innerHeight,
        };
      });
    for (const posicao of [null, JSON.stringify({ lado: "dir", baixo: 0 })]) {
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await p.evaluate((v) => {
        try {
          for (const k of Object.keys(localStorage))
            if (/posic/i.test(k) && /viva/i.test(k)) localStorage.removeItem(k);
          if (v) localStorage.setItem("vivanomads-viva-posicao", v);
        } catch {
          /* sem armazenamento */
        }
      }, posicao);
      await p.reload({ waitUntil: "domcontentloaded" });
      await p.getByTestId("fale-com-a-viva-raiz").waitFor({ timeout: 20_000 });
      await p.waitForTimeout(500);
      const r = await medir();
      expect(r.direita, JSON.stringify(r)).toBeLessThanOrEqual(r.largura);
      expect(r.base, JSON.stringify(r)).toBeLessThanOrEqual(r.topoAbas);
    }
    await p.screenshot({
      path: `${SAIDA}/t388-flutuante-390.png`,
      fullPage: false,
    });
    await p.context().close();
  });
});
