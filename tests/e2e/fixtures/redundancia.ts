import type { Page } from "@playwright/test";

/*
  Varredura de REDUNDÂNCIA (ordem do proprietário, 23/10, defeito E50; usada pela t337). Dentro do <main> visível da
  tela, procura o mesmo conteúdo dito duas vezes:
   - titulo: dois títulos iguais ou quase iguais (h1–h4, role=heading e "título visual": texto curto em negrito ≥ 16 px),
     por semelhança de palavras (radical, sem artigos/preposições) ≥ 0,6. Ex. E50: "Anuncie seu imóvel" e
     "Anunciar seu imóvel em 6 passos".
   - texto: o mesmo parágrafo/explicação (≥ 30 caracteres) em dois blocos (semelhança ≥ 0,8 com ≥ 5 palavras).
   - acao: o mesmo botão ou link (mesmas palavras e, em link, o mesmo destino) em 2 ou 3 lugares; 4 ou mais é lista e
     fica de fora, assim como o mesmo botão repetido em cartões diferentes de uma lista (um por cartão).
   - chip: dois chips/rótulos com o mesmo texto no mesmo grupo.
  "mesmaTela" diz se as duas ocorrências cabem numa mesma altura de janela. Só mede e relata; não reprova.
*/
export type Regra = "titulo" | "texto" | "acao" | "chip";
export interface Redundancia {
  regra: Regra;
  textoA: string;
  textoB: string;
  ondeA: string;
  ondeB: string;
  semelhanca: number;
  mesmaTela: boolean;
  fixo: boolean;
}

