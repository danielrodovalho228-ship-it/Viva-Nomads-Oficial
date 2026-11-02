/*
  Varredura de erros e estados vazios (rodada 16) — leitura que falha nunca congela a taxa errada nem libera prova repetida.
  Achado 83: faixasVigentes/taxaDoDonoAgora engoliam o erro → faixas PADRÃO, 0 imóveis ativos, sem fixação do admin →
             a taxa congelada no aceite da candidatura, no envio e no aceite da proposta e no aditivo saía errada.
  Achado 84: fotoJaUsada engolia o erro → "foto nova" → a prova repetida passava na trava antifraude.
  Achado 85: capturaPeloToken engolia o erro → "foto não feita na hora / link inválido" (403) com o link válido.
  Roda: node --test src/lib/cobranca/achado83-85.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("achado 83: a taxa do dono lança na falha; os quatro pontos que congelam a taxa recusam com o aviso", () => {
  const t = ler("src/lib/cobranca/taxa-servidor.ts");
  assert.match(t, /if \(error\) throw new Error\(MSG_TAXA_SEM_LEITURA\);/);
  assert.match(t, /if \(e1 \|\| e2 \|\| e3\) throw new Error\(MSG_TAXA_SEM_LEITURA\);/);
  assert.doesNotMatch(t.slice(t.indexOf("export async function faixasVigentes"), t.indexOf("export async function taxaDoDonoAgora")), /catch \{/);
  assert.match(ler("src/lib/data/leads-actions.ts"), /if \(!t\) return \{ ok: false, error: MSG_TAXA_SEM_LEITURA \};/);
  const p = ler("src/lib/data/propostas-actions.ts");
  assert.match(p, /if \(!taxaEnvio\) return \{ ok: false, error: MSG_TAXA_SEM_LEITURA \};/);
  assert.ok(p.indexOf("if (!taxaEnvio)") < p.indexOf('rpc("next_document_number", { p_type: "orcamento"'), "a taxa é lida antes de numerar");
  assert.match(p, /if \(!hoje\) return \{ ok: false, error: MSG_TAXA_SEM_LEITURA \};/);
  assert.match(ler("src/lib/data/estadia-actions.ts"), /if \(!faixa\) return \{ ok: false, erro: MSG_TAXA_SEM_LEITURA \};/);
});

test("achados 84 e 85: prova pela câmera — falha de leitura = 503 / 'tente de novo', nunca 'foto nova' nem 'sem token'", () => {
  const s = ler("src/lib/niveis/prova-servidor.ts");
  assert.match(s, /if \(galeria\.error \|\| provas\.error \|\| capturas\.error\) throw new Error\(MSG_PROVA_SEM_LEITURA\);/);
  assert.match(s, /if \(error\) throw new Error\(MSG_PROVA_SEM_LEITURA\);/);
  const r = ler("src/app/api/upload/prova/route.ts");
  assert.match(r, /if \(captura === "falhou"\) return NextResponse\.json\(\{ error: MSG_PROVA_SEM_LEITURA \}, \{ status: 503 \}\);/);
  assert.ok(r.indexOf('repetida === "falhou"') < r.indexOf(".storage.from(BUCKET).upload("), "confere antes de subir a foto");
});
