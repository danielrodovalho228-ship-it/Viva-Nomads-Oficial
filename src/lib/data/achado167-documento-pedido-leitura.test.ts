/*
  Achado 167 — (a) baixar o documento fiscal (/api/documentos/[id]) respondia 404 "Documento não encontrado." quando a LEITURA
  falhava; (b) conferir documento do imóvel (/api/documentos/conferir) respondia 404 "Imóvel não encontrado." idem;
  (c) o proprietário responder a um pedido de moradia lia "Pedido não está mais disponível." e "Imóvel não encontrado..."
  com o banco falhando (e perdia a chance). Agora a falha de leitura é 503/"tente de novo".
  Roda: node --test src/lib/data/achado167-documento-pedido-leitura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const docRota = ler("../../app/api/documentos/[id]/route.ts");
const conferirRota = ler("../../app/api/documentos/conferir/route.ts");
const pedidos = ler("./pedidos-actions.ts");

test("download do documento fiscal: falha de leitura é 503, não 404", () => {
  assert.match(docRota, /const \{ data: doc, error: erroDoc \} = await supabase\.from\("documentos_fiscais"\)/);
  assert.match(docRota, /if \(erroDoc\) return NextResponse\.json\(\{ error: "Não foi possível abrir o documento agora\. Tente de novo\." \}, \{ status: 503 \}\);\n\s*if \(!doc\) return NextResponse\.json\(\{ error: "Documento não encontrado\." \}, \{ status: 404 \}\);/);
});

test("conferir documento: a leitura do imóvel do dono com falha é 503, não 'Imóvel não encontrado'", () => {
  assert.match(conferirRota, /const \{ data: prop, error: erroProp \} = await supabase\.from\("properties"\)/);
  assert.match(conferirRota, /if \(erroProp\) return NextResponse\.json\(\{ error: "Não foi possível ler o imóvel agora\. Tente de novo\." \}, \{ status: 503 \}\);\n\s*if \(!prop\) return NextResponse\.json\(\{ error: "Imóvel não encontrado\." \}, \{ status: 404 \}\);/);
});

test("responder a um pedido: pedido e imóvel com falha de leitura dizem 'tente de novo'", () => {
  assert.match(pedidos, /const \{ data: pedido, error: erroPedido \} = await supabase\s*\.from\("pedidos_publicos"\)/);
  assert.match(pedidos, /if \(erroPedido\) return \{ ok: false, error: "Não foi possível ler o pedido agora\. Tente de novo\." \};\n\s*if \(!pedido\) return \{ ok: false, error: "Pedido não está mais disponível\." \};/);
  assert.match(pedidos, /const \{ data: imovel, error: erroImovel \} = await supabase\s*\.from\("properties"\)\s*\.select\("id, owner_id, status, max_guests, title, address, city"\)/);
  assert.match(pedidos, /if \(erroImovel\) return \{ ok: false, error: "Não foi possível ler o imóvel agora\. Tente de novo\." \};/);
});