export async function acharRedundancias(page: Page): Promise<Redundancia[]> {
  return page.evaluate(() => {
    const PARADAS = new Set("o a os as de do da dos das e em no na nos nas seu sua seus suas para por pelo pela com um uma que se ou ao aos mais the and".split(" "));
    const norm = (s: string) =>
      s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
    const radical = (w: string) => w.replace(/(ando|endo|indo|ar|er|ir|ou|ei|e|a|o|s)$/, "").slice(0, 7);
    const palavras = (s: string) => [...new Set(norm(s).split(" ").filter((w) => w.length > 1 && !PARADAS.has(w)).map(radical))];
    const jaccard = (a: string[], b: string[]) => {
      if (!a.length || !b.length) return 0;
      const sb = new Set(b);
      const i = a.filter((x) => sb.has(x)).length;
      return i / (a.length + b.length - i);
    };
    const visivel = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      if (el.closest("[aria-hidden='true'], [hidden], dialog:not([open]), details:not([open]) > :not(summary)")) return false;
      return el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    };
    const noFixo = (el: Element | null): boolean => {
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        const p = getComputedStyle(e).position;
        if (p === "fixed" || p === "sticky") return true;
      }
      return false;
    };
    const texto = (el: Element) => ((el as HTMLElement).innerText ?? el.textContent ?? "").replace(/\s+/g, " ").trim();
    const onde = (el: Element) => {
      const tid = el.closest("[data-testid]")?.getAttribute("data-testid");
      let titulo = "";
      const sec = el.closest("section, article, form, [data-testid]");
      const h = sec?.querySelector("h1, h2, h3");
      if (h && h !== el) titulo = texto(h).slice(0, 40);
      return `${el.tagName.toLowerCase()}${tid ? `[${tid}]` : ""}${titulo ? ` em "${titulo}"` : ""}`;
    };
    const y = (el: Element) => el.getBoundingClientRect().top + window.scrollY;
    const main = document.querySelector("main#conteudo") ?? document.querySelector("main");
    if (!main) return [];
    const todos = Array.from(main.querySelectorAll("*")).filter(visivel);
    const achados: Redundancia[] = [];
    const vistos = new Set<string>();
    const anotar = (regra: Regra, a: Element, b: Element, sem: number) => {
      const tA = texto(a).slice(0, 90);
      const tB = texto(b).slice(0, 90);
      const chave = `${regra}|${norm(tA)}|${norm(tB)}`;
      if (vistos.has(chave)) return;
      vistos.add(chave);
      achados.push({
        regra, textoA: tA, textoB: tB, ondeA: onde(a), ondeB: onde(b), semelhanca: Math.round(sem * 100) / 100,
        mesmaTela: Math.abs(y(a) - y(b)) < window.innerHeight, fixo: noFixo(a) || noFixo(b),
      });
    };
    const ancestral = (a: Element, b: Element) => a.contains(b) || b.contains(a);

    // 1. títulos
    const titulos = todos.filter((el) => {
      if (/^H[1-4]$/.test(el.tagName) || el.getAttribute("role") === "heading") return true;
      if (!/^(P|SPAN|DIV|STRONG|LEGEND)$/.test(el.tagName) || el.children.length > 2) return false;
      const cs = getComputedStyle(el);
      const t = texto(el);
      return t.length >= 4 && t.length <= 80 && parseFloat(cs.fontSize) >= 16 && Number(cs.fontWeight) >= 600;
    });
    for (let i = 0; i < titulos.length; i++)
      for (let j = i + 1; j < titulos.length; j++) {
        const a = titulos[i], b = titulos[j];
        if (ancestral(a, b)) continue;
        const pa = palavras(texto(a)), pb = palavras(texto(b));
        if (Math.min(pa.length, pb.length) < 1) continue;
        const sem = norm(texto(a)) === norm(texto(b)) ? 1 : jaccard(pa, pb);
        if (sem >= 0.6 && (sem === 1 || Math.min(pa.length, pb.length) >= 2)) anotar("titulo", a, b, sem);
      }

    // 2. textos explicativos (folhas de texto com 30+ caracteres)
    const textos = todos.filter((el) => /^(P|LI|SPAN|DIV|SMALL|DD|TD)$/.test(el.tagName) && texto(el).length >= 30 &&
      !Array.from(el.children).some((c) => texto(c).length >= 30));
    for (let i = 0; i < textos.length; i++)
      for (let j = i + 1; j < textos.length; j++) {
        const a = textos[i], b = textos[j];
        if (ancestral(a, b)) continue;
        const pa = palavras(texto(a)), pb = palavras(texto(b));
        if (Math.min(pa.length, pb.length) < 5) continue;
        const sem = norm(texto(a)) === norm(texto(b)) ? 1 : jaccard(pa, pb);
        if (sem >= 0.8) anotar("texto", a, b, sem);
      }

    // 3. ações repetidas (2 ou 3 iguais; não conta um por cartão de lista)
    const acoes = todos.filter((el) => el.matches("a[href], button, [role='button']") && texto(el).length >= 2 && texto(el).length <= 60);
    const grupos = new Map<string, Element[]>();
    for (const el of acoes) {
      const chave = `${norm(texto(el))}|${el.getAttribute("href") ?? ""}`;
      grupos.set(chave, [...(grupos.get(chave) ?? []), el]);
    }
    const cartao = (el: Element) => el.closest("li, article, [data-testid*='card'], [data-testid*='cartao'], tr");
    for (const lista of grupos.values()) {
      if (lista.length < 2 || lista.length > 3) continue;
      const [a, b] = lista;
      const ca = cartao(a), cb = cartao(b);
      if (ca && cb && ca !== cb && ca.tagName === cb.tagName) continue;
      if (ancestral(a, b)) continue;
      anotar("acao", a, b, 1);
    }

    // 4. chips/rótulos duplicados no mesmo grupo
    for (const pai of todos) {
      const filhos = Array.from(pai.children).filter((c) => visivel(c) && texto(c).length >= 2 && texto(c).length <= 40);
      if (filhos.length < 2) continue;
      const porTexto = new Map<string, Element[]>();
      for (const f of filhos) porTexto.set(norm(texto(f)), [...(porTexto.get(norm(texto(f))) ?? []), f]);
      for (const [t, lista] of porTexto) if (t && lista.length >= 2 && lista.length <= 3) anotar("chip", lista[0], lista[1], 1);
    }
    return achados;
  });
}
