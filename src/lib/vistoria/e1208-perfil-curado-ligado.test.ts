/*
  E1208 (ORDEM-DUET-986/989) — a página pública do avaliador com perfil curado ligado ao credenciamento.
  Antes: /avaliadores/UDI-003 mostrava só "Rogerio", o selo genérico "Avaliador credenciado" e nenhum preço. O número
  passou a existir também em avaliadores_credenciamento (status em_teste), e a página abre primeiro o ramo do
  credenciado: o nome vinha da conta (só o primeiro nome) e a cidade do credenciamento ("Uberlandia, Araguari,
  Ituiutaba", que não casa com nenhuma tabela de preço). A linha curada (avaliadores_perfil_publico, 0349) só entra por
  credenciamento_id, que nasceu NULL por desenho e nunca foi ligado.
  Depois: a migração 0365 liga a linha curada ao credenciamento do MESMO número (só onde está NULL, nunca duas vezes o
  mesmo credenciamento), e a linha ligada manda no nome público, na cidade (e nos preços, pela tabela dessa cidade) e no
  selo. O "Sobre" continua o do credenciamento (E1099, ORDEM-989 §2).
  Roda: node --test src/lib/vistoria/e1208-perfil-curado-ligado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { quadroDePreco, vistaPublicaDoCredenciado } from "./vitrine-avaliadores.ts";
import { linhaDaTabela, type Porte } from "./regras.ts";
import { fonteSemComentarios } from "../fonte-sem-comentarios.ts";

const NOME = "0365_avaliador_perfil_curado_ligado_e1208";
const VERSAO = "20261126000365";
const CREDENCIADO = { nome_curto: "Rogerio", cidade: "Uberlandia, Araguari, Ituiutaba" };
const LIGADO = { nome_publico: "Rogério Silva", cidade: "Uberlândia", selo: "Avaliador sócio da Viva" };
const TABELA = (["estudio", "q1_2", "q3_mais"] as Porte[]).map((porte, i) =>
  linhaDaTabela({ cidade: "Uberlândia", porte, valor: [150, 250, 350][i], inclui_texto: null, vigente_desde: "2026-11-21" }),
);
/** O SQL sem as linhas de comentário (os comentários contam a história; a regra está no SQL). */
const sql = (caminho: string) =>
  readFileSync(caminho, "utf8")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("--"))
    .join("\n");

test("E1208 (1): a linha ligada manda no nome público e na cidade; sem ela, nada muda", () => {
  assert.deepEqual(vistaPublicaDoCredenciado(CREDENCIADO, LIGADO), { nome: "Rogério Silva", cidade: "Uberlândia" });
  assert.deepEqual(vistaPublicaDoCredenciado(CREDENCIADO, null), { nome: "Rogerio", cidade: "Uberlandia, Araguari, Ituiutaba" });
  assert.deepEqual(vistaPublicaDoCredenciado(CREDENCIADO, { nome_publico: "  ", cidade: " ", selo: "x" }), { nome: "Rogerio", cidade: "Uberlandia, Araguari, Ituiutaba" }, "linha em branco não apaga o credenciado");
});

test("E1208 (2): os preços saem pela cidade da linha curada (150/250/350); pela do credenciamento, nenhum", () => {
  const agora = new Date("2026-11-26T12:00:00Z");
  assert.deepEqual(quadroDePreco(TABELA, vistaPublicaDoCredenciado(CREDENCIADO, LIGADO).cidade, agora).map((l) => l.valor), [150, 250, 350]);
  assert.equal(quadroDePreco(TABELA, CREDENCIADO.cidade, agora).length, 0, "a causa: três cidades numa frase não casam com a tabela");
});

test("E1208 (3): a migração 0365 só liga a linha curada ao credenciamento do mesmo número, onde está vazio", () => {
  for (const arquivo of [`supabase/migrations/${NOME}.sql`, "supabase/producao/aplicar-0365.sql"]) {
    const m = sql(arquivo);
    assert.match(m, /update public\.avaliadores_perfil_publico p\s+set credenciamento_id = c\.id\s+from public\.avaliadores_credenciamento c\s+where p\.credenciamento_id is null\s+and c\.numero_credenciado = p\.numero/, arquivo);
    assert.match(m, /and not exists \(select 1 from public\.avaliadores_perfil_publico o where o\.credenciamento_id = c\.id\)/, `${arquivo}: nunca o mesmo credenciamento em duas linhas`);
    assert.doesNotMatch(m, /\b(delete|truncate|drop|alter)\b/i, `${arquivo}: nenhuma linha apagada, nenhum esquema mudado`);
    assert.doesNotMatch(m, /set (nome_publico|cidade|selo|publicado|numero)\b/i, `${arquivo}: o conteúdo curado não muda`);
  }
});

test("E1208 (4): o aplicar é uma transação curta e regista-se; o rollback desliga e tira o registo", () => {
  const a = sql("supabase/producao/aplicar-0365.sql");
  assert.match(a, /^begin;\s*set local lock_timeout = '5s';/m);
  assert.match(a, /commit;\s*$/);
  assert.match(a, new RegExp(`select '${VERSAO}', '${NOME}'\\s+where not exists \\(select 1 from supabase_migrations\\.schema_migrations where version = '${VERSAO}'\\);`));
  const r = sql("supabase/producao/rollback/0365_rollback.sql");
  assert.match(r, /update public\.avaliadores_perfil_publico p\s+set credenciamento_id = null\s+from public\.avaliadores_credenciamento c\s+where p\.credenciamento_id = c\.id\s+and c\.numero_credenciado = p\.numero;/);
  assert.match(r, new RegExp(`delete from supabase_migrations\\.schema_migrations where version = '${VERSAO}';`));
});

test("E1208 (5): a fiação — a página e a listagem usam a linha ligada para nome, cidade e preços", () => {
  const pagina = fonteSemComentarios(readFileSync("src/app/(public)/avaliadores/[numero]/page.tsx", "utf8"));
  assert.match(pagina, /const ligado = admin \? await perfilLigadoDoCredenciado\(admin, a\.numero_credenciado\) : null;/);
  assert.match(pagina, /const vista = vistaPublicaDoCredenciado\(a, ligado\);/);
  assert.match(pagina, /data-testid="avaliador-nome">\{vista\.nome\}/);
  assert.match(pagina, /data-testid="avaliador-cidade">\{vista\.cidade\}/);
  assert.match(pagina, /quadroDePreco\(await tabelaDaCidade\(admin, vista\.cidade\), vista\.cidade, new Date\(\)\)/);
  assert.match(pagina, /const uf = ufDaCidade\(MUNICIPIOS, vista\.cidade\);/);
  assert.match(pagina, /const sobre = admin \? await sobreDoCredenciado\(admin, a\.numero_credenciado\) : null;/, "o Sobre continua o do credenciamento");
  const srv = fonteSemComentarios(readFileSync("src/lib/vistoria/vitrine-servidor.ts", "utf8"));
  assert.match(srv, /export async function perfilLigadoDoCredenciado\(/);
  assert.match(srv, /const vista = vistaPublicaDoCredenciado\(a, ligadoDe\.get\(a\.numero_credenciado\) \?\? null\);/);
  assert.match(srv, /nome: vista\.nome,\s*cidade: vista\.cidade,/);
});
