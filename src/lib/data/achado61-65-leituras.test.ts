/*
  Varredura de erros (rodada 9) — as 5 leituras que restavam: falha nunca vira "pendente", "nenhuma", "Nenhum ainda",
  sugestão repetida nem filtro vazio calado.
  61 meusDegraus · 62 respostasDaConversaDoImovel · 63 listConferidosAutomaticamente · 64 comodidadesDoMeuImovel ·
  65 cidadesComAnuncio.
  Roda: node --test src/lib/data/achado61-65-leituras.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const lanca = (arquivo: string, fn: string) => {
  const s = ler(arquivo);
  const corpo = s.slice(s.indexOf(`export async function ${fn}`));
  assert.match(corpo.slice(0, corpo.indexOf("\n}\n")), /if \(error\) throw new Error/, `${fn} lança na falha`);
};

test("achado 61: degraus do perfil — lança e avisa com Tentar de novo (nunca tudo 'pendente')", () => {
  lanca("src/lib/data/papeis-actions.ts", "meusDegraus");
  const t = ler("src/components/account/degraus-perfil.tsx");
  assert.match(t, /\.catch\(\(\) => vivo && setFalhou\(true\)\)/);
  assert.match(t, /data-testid="degraus-perfil-tentar"/);
});

test("achado 62: respostas rápidas da conversa — lança e avisa (nunca 'nenhuma resposta salva')", () => {
  lanca("src/lib/data/respostas-actions.ts", "respostasDaConversaDoImovel");
  assert.match(ler("src/lib/data/respostas-actions.ts"), /minhasRespostas\(\{ exigir: true \}\)/);
  const t = ler("src/components/mensagens/respostas-rapidas-conversa.tsx");
  assert.doesNotMatch(t, /setLista\(\{ propertyId, itens: \[\] \}\)/);
  assert.match(t, /data-testid="respostas-rapidas-falha"/);
  assert.match(t, /data-testid="respostas-rapidas-tentar"/);
});

test("achado 63: conferidos automaticamente — lança; a aba avisa e a fila de revisão continua", () => {
  lanca("src/lib/data/documentos-admin.ts", "listConferidosAutomaticamente");
  const p = ler("src/app/(dashboard)/admin/documentos/page.tsx");
  assert.match(p, /listConferidosAutomaticamente\(\)\.catch\(\(\) => null\)/);
  assert.match(p, /autoFalhou=\{auto === null\}/);
  assert.match(ler("src/app/(dashboard)/admin/documentos/admin-documentos-client.tsx"), /data-testid="conferidos-automaticamente-falha"/);
});

test("achado 64: comodidades do anúncio — lança; sem elas, as sugestões não aparecem (aviso)", () => {
  lanca("src/lib/data/comodidade-sugerida-actions.ts", "comodidadesDoMeuImovel");
  const p = ler("src/app/(dashboard)/dashboard/imoveis/[id]/nivel/page.tsx");
  assert.match(p, /comodidadesDoMeuImovel\(id\)\.catch\(\(\) => null\)/);
  assert.match(p, /data-testid="sugestoes-nivel-falha"/);
});

test("achado 65: cidades do filtro — lança; funil e financeiro avisam sem cair", () => {
  lanca("src/lib/data/admin-visao-geral.ts", "cidadesComAnuncio");
  const f = ler("src/app/(dashboard)/admin/funil/page.tsx");
  assert.match(f, /cidadesComAnuncio\(\)\.catch\(\(\) => null\)/);
  assert.match(f, /data-testid="filtro-cidades-falha"/);
  assert.match(ler("src/app/(dashboard)/admin/financeiro/page.tsx"), /cidadesComAnuncio\(\)\.catch\(falhou\(/);
});
