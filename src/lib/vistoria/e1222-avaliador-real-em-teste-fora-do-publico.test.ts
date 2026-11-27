/*
  E1222 (ORDEM-DUET-1075, prompt do coordenador) — a página e a vitrine do avaliador real EM TESTE saíam ao público.
  Antes: /avaliadores/<nº> e a listagem por cidade mostravam todo o credenciado ativo ou em_teste (avaliadores_publicos),
  também a pessoa real ainda em teste, sem linha curada publicada — a página de uma pessoa real no ar sem decisão.
  Depois: uma regra pura, avaliadorVisivelEmPublico({ status, teste, temLinhaCuradaPublicada }), numa fonte só — true se
  a linha curada está publicada, ou o status é ativo, ou o status é em_teste com conta de teste; senão false. A página
  responde notFound() e o credenciado não entra em nenhuma lista. A função avaliadores_publicos() do banco não muda.
  Roda: node --test src/lib/vistoria/e1222-avaliador-real-em-teste-fora-do-publico.test.ts
*/
import { register } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

register("./e1222-harness/loader.mjs", import.meta.url);
const { avaliadorVisivelEmPublico } = await import("./vitrine-avaliadores.ts");
const { fontesDaVitrine, credenciadoVisivelEmPublico } = await import("./vitrine-servidor.ts");

test("a regra pura: curada publicada, ativo, ou em_teste de conta de teste → visível; o resto → fora", () => {
  const casos: [Parameters<typeof avaliadorVisivelEmPublico>[0], boolean][] = [
    [{ status: "em_teste", teste: false, temLinhaCuradaPublicada: false }, false], // o caso da Kellen: pessoa real em teste
    [{ status: "em_teste", teste: false, temLinhaCuradaPublicada: true }, true], // o UDI-003: linha curada publicada
    [{ status: "em_teste", teste: true, temLinhaCuradaPublicada: false }, true], // conta de teste em teste
    [{ status: "ativo", teste: false, temLinhaCuradaPublicada: false }, true], // credenciado real ativo
    [{ status: "ativo", teste: true, temLinhaCuradaPublicada: false }, true],
    [{ status: "suspenso", teste: false, temLinhaCuradaPublicada: false }, false],
    [{ status: "suspenso", teste: true, temLinhaCuradaPublicada: false }, false],
    [{ status: "pendente", teste: true, temLinhaCuradaPublicada: false }, false],
    [{ status: null, teste: false, temLinhaCuradaPublicada: false }, false], // sem leitura do status: fora
    [{ status: null, teste: false, temLinhaCuradaPublicada: true }, true],
  ];
  for (const [entrada, esperado] of casos) assert.equal(avaliadorVisivelEmPublico(entrada), esperado, JSON.stringify(entrada));
});

// ── o cliente Supabase falso: as mesmas tabelas que a vitrine e a página leem ────────────────────────────────────
type Cred = { id: string; numero_credenciado: string; status: string; user_id: string | null; parceiros: { user_id: string | null } | null };
type Curada = { numero: string; nome_publico: string; cidade: string; selo: string | null; credenciamento_id: string | null; publicado: boolean };
type Mundo = { publicos: { numero_credenciado: string; nome_curto: string; cidade: string; avaliacoes_feitas: number; nota_conduta: null; teste: boolean }[]; creds: Cred[]; curadas: Curada[]; contas: { id: string; avatar_url: null; is_teste: boolean }[]; falhaCreds?: boolean };

function adminFalso(m: Mundo) {
  const linhas = (tabela: string): Record<string, unknown>[] =>
    tabela === "avaliadores_credenciamento" ? m.creds : tabela === "avaliadores_perfil_publico" ? m.curadas : tabela === "profiles" ? m.contas : [];
  return {
    rpc: async (nome: string) => (nome === "avaliadores_publicos" ? { data: m.publicos, error: null } : { data: null, error: { message: nome } }),
    from(tabela: string) {
      let rs = linhas(tabela);
      const erro = tabela === "avaliadores_credenciamento" && m.falhaCreds ? { message: "falha de leitura" } : null;
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.eq = (col: string, v: unknown) => ((rs = rs.filter((r) => r[col] === v)), b);
      b.in = (col: string, vs: unknown[]) => ((rs = rs.filter((r) => vs.includes(r[col]))), b);
      b.maybeSingle = async () => (erro ? { data: null, error: erro } : { data: rs[0] ?? null, error: null });
      b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(erro ? { data: null, error: erro } : { data: rs, error: null }).then(ok, ko);
      return b;
    },
  } as never;
}

