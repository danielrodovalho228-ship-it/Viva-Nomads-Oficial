/*
  Guarda do Prompt 48 em src/ inteiro: carregamento com a geometria real e estado vazio com próximo passo.
    - nenhum spinner solto em área de conteúdo: Loader2 girando só dentro de botão ou ao lado de uma ação que a
      pessoa acabou de disparar (envio de foto, IA escrevendo) — carregar dados é esqueleto;
    - todo <EmptyState> tem `action`; nenhum usa ilustração;
    - as rotas pesadas têm loading.tsx com o esqueleto delas;
    - as filas do admin vazias dizem "Nada pendente." com a data da última decisão.
  Roda: node --test src/lib/estilo/estados-vazios.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = new URL("../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(SRC, p), "utf8");

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.tsx$/.test(n) ? [p] : [];
  });
}
const TSX = arquivos(SRC).map((p) => ({ rel: relative(SRC, p), src: readFileSync(p, "utf8") }));

/** Spinner de progresso de uma ação que a pessoa disparou — não é carregamento de conteúdo. */
const SPINNER_DE_ACAO = new Set([
  "components/ajuda/viva-chat.tsx", // "A Viva está escrevendo…"
  "app/(dashboard)/dashboard/imoveis/novo/cartao-ia.tsx", // a IA preenchendo o anúncio depois do clique
  "app/(dashboard)/dashboard/imoveis/novo/barra-fotos.tsx", // envio das fotos escolhidas
  "app/(dashboard)/dashboard/imoveis/novo/etapa-fotos.tsx", // envio das fotos escolhidas
  "components/photo-uploader.tsx", // miniatura da foto sendo enviada
]);

test("nenhum spinner solto em área de conteúdo (src inteiro)", () => {
  const solto = /<(p|div|section)\b[^>]*>\s*<Loader2[^>]*animate-spin/;
  const achados = TSX.filter((f) => solto.test(f.src) && !SPINNER_DE_ACAO.has(f.rel)).map((f) => f.rel);
  assert.deepEqual(achados, [], `troque por esqueleto (components/ui/skeleton): ${achados.join(", ")}`);
});

test("todo EmptyState tem um próximo passo e nenhum usa ilustração (src inteiro)", () => {
  const semAcao: string[] = [];
  const comIlustracao: string[] = [];
  for (const f of TSX) {
    if (f.rel === "components/dashboard/primitives.tsx") continue;
    for (const m of f.src.matchAll(/<EmptyState\b[\s\S]*?\/>(?=\s*[\n)}:])/g)) {
      if (!/\baction=/.test(m[0])) semAcao.push(f.rel);
      if (/\billustration=/.test(m[0])) comIlustracao.push(f.rel);
    }
  }
  assert.deepEqual(semAcao, [], "EmptyState sem action");
  assert.deepEqual(comIlustracao, [], "EmptyState com ilustração");
  const prim = ler("components/dashboard/primitives.tsx");
  const bloco = prim.slice(prim.indexOf("export function EmptyState"), prim.indexOf("export function FilaVazia"));
  assert.match(bloco, /action: React\.ReactNode;/, "action obrigatório no tipo");
  assert.doesNotMatch(bloco, /illustration/);
});

test("rotas com esqueleto próprio na geometria da tela", () => {
  const rotas: Record<string, RegExp> = {
    "app/(public)/buscar/loading.tsx": /SkeletonGradeCartoes/,
    "app/(public)/imoveis/[id]/loading.tsx": /SkeletonDetalheImovel/,
    "app/(dashboard)/dashboard/loading.tsx": /SkeletonLista/,
    "app/(dashboard)/dashboard/mensagens/loading.tsx": /SkeletonMensagens/,
    "app/(dashboard)/admin/loading.tsx": /SkeletonAdmin/,
  };
  for (const [rota, re] of Object.entries(rotas)) {
    assert.ok(existsSync(join(SRC, rota)), `${rota} existe`);
    assert.match(ler(rota), re, rota);
  }
  const sk = ler("components/ui/skeleton.tsx");
  for (const nome of ["SkeletonCartao", "SkeletonDetalheImovel", "SkeletonTabela", "SkeletonMensagens", "SkeletonCalendario", "SkeletonLinhas"]) {
    assert.match(sk, new RegExp(`export function ${nome}\\b`), nome);
  }
  assert.doesNotMatch(sk, /animate-spin/, "esqueleto pulsa, não gira");
});

test("estados vazios pedidos no Prompt 48 têm o próximo passo certo", () => {
  const busca = ler("app/(public)/buscar/search-client.tsx");
  assert.match(busca, /data-testid="busca-vazia"/);
  assert.match(busca, /busca-vazia-pedido/, "pedido de moradia");
  assert.match(busca, /Limpar filtros/);
  assert.match(busca, /Criar alerta desta busca/);
  // Favoritos vazio → buscar (o bloco de onboarding do 43, com o próximo passo de lib/onboarding/vazios.ts).
  assert.match(ler("app/(dashboard)/dashboard/favoritos/page.tsx"), /VAZIOS_ONBOARDING\.favoritos/);
  assert.match(readFileSync(join(SRC, "lib/onboarding/vazios.ts"), "utf8"), /favoritos:[\s\S]*?href: "\/buscar"/);
  const msg = ler("app/(dashboard)/dashboard/mensagens/messages-client.tsx");
  assert.match(msg, /mensagens-vazio/);
  assert.match(msg, /Como funciona a conversa/);
  const imoveis = ler("app/(dashboard)/dashboard/imoveis/imoveis-client.tsx");
  assert.match(imoveis, /href="\/dashboard\/imoveis\/novo"/, "painel sem imóvel → anunciar");
});

test("filas do admin vazias: 'Nada pendente.' com a data da última decisão", () => {
  const prim = ler("components/dashboard/primitives.tsx");
  const fila = prim.slice(prim.indexOf("export function FilaVazia"));
  assert.match(fila, /Nada pendente\./);
  assert.match(fila, /Última decisão em/);
  assert.match(fila, /America\/Sao_Paulo/);
  for (const [arq, prop] of [
    ["app/(dashboard)/admin/documentos/admin-documentos-client.tsx", /<FilaVazia ultimaDecisao=\{ultimaDecisao\}/],
    ["app/(dashboard)/admin/documentos/matriculas-admin-client.tsx", /<FilaVazia ultimaDecisao=\{ultimaDecisao\}/],
    ["app/(dashboard)/admin/atendimento/atendimento-client.tsx", /<FilaVazia ultimaDecisao=\{ultimaDecisao\}/],
    ["app/(dashboard)/admin/parceiros/page.tsx", /<FilaVazia ultimaDecisao=\{ultimaDecisaoParceria\}/],
  ] as const) {
    assert.match(ler(arq), prop, arq);
  }
  const pagina = ler("app/(dashboard)/admin/documentos/page.tsx");
  assert.match(pagina, /document_reviewed_at/);
  assert.match(pagina, /revisado_em/);
});
