/*
  Ordem 19b8abf5 — imagens ÚNICAS no site: cada banner, card e ilustração tem a sua.
  Varre o código (páginas, componentes, configs) e falha se o mesmo arquivo de imagem
  decorativa aparece em mais de um lugar, ou se uma foto de ANÚNCIO é usada como
  decoração. Exceções declaradas abaixo (com motivo).
  Roda: node --test src/lib/imagens-unicas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = new URL("..", import.meta.url).pathname; // src/
const MEDIA = readFileSync(join(RAIZ, "lib/media.ts"), "utf8");

/** Mesmo arquivo em mais de um ponto do MESMO elemento/estado — não é repetição na tela. */
const PERMITIDOS = new Map<string, string>([
  ["/media/hero-home-poster.webp", "pôster e fallback do mesmo vídeo da home"],
  ["/images/dashboard/dash-prop-onboarding.webp", "dois estados alternativos da Visão geral do dono (nunca juntos)"],
]);

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.(tsx?|mjs)$/.test(n) && !/\.test\./.test(n) && !p.endsWith("lib/media.ts") ? [p] : [];
  });
}

function prefixos(src: string): Record<string, string> {
  return Object.fromEntries([...src.matchAll(/const (\w+) = "(\/[^"]+)";/g)].map((m) => [m[1], m[2]]));
}

/** Chaves do PHOTOS (inclusive aninhadas) → caminho. */
function chavesPhotos(): Record<string, string> {
  const pref = prefixos(MEDIA);
  const bloco = MEDIA.slice(MEDIA.indexOf("export const PHOTOS"), MEDIA.indexOf("export const PROPERTY_PHOTOS"));
  const out: Record<string, string> = {};
  const pilha: string[] = [];
  for (const linha of bloco.split("\n")) {
    const g = linha.match(/^\s*(\w+): \{/);
    if (g) { pilha.push(g[1]); continue; }
    if (/^\s*\},?$/.test(linha) && pilha.length) { pilha.pop(); continue; }
    const m = linha.match(/^\s*(\w+): [`"]([^`"]+)[`"]/);
    if (m) out[[...pilha, m[1]].join(".")] = m[2].replace(/\$\{(\w)\}/g, (_, k) => pref[k] ?? "?");
  }
  return out;
}

function usos(): Map<string, string[]> {
  const chaves = chavesPhotos();
  const mapa = new Map<string, string[]>();
  const add = (img: string, onde: string) => mapa.set(img, [...(mapa.get(img) ?? []), onde]);
  for (const arq of arquivos(RAIZ)) {
    const src = readFileSync(arq, "utf8");
    const pref = prefixos(src);
    src.split("\n").forEach((l, i) => {
      const onde = `${arq.slice(RAIZ.length)}:${i + 1}`;
      for (const [k, v] of Object.entries(chaves)) if (new RegExp(`PHOTOS\\.${k.replace(".", "\\.")}\\b`).test(l)) add(v, onde);
      for (const m of l.matchAll(/["`]((?:\$\{\w+\})?\/[\w/.-]*\.(?:webp|png|jpe?g|avif))["`]/g)) {
        const img = m[1].replace(/\$\{(\w+)\}/g, (_, k) => pref[k] ?? "?");
        if (img.startsWith("/") && !/\/(brand|icons?|logo)/.test(img)) add(img, onde);
      }
    });
  }
  return mapa;
}

test("nenhuma imagem decorativa repetida em dois lugares do site", () => {
  const repetidas = [...usos()].filter(([img, onde]) => onde.length > 1 && !PERMITIDOS.has(img));
  assert.deepEqual(
    repetidas.map(([img, onde]) => `${img} → ${onde.join(", ")}`),
    [],
    "cada banner, card e ilustração precisa da própria imagem"
  );
});

test("foto de anúncio não vira decoração (atalhos, banners, cards institucionais)", () => {
  const fotosAnuncio = new Set([...MEDIA.matchAll(/`\$\{I\}\/(ube\/[^`]+)`/g)].map((m) => `/images/imoveis/${m[1]}`));
  assert.ok(fotosAnuncio.size > 10);
  const usadas = [...usos().keys()].filter((img) => fotosAnuncio.has(img));
  assert.deepEqual(usadas, []);
});
