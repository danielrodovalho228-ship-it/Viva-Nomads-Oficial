/*
  E392 (E365-bis) — o comprovante de vínculo fica BEM ESCONDIDO enquanto a chave TRIAGEM_VINCULO_ATIVA está desligada:
  nenhum link morto para o vínculo na candidatura, na proposta, na Conta ou no Perfil; a rota de envio responde 404 (antes de
  ler sessão ou corpo); toda ação do servidor devolve "indisponível"; nenhuma tela promete uma verificação que ainda não
  existe. A prova completa do vínculo vai para a Onda 6, com a Certta (parecer do item 13) — aqui é só a guarda de que,
  desligada, nada aparece. O laboratório liga a triagem só pelo cookie, e só com INTEGRACOES_SIMULADAS (nunca em produção).
  Roda: node --test src/lib/triagem/e392-vinculo-escondido.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = new URL("../../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");

function arquivos(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(join(RAIZ, dir))) {
    const rel = `${dir}/${nome}`;
    if (statSync(join(RAIZ, rel)).isDirectory()) arquivos(rel, acc);
    else if (/\.(tsx|ts)$/.test(nome) && !/\.test\./.test(nome)) acc.push(rel);
  }
  return acc;
}

test("a chave nasce desligada e o laboratório só a liga pelo cookie, só com integrações simuladas", () => {
  assert.match(ler("src/lib/flags.ts"), /export const TRIAGEM_VINCULO_ATIVA = process\.env\.NEXT_PUBLIC_TRIAGEM_VINCULO_ATIVA === "on";/);
  const chave = ler("src/lib/triagem/chave.ts");
  assert.match(chave, /if \(TRIAGEM_VINCULO_ATIVA\) return true;\s*\n\s*if \(!integracoesSimuladas\(\)\) return false;/);
  assert.match(chave, /\(await cookies\(\)\)\.get\(COOKIE_LAB_TRIAGEM\)\?\.value === "1"/);
  assert.match(chave, /\} catch \{\s*\n\s*return false;/);
});

test("a rota de envio responde 404 com a chave desligada, antes de ler sessão, banco ou corpo", () => {
  const r = ler("src/app/api/upload/triagem-vinculo/route.ts");
  const corpo = r.slice(r.indexOf("export async function POST"));
  assert.match(corpo, /if \(!\(await triagemVinculoAtiva\(\)\)\) return NextResponse\.json\(\{ error: "Não encontrado\." \}, \{ status: 404 \}\);/);
  const guarda = corpo.indexOf("triagemVinculoAtiva()");
  for (const depois of ["createClient()", "createAdminClient()", "auth.getUser()", "request.formData()"]) {
    assert.ok(corpo.indexOf(depois) > guarda, `${depois} vem depois da guarda da chave`);
  }
});

test("toda ação do servidor da triagem confere a chave logo na primeira linha", () => {
  const src = ler("src/lib/data/triagem-actions.ts");
  const acoes = src.match(/^export async function \w+/gm) ?? [];
  assert.ok(acoes.length >= 5, "as cinco ações públicas existem");
  const guardas = src.match(/^\s*if \(!\(await triagemVinculoAtiva\(\)\)\) return (null|\{ ok: false, error: "Indisponível\." \});/gm) ?? [];
  assert.equal(guardas.length, acoes.length, "uma guarda por ação");
  // a guarda é a 1ª instrução do corpo (nenhuma leitura antes dela)
  for (const m of src.matchAll(/^export async function \w+[^\n]*\{\n([^\n]*)\n/gm)) {
    assert.match(m[1], /triagemVinculoAtiva\(\)/, "primeira linha do corpo");
  }
  assert.match(ler("src/lib/triagem/servidor.ts"), /if \(!\(await triagemVinculoAtiva\(\)\) \|\| !\/\^\[0-9a-f-\]\{36\}\$\/i\.test\(leadId\)\) return null;/);
});

test("o bloco do comprovante só é montado na candidatura, e só com a chave ligada", () => {
  const usos = [...arquivos("src/app"), ...arquivos("src/components")].filter((f) => /VinculoMorador\b/.test(ler(f)) && f !== "src/components/triagem/vinculo-morador.tsx");
  assert.deepEqual(usos, ["src/app/(dashboard)/dashboard/candidaturas/page.tsx"]);
  const pagina = ler("src/app/(dashboard)/dashboard/candidaturas/page.tsx");
  assert.match(pagina, /\{triagemLigada && <VinculoMorador \/>\}/);
  assert.match(pagina, /listMinhasCandidaturas\(\{ exigir: true \}\), triagemVinculoAtiva\(\)/);
});

test("o selo 'Morador verificado' só chega ao dono com a chave ligada (nunca arquivo nem valores)", () => {
  const l = ler("src/lib/data/leads.ts");
  assert.match(l, /const seloTriagem = new Map<string, string>\(\);\s*\n\s*if \(admin && tenantIds\.length > 0 && !identidadeFalhou && \(await triagemVinculoAtiva\(\)\)\) \{/);
  // fora do bloco da chave, ninguém preenche o campo do selo
  const fora = l.replace(/if \(admin && tenantIds\.length > 0 && !identidadeFalhou && \(await triagemVinculoAtiva\(\)\)\) \{[\s\S]*?\n  \}\n/, "");
  assert.doesNotMatch(fora, /seloTriagem\.set\(/);
});

test("nenhuma tela promete 'comprovante de vínculo' ou 'Morador verificado' fora do que está atrás da chave", () => {
  // Cada arquivo que cita o vínculo tem a sua guarda provada aqui ou nos testes acima:
  //  • vinculo-morador.tsx — só montado na candidatura, dentro de `{triagemLigada && …}`;
  //  • triagem-vinculo/route.ts — responde 404 com a chave desligada;
  //  • candidaturas/page.tsx — só cita no comentário que antecede o bloco condicionado;
  //  • vinculos-admin-client.tsx — fila do admin, montada só com `triagemLigada`.
  const permitidos = new Set([
    "src/components/triagem/vinculo-morador.tsx",
    "src/app/api/upload/triagem-vinculo/route.ts",
    "src/app/(dashboard)/dashboard/candidaturas/page.tsx",
    "src/app/(dashboard)/admin/documentos/vinculos-admin-client.tsx",
    "src/config/retencao.ts",
  ]);
  const achados = [...arquivos("src/app"), ...arquivos("src/components")].filter((f) => /comprovante de v[ií]nculo|Morador verificado/i.test(ler(f)) && !permitidos.has(f));
  assert.deepEqual(achados, [], "qualquer outra tela que cite o vínculo precisa entrar aqui com a guarda dela");
  // candidaturas: a citação é só comentário (nenhum texto de tela)
  const cand = ler("src/app/(dashboard)/dashboard/candidaturas/page.tsx");
  const semComentarios = cand.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(semComentarios, /comprovante de v[ií]nculo|Morador verificado/i);
});

test("a Conta e o Perfil não importam a triagem do vínculo", () => {
  for (const pasta of ["src/app/(dashboard)/dashboard/conta"]) {
    for (const f of arquivos(pasta)) {
      assert.doesNotMatch(ler(f), /triagem|VinculoMorador|vinculo-morador/i, f);
    }
  }
  for (const f of arquivos("src/app/(dashboard)/dashboard").filter((x) => /perfil/i.test(x))) {
    assert.doesNotMatch(ler(f), /triagem|VinculoMorador|vinculo-morador/i, f);
  }
});

test("a página da proposta só lê o selo do interessado pelo dono, e a fila do admin só existe com a chave", () => {
  const prop = ler("src/app/(dashboard)/dashboard/propostas/[id]/page.tsx");
  assert.doesNotMatch(prop, /VinculoMorador|triagem-vinculo/);
  const adm = ler("src/app/(dashboard)/admin/documentos/page.tsx");
  assert.match(adm, /const triagemLigada = await triagemVinculoAtiva\(\);/);
  assert.match(adm, /\{triagemLigada \? <VinculosAdmin /);
});
