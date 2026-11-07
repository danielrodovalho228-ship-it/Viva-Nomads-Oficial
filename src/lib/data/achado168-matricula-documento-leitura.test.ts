/*
  Achado 168 — admin: decidir a matrícula do imóvel (aprovar/recusar) lia "Matrícula não encontrada." e reenviar um documento
  fiscal lia "documento não encontrado" quando a LEITURA falhava (o admin achava que o registro tinha sumido). Agora a falha
  de leitura tem frase própria. Roda: node --test src/lib/data/achado168-matricula-documento-leitura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const matriculas = ler("./matriculas-admin.ts");
const emitir = ler("../fiscal/emitir.ts");

test("matrícula: a leitura da conferência destrincha o erro antes de 'Matrícula não encontrada'", () => {
  assert.match(matriculas, /const \{ data: alvo, error: erroAlvo \} = await admin\s*\.from\("property_ownership_checks"\)/);
  assert.match(matriculas, /if \(erroAlvo\) return \{ ok: false, error: "Não foi possível ler a matrícula agora\. Tente de novo\." \};\n\s*if \(!alvo\) return \{ ok: false, error: "Matrícula não encontrada\." \};/);
});

test("documento fiscal: o reenvio diz 'falha ao ler' antes de 'documento não encontrado'", () => {
  assert.match(emitir, /const \{ data: d, error: erroDocumento \} = await admin\s*\.from\("documentos_fiscais"\)/);
  assert.match(emitir, /if \(erroDocumento\) return \{ ok: false, motivo: "falha ao ler o documento" \};\n\s*if \(!d\) return \{ ok: false, motivo: "documento não encontrado" \};/);
});
