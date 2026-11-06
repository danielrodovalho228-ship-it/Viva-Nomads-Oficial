/*
  E477 (ADMIN — controles de escrita habilitados para a conta observadora). A varredura sistemática das telas do admin (arquivos que chamam ação de servidor de
  escrita e não tinham nenhum tratamento de "somente leitura") achou três telas que ainda ofereciam a ação ao observador (qa_admin) E cujas ações não o recusavam:
   • Imóveis › Vídeos por link para conferir (decidirLinkDeVideo: aprovar/recusar o tour do anúncio);
   • Contratos › Encerramentos (atualizarPedidoEncerramento: conduzir/CONCLUIR, que encerra o contrato REAL e emite o documento de encerramento);
   • Serviços (atualizarEstadoPedidoServico: muda o estado do pedido de serviço do morador).
  As outras telas citadas no achado (Pendências, Fotos de perfil, Documentos, Anúncios, Atendimento, Cidades, Destinos, Marketing, Qualidade) já tratam o observador.
  Regra (a mesma das outras ações): dado real é só leitura para o observador; dado de TESTE segue liberado (por isso o alvo do vídeo é o anúncio).
  Roda: node --test src/lib/data/e477-admin-escrita-restante.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const ESCRITA = /\.(insert|update|upsert|delete)\(|logModeracao\(|revalidatePath\(/;
const corpo = (src: string, fn: string) => {
  const i = src.search(new RegExp(`export async function ${fn}\\b`));
  assert.ok(i >= 0, `${fn} existe`);
  return src.slice(i, src.indexOf("\n}\n", i));
};

const ACOES: [string, string, RegExp][] = [
  ["src/lib/data/video-link-actions.ts", "decidirLinkDeVideo", /recusaObservador\([a-z.]*uid, \{ imoveis: \[propertyId\] \}\)/],
  ["src/lib/data/estadia-actions.ts", "atualizarPedidoEncerramento", /recusaObservador\(user\.id\)/],
  ["src/lib/data/servicos-morador-actions.ts", "atualizarEstadoPedidoServico", /recusaObservador\(user\.id\)/],
];
for (const [arquivo, fn, chamada] of ACOES) {
  test(`${fn}: recusa a conta observadora antes da primeira escrita`, () => {
    const src = ler(arquivo);
    assert.match(src, /import \{ recusaObservador \} from "@\/lib\/qa\/observador";/);
    const c = corpo(src, fn);
    assert.match(c, chamada);
    const g = c.indexOf("recusaObservador(");
    const e = c.search(ESCRITA);
    assert.ok(e < 0 || g < e, "a guarda vem antes da primeira escrita");
    assert.match(c, /if \(recusaQa\) return \{ ok: false, (erro|error): recusaQa \};/);
  });
}

test("Encerramentos e Serviços: o observador vê 'Só leitura' no lugar dos botões", () => {
  for (const [p, comp] of [["src/app/(dashboard)/admin/contratos/encerramentos/page.tsx", "AcoesEncerramento"], ["src/app/(dashboard)/admin/servicos/page.tsx", "MudarEstado"]] as const) {
    const s = ler(p);
    assert.match(s, /import \{ soLeituraNaTela \} from "@\/lib\/qa\/observador";/, p);
    assert.match(s, /import \{ SoLeituraQa \} from "@\/components\/admin\/so-leitura-qa";/, p);
    assert.match(s, /const soLeitura = \(await soLeituraNaTela\(\[\{ id: "configuracao" \}\]\)\)\.length > 0;/, p);
    assert.match(s, new RegExp(`soLeitura \\? <SoLeituraQa /> : [^\\n]*<${comp} `), `${p}: ${comp} só sem soLeitura`);
  }
});

test("Vídeos por link: o observador vê 'Só leitura' nos anúncios que não são de teste; o componente respeita", () => {
  const pg = ler("src/app/(dashboard)/admin/imoveis/page.tsx");
  assert.match(pg, /soLeituraNaTela\(linksVideo\??\.map\(\(l\) => \(\{ id: l\.propertyId, alvo: \{ imoveis: \[l\.propertyId\] \} \}\)\)/);
  assert.match(pg, /<LinksDeVideoPendentes links=\{linksVideo\} soLeitura=\{/);
  const c = ler("src/app/(dashboard)/admin/imoveis/links-de-video.tsx");
  assert.match(c, /import \{ SoLeituraQa \} from "@\/components\/admin\/so-leitura-qa";/);
  assert.match(c, /soLeitura\.has\(l\.propertyId\) \? <SoLeituraQa \/> : \(/);
});