const pub = (numero: string, teste = false) => ({ numero_credenciado: numero, nome_curto: `Nome ${numero}`, cidade: "Uberlândia", avaliacoes_feitas: 0, nota_conduta: null, teste });
const MUNDO: Mundo = {
  publicos: [pub("UBE-002"), pub("UDI-003"), pub("UDI-090", true), pub("UDI-091")],
  creds: [
    { id: "c-kellen", numero_credenciado: "UBE-002", status: "em_teste", user_id: "u-kellen", parceiros: null }, // real, em teste, sem curada
    { id: "c-udi3", numero_credenciado: "UDI-003", status: "em_teste", user_id: "u-udi3", parceiros: null }, // real, em teste, curada ligada
    { id: "c-teste", numero_credenciado: "UDI-090", status: "em_teste", user_id: "u-teste", parceiros: null }, // conta de teste
    { id: "c-ativo", numero_credenciado: "UDI-091", status: "ativo", user_id: "u-ativo", parceiros: null }, // real ativo
  ],
  curadas: [{ numero: "UDI-003", nome_publico: "Rogério Curado", cidade: "Uberlândia", selo: "Avaliador sócio da Viva", credenciamento_id: "c-udi3", publicado: true }],
  contas: [
    { id: "u-kellen", avatar_url: null, is_teste: false },
    { id: "u-udi3", avatar_url: null, is_teste: false },
    { id: "u-teste", avatar_url: null, is_teste: true },
    { id: "u-ativo", avatar_url: null, is_teste: false },
  ],
};

test("a vitrine (fontesDaVitrine, de onde saem as listas por cidade): o real em teste sem curada não entra; os outros três ficam", async () => {
  const numeros = (await fontesDaVitrine(adminFalso(MUNDO))).map((f) => f.numero).sort();
  assert.deepEqual(numeros, ["UDI-003", "UDI-090", "UDI-091"]);
});

test("a vitrine: a conta de teste conta pela conta do credenciamento, não só pelo parceiro", async () => {
  const mundo: Mundo = { ...MUNDO, publicos: [pub("UDI-090", false)] }; // o rpc diz que não é teste; a conta diz que é
  assert.deepEqual((await fontesDaVitrine(adminFalso(mundo))).map((f) => f.numero), ["UDI-090"]);
});

test("a vitrine: uma linha curada publicada com o mesmo número (ainda sem ligação) também deixa o credenciado visível", async () => {
  const mundo: Mundo = { ...MUNDO, curadas: [{ ...MUNDO.curadas[0], numero: "UBE-002", credenciamento_id: null }] };
  assert.ok((await fontesDaVitrine(adminFalso(mundo))).some((f) => f.numero === "UBE-002"));
});

test("a vitrine: linha curada NÃO publicada não abre a porta", async () => {
  const mundo: Mundo = { ...MUNDO, curadas: [{ ...MUNDO.curadas[0], publicado: false }] };
  // A consulta das curadas já pede publicado = true; a linha não publicada some e o UDI-003 (real, em teste) sai.
  assert.ok(!(await fontesDaVitrine(adminFalso(mundo))).some((f) => f.numero === "UDI-003"));
});

test("a página (credenciadoVisivelEmPublico): a mesma regra, número a número; sem leitura, fora (404)", async () => {
  const admin = adminFalso(MUNDO);
  assert.equal(await credenciadoVisivelEmPublico(admin, "UBE-002", false), false);
  assert.equal(await credenciadoVisivelEmPublico(admin, "UDI-003", false), true);
  assert.equal(await credenciadoVisivelEmPublico(admin, "UDI-090", false), true);
  assert.equal(await credenciadoVisivelEmPublico(admin, "UDI-091", false), true);
  assert.equal(await credenciadoVisivelEmPublico(admin, "UBE-002", true), true, "conta de teste pelo rpc também conta");
  assert.equal(await credenciadoVisivelEmPublico(adminFalso({ ...MUNDO, falhaCreds: true }), "UDI-091", false), false, "leitura que falha: fora");
});

test("a página /avaliadores/[numero] responde notFound() quando a regra dá false, antes de montar o perfil", () => {
  const p = readFileSync("src/app/(public)/avaliadores/[numero]/page.tsx", "utf8");
  assert.match(p, /if \(!admin \|\| !\(await credenciadoVisivelEmPublico\(admin, a\.numero_credenciado, a\.teste\)\)\) notFound\(\);/);
  assert.ok(p.indexOf("credenciadoVisivelEmPublico(admin, a.numero_credenciado") < p.indexOf("fotoDoCredenciado(admin"), "a regra vem antes de qualquer leitura do perfil");
});

test("a regra fica no código: nenhuma migração nova mexe em avaliadores_publicos()", () => {
  const s = readFileSync("src/lib/vistoria/vitrine-servidor.ts", "utf8");
  assert.match(s, /avaliadorVisivelEmPublico\(/, "a vitrine aplica a regra única");
});
