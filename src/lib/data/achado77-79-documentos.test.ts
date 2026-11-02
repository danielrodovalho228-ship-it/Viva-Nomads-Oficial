/*
  Varredura de erros e estados vazios (rodada 14) — leitura que falha nunca vira documento incompleto nem "não encontrado".
  Achado 77: carregarProvas engolia o erro de 8 leituras → o PACOTE DE PROVAS (documento registrado, PRV) saía sem
             assinaturas, pagamentos, conferências ou aditivos.
  Achado 78: getContratoParaAssinar engolia o erro → a página do contrato dava 404 ("não encontrado") para a parte.
  Achado 79: servicosConcluidosDoParceiro engolia o erro → resumo anual do parceiro (PDF) com zero serviços e o bloco
             "Recibos e notas" vazio.
  Roda: node --test src/lib/data/achado77-79-documentos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("achado 77: pacote de provas lança na falha de qualquer leitura; a rota responde 503 e não registra nada", () => {
  const s = ler("src/lib/data/contrato-provas.ts");
  assert.match(s, /if \(e1 \|\| e2 \|\| e3 \|\| e4 \|\| e5\) throw new Error\(MSG_PROVAS_SEM_LEITURA\);/);
  assert.match(s, /if \(e6 \|\| e7 \|\| e8\) throw new Error\(MSG_PROVAS_SEM_LEITURA\);/);
  // A leitura vem antes de montar o PDF.
  assert.ok(s.indexOf("if (e6 || e7 || e8)") < s.indexOf("return montarDadosProvas("));
  const rota = ler("src/app/api/contrato/[id]/provas/route.ts");
  assert.match(rota, /carregarProvas\(id\)\.catch\(\(\) => "falhou" as const\);\s*if \(dados === "falhou"\) return NextResponse\.json\([^)]*\{ status: 503 \}\);/);
  assert.ok(rota.indexOf('dados === "falhou"') < rota.indexOf("gerarPacoteProvasRegistrado("));
});

test("achado 78: getContratoParaAssinar lança na falha (a página mostra o erro), nunca 404", () => {
  const s = ler("src/lib/data/contrato-assinar-actions.ts");
  const fn = s.slice(s.indexOf("export async function getContratoParaAssinar"), s.indexOf("export interface ContratoParaEquipe"));
  assert.match(fn, /const \{ data, error \} = await supabase\.from\("contratos"\)\.select\(COLUNAS\)/);
  assert.match(fn, /if \(error\) throw new Error\("Não foi possível ler o contrato agora\."\);\s*if \(!data\) return null;/);
});

test("achado 79: serviços do parceiro lançam na falha; o PDF anual responde 503 e o bloco avisa", () => {
  const s = ler("src/lib/data/recibos.ts");
  const fn = s.slice(s.indexOf("export async function servicosConcluidosDoParceiro"));
  assert.match(fn, /if \(erroParc\) throw new Error\(MSG_SERVICOS_SEM_LEITURA\);/);
  assert.match(fn, /if \(error\) throw new Error\(MSG_SERVICOS_SEM_LEITURA\);/);
  const rota = ler("src/app/api/recibos/[relatorio]/route.ts");
  assert.match(rota, /servicosConcluidosDoParceiro\(\)\.catch\(\(\) => "falhou" as const\);\s*if \(p === "falhou"\) return erro\(503,/);
  const bloco = ler("src/components/recibos/blocos-recibos.tsx");
  assert.match(bloco, /data-testid="recibos-parceiro-falha"/);
});
