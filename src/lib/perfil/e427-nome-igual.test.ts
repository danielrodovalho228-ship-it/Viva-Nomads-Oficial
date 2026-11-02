/* Roda: node --test src/lib/perfil/e427-nome-igual.test.ts
   E427 (01/11, vigia): DEPOIS do aceite, o nome é COMPLETO e IGUAL em todas as telas (visita, agenda, interessados,
   Mensagens, proposta, estadia, contrato e página pública vista por quem tem o aceite) — fonte única: nomeCompleto.
   ANTES do aceite, a privacidade de sempre: "Candidato(a)" para o dono; o nome curto (nomeCurto) do proprietário no
   público. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cartaoCandidato, nomeCompleto, nomeCurto, nomeNaConversa, nomeNaProposta, type CandidatoBase } from "./perfil-publico.ts";
import { nomeDepoisDoAceite } from "../visitas/nome-visita.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const NOMES = ["Daniel Pereira 1", "Daniel Pereira", "  Daniel   Pereira  2º ", "Daniel", "Ana Clara Souza", "ana@exemplo.com", "Ana ana@x.com Souza", "", null];

test("nomeCompleto: espaços colapsados, e-mail nunca, sem letra → null", () => {
  assert.equal(nomeCompleto("  Ana   Clara  Souza "), "Ana Clara Souza");
  assert.equal(nomeCompleto("Daniel Pereira 1"), "Daniel Pereira 1"); // igual à proposta (Prompt 56)
  assert.equal(nomeCompleto("Ana ana@x.com Souza"), "Ana Souza");
  for (const v of ["ana@exemplo.com", "", "  ", "12", null, undefined]) assert.equal(nomeCompleto(v), null, String(v));
});

test("DEPOIS do aceite: o MESMO nome completo na visita, interessados, Mensagens (dos dois lados) e proposta", () => {
  for (const n of NOMES) {
    const esperado = nomeCompleto(n);
    assert.equal(nomeDepoisDoAceite(n), esperado, `visita ${n}`);
    const cand = { nome: n, fotoUrl: null, profissao: null, motivo: null, pets: 0, desde: null } as unknown as CandidatoBase;
    assert.equal(cartaoCandidato(cand, true).titulo, esperado ?? "Candidato(a)", `interessados ${n}`);
    assert.equal(nomeNaConversa({ papel: "proprietario", nomeCompleto: n, aceito: true }), esperado ?? "Candidato(a)", `msg dono ${n}`);
    assert.equal(nomeNaConversa({ papel: "inquilino", nomeCompleto: n, aceito: true }), esperado ?? "Proprietário", `msg morador ${n}`);
    assert.equal(nomeNaProposta({ quemVe: "owner", nomeCompleto: n, aceito: true }), esperado ?? "Candidato(a)", `proposta ${n}`);
  }
});

test("ANTES do aceite: privacidade atual — 'Candidato(a)' para o dono, nome curto do proprietário para o morador", () => {
  const cand = { nome: "Ana Clara Souza", fotoUrl: "x", profissao: null, motivo: null, pets: 0, desde: null } as unknown as CandidatoBase;
  const antes = cartaoCandidato(cand, false);
  assert.equal(antes.titulo, "Candidato(a)");
  assert.equal(antes.fotoUrl, null);
  assert.equal(nomeNaConversa({ papel: "proprietario", nomeCompleto: "Ana Clara Souza", aceito: false }), "Candidato(a)");
  assert.equal(nomeNaConversa({ papel: "inquilino", nomeCompleto: "Daniel Pereira 1", aceito: false }), "Daniel P.");
  assert.equal(nomeNaProposta({ quemVe: "owner", nomeCompleto: "Ana Clara Souza", aceito: false }), "Candidato(a)");
  assert.equal(nomeCurto("Daniel Pereira 1"), "Daniel P.");
});

test("página pública: nome curto para todos; nome completo só para quem tem o aceite (fail-closed)", () => {
  const src = ler("src/lib/data/perfil-proprietario.ts");
  assert.match(src, /nome: nomeCurto\(\(perfil\.data as \{ full_name\?: string \| null \} \| null\)\?\.full_name\) \?\? nomeCurto\(l\.nome_curto\) \?\? "Proprietário",/);
  const fn = src.slice(src.indexOf("export async function nomeCompletoParaQuemTemAceite"));
  assert.match(fn, /if \(!user \|\| user\.id === donoId\) return null;/);
  assert.match(fn, /relacaoAceitaEntreServidor\(donoId, user\.id\)/);
  assert.match(fn, /nomeLiberadoNaVisita\(v\.status\)/);
  assert.match(fn, /return nomeCompleto\(/);
  assert.match(fn, /catch \{\n\s*return null;/);
  const page = ler("src/app/(public)/proprietario/[id]/page.tsx");
  assert.match(page, /const p = \{ \.\.\.perfil, nome: nomeAceite \?\? perfil\.nome \};/);
  // Metadados (indexáveis) nunca com o nome completo.
  const meta = page.slice(page.indexOf("generateMetadata"), page.indexOf("export default"));
  assert.doesNotMatch(meta, /nomeCompletoParaQuemTemAceite/);
});

test("estadia e contrato (depois do aceite) usam o mesmo nome completo", () => {
  assert.match(ler("src/lib/data/estadia.ts"), /const nomeMorador = nomeCompleto\(/);
  assert.match(ler("src/lib/data/contrato-assinar-actions.ts"), /const nome = \(id: string\) => nomeCompleto\(/);
  const msg = ler("src/lib/data/messages.ts");
  assert.match(msg, /aceito: conv\.papel === "inquilino" \? aceitoPeloDono\.get\(id\) === true : aceito\.get\(id\) === true,/);
});
