/*
  Cadastro confiável, parte B2: documentos do inquilino depois do aceite.
  Roda: node --test src/lib/documentos-inquilino.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { caminhoDocInquilino, DOCS_INQUILINO, documentosInquilinoCompletos, tipoDocValido } from "./documentos-inquilino.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("completos = identidade + (renda ou vínculo)", () => {
  assert.deepEqual(DOCS_INQUILINO.map((d) => d.tipo), ["identidade", "renda", "vinculo"]);
  assert.ok(documentosInquilinoCompletos(["identidade", "renda"]));
  assert.ok(documentosInquilinoCompletos(["vinculo", "identidade"]));
  assert.ok(!documentosInquilinoCompletos(["identidade"]));
  assert.ok(!documentosInquilinoCompletos(["renda", "vinculo"]));
  assert.ok(!documentosInquilinoCompletos([]));
  assert.ok(tipoDocValido("renda") && !tipoDocValido("selfie"));
  const id = "8f14e45f-ceea-467f-a0e5-1b2c3d4e5f60";
  assert.equal(caminhoDocInquilino(id, id, id, "pdf"), `${id}/${id}/${id}.pdf`);
});

test("envio: só o inquilino da candidatura ACEITA; tipo real, tamanho, limite; grava pelo servidor e troca o anterior", () => {
  const r = ler("app/api/upload/inquilino-doc/route.ts");
  assert.match(r, /if \(!lead \|\| lead\.tenant_id !== user\.id\) return NextResponse\.json\(\{ error: "Candidatura não encontrada\." \}, \{ status: 404 \}\);/);
  assert.match(r, /if \(lead\.status !== "accepted"\)/);
  assert.match(r, /consumirLimite\(`inq-doc:\$\{user\.id\}`, 20, DIA\)/);
  assert.match(r, /tipoRealPorMagicBytes\(bytes\)/);
  assert.match(r, /admin\.storage\.from\(BUCKET_DOCS_INQUILINO\)\.upload\(caminho, bytes/);
  assert.match(r, /onConflict: "lead_id,tipo"/);
  assert.doesNotMatch(r, /console\.(log|error)\([^)]*(file|bytes|caminho)/);
});

test("ver: inquilino, dono ou admin, só com candidatura aceita; link de 10 min; nunca o caminho na tela", () => {
  const a = ler("lib/data/documentos-inquilino-actions.ts");
  assert.match(a, /const parte = lead\.tenant_id === user\.id \|\| lead\.owner_id === user\.id \|\| \(await ehAdmin\(supabase, user\.id\)\);/);
  assert.match(a, /if \(!lead \|\| lead\.status !== "accepted"\) return null;/);
  assert.match(a, /const LINK_TTL = 60 \* 10;/);
  assert.match(a, /\.select\("tipo, enviado_em"\)/);
  assert.doesNotMatch(a.slice(a.indexOf("export async function listarDocsInquilino"), a.indexOf("export async function linkDocInquilino")), /caminho/);
});

test("contrato: fechamento e cobrança exigem os documentos (sem a 0093, não trava)", () => {
  const f = ler("lib/data/fechamento-servidor.ts");
  assert.match(f, /if \(\(await docsInquilinoCompletos\(admin, lead\.id as string\)\) === false\) return \{ status: 409, error: MSG_DOCS_INQUILINO \};/);
  assert.match(ler("lib/data/leads-actions.ts"), /else if \(\(await docsInquilinoCompletos\(admin, lead\.id as string\)\) === false\) documentoPendente = \{ quem: "inquilino", mensagem: MSG_DOCS_INQUILINO \};/);
  assert.match(ler("lib/data/documentos-inquilino-servidor.ts"), /return tipos === null \? null : documentosInquilinoCompletos\(tipos\);/);
  assert.match(ler("app/(dashboard)/dashboard/candidaturas/page.tsx"), /c\.situacao\.chave === "aceita" && \(\s*<div[^>]*>\s*<DocumentosInquilino leadId=\{c\.id\} modo="inquilino" \/>/);
  assert.match(ler("app/(dashboard)/dashboard/fechamento/closing-flow.tsx"), /<DocumentosInquilino leadId=\{ctx\.leadId\} modo="dono" \/>/);
});

test("0093: bucket privado sem política para o navegador; caminho e hash fora do grant; escrita só pelo servidor; registra-se", () => {
  const sql = ler("../supabase/migrations/0093_documentos_inquilino.sql");
  const codigo = sql.replace(/--.*$/gm, "");
  assert.doesNotMatch(codigo, /\bdrop\b/i);
  assert.match(codigo, /values \('inquilino-docs', 'inquilino-docs', false, 10485760/);
  assert.doesNotMatch(codigo, /storage\.objects/); // nenhuma política de storage: só o service role
  assert.match(codigo, /revoke all on public\.documentos_inquilino from public, anon, authenticated;/);
  assert.match(codigo, /grant select \(id, lead_id, tenant_id, tipo, enviado_em\) on public\.documentos_inquilino to authenticated;/);
  assert.match(codigo, /unique \(lead_id, tipo\)/);
  const aplicar = ler("../supabase/producao/aplicar-0093.sql");
  assert.match(aplicar, /^begin;$/m);
  assert.match(aplicar, /'0093_documentos_inquilino'/);
  assert.match(aplicar, /where not exists \(select 1 from supabase_migrations\.schema_migrations where version = '20261008000093'\)/);
});
