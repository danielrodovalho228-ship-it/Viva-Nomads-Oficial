/*
  Varredura ampliada — conferência automática do documento do imóvel (/api/documentos/conferir) (médio): três
  leituras que alimentam a DECISÃO não conferiam o erro:
   - a contagem de duplicado (o mesmo documento já usado por OUTRA conta): na falha, null → 0 → um documento reusado
     passava pela trava antifraude;
   - o perfil (nome, CPF/CNPJ) e o laudo CAF mais recente: na falha, a comparação era feita com dados vazios.
  Agora qualquer uma delas que falha responde 503 "tente de novo" ANTES da leitura do documento (que tem custo) e sem
  gravar a tentativa. Nenhuma regra de decisão muda: só não se decide sobre o que não foi lido.
  Roda: node --test src/lib/documento/residuo-conferir-documento.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const r = readFileSync(new URL("../../app/api/documentos/conferir/route.ts", import.meta.url), "utf8");

test("duplicado e perfil não lidos → 503 antes da leitura do documento", () => {
  assert.match(r, /const \{ count: duplicado, error: erroDuplicado \} = await admin/);
  assert.match(r, /const \{ data: perfil, error: erroPerfil \} = await admin\.from\("profiles"\)/);
  const guarda = r.indexOf("if (erroDuplicado || erroPerfil) return NextResponse.json({ error: MSG_CONFERIR_SEM_LEITURA }, { status: 503 });");
  assert.ok(guarda > 0 && guarda < r.indexOf("await lerDocumento("), "antes da leitura (custo)");
});

test("laudo CAF não lido → 503 antes de decidir a matrícula", () => {
  assert.match(r, /const \{ data: laudo, error: erroLaudo \} = await admin\s*\.from\("tenant_verifications"\)/);
  const g = r.indexOf("if (erroLaudo) return NextResponse.json({ error: MSG_CONFERIR_SEM_LEITURA }, { status: 503 });");
  assert.ok(g > 0 && g < r.indexOf("decidirMatricula("));
});

test("a qualificação anterior não lida → 503 (a linha nova não nasce sem as respostas do dono)", () => {
  assert.match(r, /if \(error\) throw new Error\("Não foi possível ler a qualificação anterior\."\);/);
  const g = r.indexOf('if (anterior === "falhou") return NextResponse.json({ error: MSG_CONFERIR_SEM_LEITURA }, { status: 503 });');
  assert.ok(g > 0 && g < r.indexOf("const gravarQualificacao"));
});
