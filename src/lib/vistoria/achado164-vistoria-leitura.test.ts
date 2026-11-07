/*
  Achado 164 — vistoria: credenciar/descredenciar avaliador, abrir avaliação de teste, abrir laudo de nova versão e baixar o
  PDF do laudo liam sem olhar o erro: com o banco falhando diziam "Credenciamento não encontrado.", "Imóvel não encontrado.",
  "O avaliador precisa estar em teste.", "Pedido não encontrado." e o PDF dava 404 "Não encontrado.". Agora a falha de
  leitura tem frase própria (e o PDF responde 503, não 404).
  Roda: node --test src/lib/vistoria/achado164-vistoria-leitura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const acoes = ler("./actions.ts");
const laudoActions = ler("./laudo-actions.ts");
const laudoServidor = ler("./laudo-servidor.ts");
const rota = ler("../../app/api/vistoria/laudo/[id]/route.ts");

test("credenciamento e avaliação de teste: a falha de leitura tem frase própria antes de 'não encontrado'", () => {
  assert.match(acoes, /const \{ data: c, error: erroCred \} = await a\.admin\.from\("avaliadores_credenciamento"\)\.select\("status, user_id, parceiro_id, solicitacao_id"\)/);
  assert.match(acoes, /if \(erroCred\) return \{ ok: false, erro: "Não foi possível ler o credenciamento agora\. Tente de novo\." \};\n\s*if \(!c\) return \{ ok: false, erro: "Credenciamento não encontrado\." \};/);
  assert.match(acoes, /const \{ data: c, error: erroAval \} = await a\.admin\.from\("avaliadores_credenciamento"\)\.select\("status, parceiros\(user_id\)"\)/);
  assert.match(acoes, /const \{ data: im, error: erroIm \} = await a\.admin\.from\("properties"\)\.select\("id, owner_id, city, bedrooms"\)/);
  assert.match(acoes, /const \{ data: dono, error: erroDono \} = im \? await a\.admin\.from\("profiles"\)\.select\("is_teste"\)/);
  assert.match(acoes, /if \(erroAval \|\| erroIm \|\| erroDono\) return \{ ok: false, erro: "Não foi possível ler os dados da avaliação agora\. Tente de novo\." \};/);
});

test("laudo: imóvel e pedido original com falha de leitura dizem 'tente de novo'", () => {
  assert.match(laudoActions, /const \{ data: im, error: erroIm \} = await a\.admin\.from\("properties"\)\.select\("id, owner_id, city, bedrooms"\)/);
  assert.match(laudoActions, /if \(erroIm\) return \{ ok: false, erro: "Não foi possível ler o imóvel agora\. Tente de novo\." \};\n\s*if \(!im\) return \{ ok: false, erro: "Imóvel não encontrado\." \};/);
  assert.match(laudoServidor, /const \{ data: orig, error: erroOrig \} = await admin\.from\("vistoria_pedidos"\)/);
  assert.match(laudoServidor, /if \(erroOrig\) return \{ ok: false, erro: "Não foi possível ler o pedido agora\. Tente de novo\." \};\n\s*if \(!orig\) return \{ ok: false, erro: "Pedido não encontrado\." \};/);
});

test("PDF do laudo: falha de leitura/download é 503 (não 404 'não encontrado')", () => {
  assert.match(rota, /const \{ data: l, error: erroLaudo \} = await supabase\.from\("vistoria_laudos"\)/);
  assert.match(rota, /if \(erroLaudo\) return NextResponse\.json\(\{ error: "Não foi possível abrir o laudo agora\. Tente de novo\." \}, \{ status: 503 \}\);/);
  assert.match(rota, /const \{ data: arq, error: erroArquivo \} = await admin\.storage/);
  assert.match(rota, /if \(erroArquivo\) return NextResponse\.json\(\{ error: "Não foi possível abrir o laudo agora\. Tente de novo\." \}, \{ status: 503 \}\);/);
});
