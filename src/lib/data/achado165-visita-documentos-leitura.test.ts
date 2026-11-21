/*
  Achado 165 — (a) responder a um pedido de visita por vídeo/presencial (aceitar, recusar, remarcar, cancelar) lia o pedido
  sem olhar o erro: com o banco falhando, dono e morador liam "Pedido não encontrado."; (b) o admin emitindo de novo um
  documento com falha lia "Item não encontrado." pelo mesmo motivo. Agora a falha de leitura tem frase própria.
  Roda: node --test src/lib/data/achado165-visita-documentos-leitura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const visitas = readFileSync(new URL("./visitas-video-actions.ts", import.meta.url), "utf8");
const falhas = readFileSync(new URL("./documentos-falhas-actions.ts", import.meta.url), "utf8");

test("visita: a leitura do pedido destrincha o erro e diz 'tente de novo' antes de 'Pedido não encontrado'", () => {
  assert.match(visitas, /const \{ data: v, error: erroPedido \} = await admin\s*\.from\("visitas_video"\)/);
  assert.match(visitas, /if \(erroPedido\) return \{ ok: false, error: "Não foi possível ler o pedido agora\. Tente de novo\." \};\n\s*if \(!v\) return \{ ok: false, error: "Pedido não encontrado\." \};/);
});

test("documentos com falha: a leitura do item diz 'tente de novo' antes de 'Item não encontrado'", () => {
  assert.match(falhas, /const \{ data: f, error: erroFalha \} = await c\.admin\.from\("documentos_falhas"\)\.select\("pagamento_id, acerto_id, etapa"\)/);
  assert.match(falhas, /if \(erroFalha\) return \{ ok: false, error: "Não foi possível ler o item agora\. Tente de novo\." \};\n\s*if \(!f\) return \{ ok: false, error: "Item não encontrado\." \};/);
});
