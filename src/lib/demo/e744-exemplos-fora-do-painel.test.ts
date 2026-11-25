/*
  E744, varredura dos dados de exemplo no JavaScript do painel (família do E975/E980). Decisão do Gerente (16/11/2026):
  a vitrine pública com anúncios de exemplo é decisão do E131 e fica; o PAINEL logado não carrega anúncios de exemplo
  como conteúdo do painel. Texto inerte que nunca desenha fica, com a evidência registrada.
  O que a varredura achou depois do E980, e este teste trava:
   1. /dashboard/fechamento importava os 15 anúncios de exemplo inteiros (src/lib/properties.ts) para montar a
      candidatura fictícia do modo demonstração — a nona tela, que o E980 não cobriu. Vai pelo carregador (useExemplos).
   2. A linha de "Meus imóveis" importava o RÓTULO "Anúncio de exemplo" do arquivo dos proprietários de exemplo, e com
      ele iam os proprietários e as avaliações fictícias. O rótulo ganhou um arquivo só dele.
  Fica, por ser inerte ou por decisão (ver a descrição do PR): os caminhos das fotos dos exemplos em src/lib/media.ts, a
  resposta pública de /api/properties (Favoritos e Comparar) e a lista de exemplos de /admin/imoveis.
  Roda: node --test src/lib/demo/e744-exemplos-fora-do-painel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

const SRC = new URL("../../", import.meta.url).pathname;
const arquivos = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
const rel = (p: string) => p.slice(SRC.length);
const ler = (p: string) => readFileSync(join(SRC, p), "utf8");

/** Arquivos que importam (valor, não só tipo) o módulo `alvo` (caminho a partir de src, sem extensão). */
function importamValor(pastas: string[], alvo: string): string[] {
  const destino = join(SRC, alvo);
  return pastas
    .flatMap((p) => arquivos(join(SRC, p)))
    .filter((p) =>
      [...readFileSync(p, "utf8").matchAll(/^\s*(import|export)\s+(?!type\b)[^;]*?from\s*["']([^"']+)["']/gm)].some(([, , de]) => {
        const caminho = de.startsWith("@/") ? join(SRC, de.slice(2)) : de.startsWith(".") ? join(dirname(p), de) : "";
        return caminho.replace(/\.ts$/, "") === destino;
      }),
    )
    .map(rel);
}

// As telas e as peças do painel logado.
const PAINEL = ["app/(dashboard)", "components/dashboard", "components/account", "components/layout"];

test("nenhuma tela do painel importa os anúncios de exemplo (só /admin/imoveis, que lista os exemplos para o admin)", () => {
  assert.deepEqual(importamValor(PAINEL, "lib/properties"), ["app/(dashboard)/admin/imoveis/page.tsx"]);
});

test("nenhuma tela do painel importa os proprietários e as avaliações de exemplo", () => {
  assert.deepEqual(importamValor(PAINEL, "config/exemplo-proprietarios"), []);
});

test("o rótulo 'Anúncio de exemplo' tem arquivo próprio, sem dado fictício; o dos proprietários de exemplo o reexporta", async () => {
  const selo = ler("config/selo-exemplo.ts");
  assert.doesNotMatch(selo, /^\s*import\b/m, "o arquivo do rótulo não importa nada");
  const { SELO_EXEMPLO, AVISO_EXEMPLO } = await import("../../config/selo-exemplo.ts");
  const doArquivoAntigo = await import("../../config/exemplo-proprietarios.ts");
  assert.equal(SELO_EXEMPLO, "Anúncio de exemplo");
  assert.equal(doArquivoAntigo.SELO_EXEMPLO, SELO_EXEMPLO);
  assert.equal(doArquivoAntigo.AVISO_EXEMPLO, AVISO_EXEMPLO);
  assert.match(ler("components/dashboard/property-row.tsx"), /import \{ SELO_EXEMPLO \} from "@\/config\/selo-exemplo";/);
});

test("o Fechamento do modo demonstração vem do seed, pelo carregador; a tela não traz a candidatura fictícia", () => {
  const tela = ler("app/(dashboard)/dashboard/fechamento/closing-client.tsx");
  assert.match(tela, /const exemplos = useExemplos\(demo\);/);
  assert.match(tela, /exemplos\.DEMO_FECHAMENTO/);
  assert.doesNotMatch(tela, /Ana Carvalho|CTR-2026-0042|ube-001/);
  const seed = ler("lib/demo/seed.ts");
  assert.match(seed, /export const DEMO_FECHAMENTO: FechamentoContexto = \{/);
  assert.match(seed, /leadId: "demo"/);
});
