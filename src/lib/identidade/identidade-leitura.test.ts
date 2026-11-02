/*
  Varredura de erros — rodada própria do estadosIdentidade (achado 95). Antes: as duas leituras (perfil e laudo)
  engoliam o erro → "sem laudo" → todo dono "sem identidade" na nota do ranking público, e o candidato verificado
  aparecia ao dono como "Identidade pendente" (Interessados e Fechamento). Agora as leituras LANÇAM e cada chamada
  decide de forma explícita:
   - ranking público: a lista inteira volta à ordem antiga (como a falha do ranking_sinais);
   - Interessados e Fechamento: "Identidade não conferida agora" (nunca "pendente"); selo da triagem fica de fora;
   - ativar avaliador: "Tente de novo" (nunca recusa por "identidade não confirmada");
   - admin › usuários: coluna "—"; admin › parceiros e páginas do avaliador: error.tsx;
   - selos só positivos (pedidos do dono, admin de pedidos, selo do candidato na proposta): ficam de fora.
  Roda: node --test src/lib/identidade/identidade-leitura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { IDENTIDADE_INDISPONIVEL, identidadeParaOutraParte } from "./estado.ts";
import { complementoPassoIdentidade } from "../vistoria/telas-exibicao.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("indisponível: a outra parte vê 'não conferida agora', nunca 'pendente' nem 'verificada'", () => {
  assert.deepEqual(identidadeParaOutraParte(IDENTIDADE_INDISPONIVEL), { verificada: false, rotulo: "Identidade não conferida agora" });
  assert.equal(identidadeParaOutraParte(null).rotulo, "Identidade pendente");
  assert.equal(complementoPassoIdentidade("indisponivel"), "não conferida agora");
});

test("as duas leituras do servidor lançam na falha", () => {
  const s = ler("src/lib/identidade/estado-servidor.ts");
  assert.equal(s.match(/if \(e1 \|\| e2\) throw new Error\(MSG_IDENTIDADE_SEM_LEITURA\);/g)?.length, 2);
});

test("ranking público: sem a identidade, a lista volta à ordem antiga (nunca todos 'sem identidade')", () => {
  const s = ler("src/lib/data/ranking.ts");
  assert.match(s, /estadosIdentidade\(admin, donos\)\.catch\(/);
  assert.match(s, /if \(!identidades\) return \[\];/);
});

test("Interessados e Fechamento: falha → IDENTIDADE_INDISPONIVEL; selo da triagem fica de fora", () => {
  const l = ler("src/lib/data/leads.ts");
  assert.match(l, /estadosIdentidade\(admin, tenantIds\)\.catch\(\(\) => null\)/);
  assert.match(l, /identidadeFalhou \? IDENTIDADE_INDISPONIVEL/);
  assert.match(l, /!identidadeFalhou && \(await triagemVinculoAtiva\(\)\)/);
  assert.match(l, /verified: identidadeParaOutraParte\(identidadeDe\(r\.tenant_id\)\)\.verificada/);
  const f = ler("src/lib/data/leads-actions.ts");
  assert.match(f, /identidadeInquilino = lidas \? \(lidas\.get\(lead\.tenant_id as string\) \?\? null\) : IDENTIDADE_INDISPONIVEL;/);
});

test("decisões e telas: ativar avaliador pede 'Tente de novo'; admin › usuários mostra '—'; selos só positivos ficam de fora", () => {
  const v = ler("src/lib/vistoria/actions.ts");
  assert.match(v, /estadoIdentidade\(a\.admin, c\.user_id as string\)\.catch\(\(\) => "falhou" as const\)/);
  assert.match(v, /if \(ident === "falhou"\) return \{ ok: false, erro: "Não foi possível conferir a identidade agora\. Tente de novo\." \};/);
  const u = ler("src/app/(dashboard)/admin/usuarios/page.tsx");
  assert.match(u, /estadosIdentidade\(admin, ids\)\.catch\(\(\) => null\)\]\);/);
  assert.match(u, /if \(ests\) identidade = new Map/);
  assert.match(ler("src/app/(dashboard)/dashboard/propostas/[id]/page.tsx"), /seloDoCandidato\(p\.leadId\)\.catch\(\(\) => null\)/);
  assert.match(ler("src/lib/data/pedidos-actions.ts"), /estadosIdentidade\(admin, \[\.\.\.new Set\(inquilinoDe\.values\(\)\)\]\)\.catch\(\(\) => new Map\(\)\)/);
  assert.match(ler("src/lib/data/pedidos-admin-colunas.ts"), /estadosIdentidade\(admin, inqIds\)\.catch\(\(\) => new Map\(\)\)/);
});
