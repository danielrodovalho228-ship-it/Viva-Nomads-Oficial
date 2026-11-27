/* E679-B parte 1 — a ação da estadia grava os critérios do par, e a avaliação pública não entra na caução. Roda: node --test src/lib/avaliacoes-fluxo-e679.test.ts */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ler = (p: string) => readFileSync(p, "utf8");
const acao = ler("src/lib/data/avaliacoes-actions.ts");
const resp = ler("src/lib/data/avaliacoes-resposta-actions.ts");
const form = ler("src/components/avaliacao-form.tsx");

test("avaliar(): valida pelo par e grava critérios, etiquetas, recomendaria e as notas privadas", () => {
  assert.match(acao, /validarAvaliacaoCompleta\(/);
  assert.match(acao, /morador_avalia_dono/);
  assert.match(acao, /dono_avalia_morador/);
  for (const c of ["notas_categorias", "etiquetas", "recomendaria", "nota_privada_parte", "nota_privada_viva"]) assert.match(acao, new RegExp(c));
  // moderação vem do banco (status devolvido), não de um segundo filtro no servidor
  assert.match(acao, /moderacao: data\?\.status === "em_moderacao"/);
});

test("o formulário envia os critérios do par e o 'recomendaria'", () => {
  assert.match(form, /CRITERIOS\[/);
  assert.match(form, /ETIQUETAS\[/);
  assert.match(form, /recomendaria/);
  assert.match(form, /criterios,/);
});

test("pedirRevisaoAvaliacao: 'fato falso' passa pela regra de caução antes de gravar", () => {
  assert.match(resp, /validarFatoFalso\(/);
  assert.ok(resp.indexOf("validarFatoFalso(") < resp.indexOf('.from("avaliacao_contestacoes")'));
});

test("a disputa de caução não lê avaliações (a avaliação pública não é prova)", () => {
  const arquivos: string[] = [];
  const andar = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) andar(p);
      else if (/\.(ts|tsx)$/.test(n) && !/\.test\./.test(n)) arquivos.push(p);
    }
  };
  andar("src");
  const cau = arquivos.filter((p) => /(caucao|disputa)/i.test(p));
  assert.ok(cau.length > 0, "esperava achar os arquivos da caução/disputa");
  for (const p of cau) {
    const s = ler(p);
    assert.doesNotMatch(s, /from\("avaliacoes"\)|from\("parceiro_avaliacoes"\)|from\("avaliacao_/, `${p} lê avaliações`);
  }
});
