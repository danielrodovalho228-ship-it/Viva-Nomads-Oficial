/*
  Frente 0 (11/11/2026) — o .next do laboratório é construído UMA vez (job construir) e reaproveitado pelas fatias.
  As páginas pré-renderizadas no build (home, /buscar, /cidades, /imoveis… com revalidate, e as estáticas) foram geradas
  com o banco do job de build, que não é o banco da fatia (cada fatia sobe o seu Supabase e cria as suas personas e
  imóveis). Antes de subir o `next start`, a fatia apaga essa saída pré-renderizada e o route-cache: o servidor gera cada
  página na primeira visita, com o banco DELA — o mesmo efeito do build por fatia de antes.

  Provado em next 16.4.2 (app mínimo, MARCA=build no build e MARCA=shard no start): com a saída do prerender e o
  route-cache, a página mostra "build"; sem eles, mostra "shard" com status 200, tanto a página com revalidate quanto a
  estática; e a página dinâmica não muda. Ver docs/e744-frente0-regressoes.md.

  Uso: node scripts/lab/limpar-prerender.mjs [pasta-do-.next]   (padrão: .next)
*/
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const EXTENSOES = [".html", ".rsc", ".meta", ".body", ".segments"];

/** Caminhos a apagar para cada rota do prerender-manifest (sem tocar no código das páginas). */
export function caminhosDoPrerender(manifesto, pastaNext = ".next") {
  const saida = [];
  for (const rota of Object.keys(manifesto?.routes ?? {})) {
    const base = join(pastaNext, "server", "app", rota === "/" ? "index" : rota.replace(/^\//, ""));
    for (const ext of EXTENSOES) saida.push(base + ext);
  }
  saida.push(join(pastaNext, "server", "route-cache"));
  return saida;
}

function principal() {
  const pastaNext = process.argv[2] ?? ".next";
  const arq = join(pastaNext, "prerender-manifest.json");
  if (!existsSync(arq)) {
    console.error(`::error::sem ${arq}: o .next do job construir não chegou à fatia.`);
    process.exit(1);
  }
  const manifesto = JSON.parse(readFileSync(arq, "utf8"));
  let apagados = 0;
  for (const p of caminhosDoPrerender(manifesto, pastaNext)) {
    if (existsSync(p)) {
      rmSync(p, { recursive: true, force: true });
      apagados++;
    }
  }
  console.log(`${Object.keys(manifesto.routes ?? {}).length} rota(s) pré-renderizada(s); ${apagados} arquivo(s)/pasta(s) apagados: as páginas saem do banco desta fatia.`);
}

if (import.meta.url === `file://${process.argv[1]}`) principal();
