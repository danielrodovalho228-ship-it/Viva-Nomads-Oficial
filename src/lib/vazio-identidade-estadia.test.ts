/*
  Estados vazios / falha de leitura — identidade e estadia:
  1. depoisDaTentativa: sem ler as reprovações anteriores, a conta NÃO volta a "1ª reprovação" (que devolvia a cota paga
     do CAF e mandava "tente de novo" em vez da análise humana). Agora lança; a rota já trata (sem motivo, sem devolver).
  2. /api/caf/verify: sem ler o perfil, não diz "Cadastre seu CPF" a quem já tem CPF (503).
  3. listaParaPortaria: sem ler os ocupantes, não emite um PRT numerado e oficial com a lista VAZIA.
  4. proporAlteracao: sem ler o último aditivo, não cria outro "Aditivo nº 1" (não há índice único em contrato+número).
  Roda: node --test src/lib/vazio-identidade-estadia.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");
const trecho = (src: string, inicio: string, fim: string) => {
  const i = src.indexOf(inicio);
  assert.ok(i >= 0, inicio);
  return src.slice(i, src.indexOf(fim, i));
};

test("identidade: reprovações sem leitura lançam antes de devolver a cota ou decidir a próxima ação", () => {
  const r = ler("src/lib/identidade/reprovacao-servidor.ts");
  const corpo = trecho(r, "export async function depoisDaTentativa(", "\n}\n");
  assert.match(corpo, /\{ data, error: erroHistorico \}/);
  assert.match(corpo, /if \(erroHistorico\) throw new Error\(/);
  assert.ok(corpo.indexOf("if (erroHistorico)") < corpo.indexOf("proximaAcaoVerificacao("));
  assert.ok(corpo.indexOf("if (erroHistorico)") < corpo.indexOf('.from("limites_uso")'));
});

test("verificação: perfil sem leitura responde 503, não 'Cadastre seu CPF'", () => {
  const c = ler("src/app/api/caf/verify/route.ts");
  assert.match(c, /\{ data: perfil, error: erroPerfil \}/);
  assert.match(c, /if \(erroPerfil\) return NextResponse\.json\(\{ error: [^}]+\}, \{ status: 503 \}\)/);
  assert.ok(c.indexOf("if (erroPerfil)") < c.indexOf("Cadastre seu CPF"));
});

test("estadia: lista da portaria e número do aditivo conferem a leitura antes de emitir ou gravar", () => {
  const e = ler("src/lib/data/estadia-actions.ts");
  const lista = trecho(e, "export async function listaParaPortaria(", "\n}\n");
  assert.match(lista, /\{ data, error: erroOcupantes \}/);
  assert.match(lista, /if \(erroOcupantes\) return \{ ok: false, erro: /);
  assert.ok(lista.indexOf("if (erroOcupantes)") < lista.indexOf("registrarDocumento("));
  const aditivo = trecho(e, "export async function proporAlteracao(", "\n}\n");
  assert.match(aditivo, /\{ data: ultimo, error: erroUltimo \}/);
  assert.match(aditivo, /if \(erroUltimo\) return \{ ok: false, erro: /);
  assert.ok(aditivo.indexOf("if (erroUltimo)") < aditivo.indexOf('.from("contrato_aditivos")\n    .insert('));
});
