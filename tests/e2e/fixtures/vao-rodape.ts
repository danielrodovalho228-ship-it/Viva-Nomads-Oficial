import type { Page } from "@playwright/test";

/*
  Medida do "vão de fim de página" (relay do Muse, 23/10; foto do Daniel no celular: vão branco gigante no fim da
  página do imóvel). Usada pela t310.
  - vão: distância entre o fim do último conteúdo visível do <main> e o topo do <footer> do site (sem rodapé, como no
    painel, o fim do documento). Elemento fixo ou grudado (barra do imóvel, botões flutuantes, abas) não conta.
  - cobertura: rolado até o fim, o último elemento clicável da página (do <main> ou do rodapé) não pode ficar atrás de
    um elemento fixo do pé da tela.
*/
export const VAO_MAXIMO = 64;

export interface MedidaVao {
  vao: number;
  ultimo: string;
  fim: string;
  /** Último clicável coberto por um fixo do pé da tela, ou null. */
  coberto: string | null;
  fixos: string[];
}

export async function rolarAteOFim(page: Page) {
  await page.evaluate(async () => {
    const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 60; i++) {
      const antes = window.scrollY;
      window.scrollTo(0, document.documentElement.scrollHeight);
      await pausa(200);
      if (window.scrollY === antes) break;
    }
    await pausa(400);
  });
}

export async function medirVao(page: Page): Promise<MedidaVao> {
  await rolarAteOFim(page);
  return page.evaluate(() => {
    const desc = (el: Element) => {
      const id = el.id ? `#${el.id}` : "";
      const tid = el.getAttribute("data-testid");
      const txt = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
      return `${el.tagName.toLowerCase()}${id}${tid ? `[${tid}]` : ""}${txt ? ` "${txt}"` : ""}`;
    };
    const dentroDeFixo = (el: Element | null): boolean => {
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        const pos = getComputedStyle(e).position;
        if (pos === "fixed" || pos === "sticky") return true;
      }
      return false;
    };
    const visivel = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      return el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    };
    const temConteudo = (el: Element) =>
      /^(IMG|SVG|VIDEO|CANVAS|IFRAME|INPUT|SELECT|TEXTAREA|BUTTON|A|PICTURE)$/i.test(el.tagName) ||
      Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim() !== "") ||
      // Caixa com fundo ou borda própria (cartão, divisória) também é conteúdo que se vê.
      // (fundo igual ao da página não conta: um wrapper bg-white com folga embaixo é vão, não conteúdo).
      (() => {
        const cs = getComputedStyle(el);
        const fundo = cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent" && !fundosDaPagina.includes(cs.backgroundColor);
        return fundo || cs.backgroundImage !== "none" || parseFloat(cs.borderBottomWidth) > 0;
      })();

    const y = window.scrollY;
    const fundosDaPagina = [document.documentElement, document.body, document.querySelector("main")]
      .filter((e): e is HTMLElement => !!e)
      .map((e) => getComputedStyle(e).backgroundColor);
    const main = document.querySelector("main#conteudo") ?? document.querySelector("main");
    let ultimoBottom = 0;
    let ultimo = "(nenhum)";
    if (main) {
      for (const el of Array.from(main.querySelectorAll("*"))) {
        if (!visivel(el) || dentroDeFixo(el) || !temConteudo(el)) continue;
        // O próprio <main> e wrappers de largura total com fundo não são "último conteúdo": só os descendentes.
        const b = el.getBoundingClientRect().bottom + y;
        if (b > ultimoBottom) {
          ultimoBottom = b;
          ultimo = desc(el);
        }
      }
    }
    // Rodapé do site: o <footer> que vem depois do <main> no documento.
    const rodape = Array.from(document.querySelectorAll("footer")).find(
      (f) => !main || (main.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING && !main.contains(f))
    );
    const fimY = rodape ? rodape.getBoundingClientRect().top + y : document.documentElement.scrollHeight;
    const fim = rodape ? "topo do <footer>" : "fim do documento";

    // Fixos no pé da tela (metade de baixo), visíveis.
    const fixos = Array.from(document.querySelectorAll("body *")).filter((el) => {
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" || !visivel(el)) return false;
      const r = el.getBoundingClientRect();
      return r.top > window.innerHeight / 2 && r.top < window.innerHeight;
    });
    const topoFixo = Math.min(window.innerHeight, ...fixos.map((f) => f.getBoundingClientRect().top));
    // Último clicável da página (fora dos fixos), na ordem visual.
    let alvo: Element | null = null;
    let alvoBottom = -Infinity;
    for (const el of Array.from(document.querySelectorAll("a[href], button, input, select, textarea, [role=button]"))) {
      if (!visivel(el) || dentroDeFixo(el)) continue;
      const b = el.getBoundingClientRect().bottom + y;
      if (b > alvoBottom) {
        alvoBottom = b;
        alvo = el;
      }
    }
    let coberto: string | null = null;
    if (alvo && fixos.length) {
      const r = alvo.getBoundingClientRect();
      if (r.bottom > topoFixo + 1) coberto = `${desc(alvo)} termina em ${Math.round(r.bottom)} px; o fixo começa em ${Math.round(topoFixo)} px`;
    }
    // Sem rodapé (painel), o fim do documento fica atrás dos fixos do pé da tela quando a página está rolada até o
    // fim: só conta o vão que aparece acima deles. Com rodapé, o vão fica no meio da página, à vista, e conta inteiro.
    const escondido = rodape ? 0 : Math.max(0, window.innerHeight - topoFixo);
    return { vao: Math.round(fimY - ultimoBottom - escondido), ultimo, fim, coberto, fixos: fixos.map(desc) };
  });
}
