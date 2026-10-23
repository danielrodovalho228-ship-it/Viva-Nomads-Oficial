/*
  59-C1 — o padrão mínimo não pode sumir: grava os 12, não desmarca por omissão, o autosave não quebra em linha antiga.
  Roda: node --test src/lib/conforto/gravacao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHAVES_CONFORTO, VERSAO_CONFORTO } from "../../config/conforto-minimo.ts";
import { estadoConfortoMinimo } from "./regras.ts";
import { confortoParaGravar, gravarDeclaracoes } from "./gravacao.ts";
import { colunasDeOperacao } from "../anuncio/operacao.ts";
import { atualizarRascunhoDoDono } from "../data/rascunho-dono.ts";

type Linha = Record<string, unknown>;

/** Banco de mentira: conforto_declaracoes (upsert por imóvel+chave, update com eq/in) e properties com a restrição da 0200. */
function bancoFalso(inicial: { declaracoes?: Linha[]; properties?: Linha[] } = {}) {
  const tabelas: Record<string, Linha[]> = { conforto_declaracoes: [...(inicial.declaracoes ?? [])], properties: [...(inicial.properties ?? [])] };
  const restricaoProprio = (l: Linha) => !(l.ownership_type === "own" && l.sublease_authorized === true);
  return {
    tabelas,
    from(tabela: string) {
      const filtros: ((l: Linha) => boolean)[] = [];
      let acao: { tipo: "update"; campos: Linha } | null = null;
      const q = {
        upsert(linhas: Linha[]) {
          for (const nova of linhas) {
            const i = tabelas[tabela].findIndex((l) => l.property_id === nova.property_id && l.chave === nova.chave);
            if (i >= 0) tabelas[tabela][i] = { ...tabelas[tabela][i], ...nova };
            else tabelas[tabela].push({ ...nova });
          }
          return Promise.resolve({ error: null });
        },
        update(campos: Linha) {
          acao = { tipo: "update", campos };
          return q;
        },
        eq(c: string, v: unknown) {
          filtros.push((l) => l[c] === v);
          return q;
        },
        in(c: string, vs: unknown[]) {
          filtros.push((l) => vs.includes(l[c]));
          return q;
        },
        select() {
          return q;
        },
        then(ok: (r: { data: Linha[] | null; error: { code: string; message: string } | null }) => unknown) {
          const alvo = tabelas[tabela].filter((l) => filtros.every((f) => f(l)));
          if (acao?.tipo === "update") {
            const novas = alvo.map((l) => ({ ...l, ...acao!.campos }));
            // A restrição NOT VALID da 0200 vale para QUALQUER update da linha, mesmo sem mexer nesses campos.
            if (tabela === "properties" && novas.some((l) => !restricaoProprio(l)))
              return Promise.resolve(ok({ data: null, error: { code: "23514", message: 'new row for relation "properties" violates check constraint "properties_proprio_sem_sublocacao"' } }));
            for (const [k, l] of alvo.entries()) Object.assign(l, novas[k]);
            return Promise.resolve(ok({ data: alvo.map((l) => ({ id: l.id })), error: null }));
          }
          return Promise.resolve(ok({ data: alvo, error: null }));
        },
      };
      return q;
    },
  };
}

const IMOVEL = "9f18c108-0000-4000-8000-000000000001";
const DONO = "d0d0d0d0-0000-4000-8000-000000000001";
const AGORA = new Date("2026-10-23T13:28:00Z");

test("salvar os 12 itens → ler → 12 confirmados na versão atual", async () => {
  const db = bancoFalso();
  const r = await gravarDeclaracoes(db, IMOVEL, DONO, CHAVES_CONFORTO, AGORA);
  assert.deepEqual(r, { ok: true });
  const lidas = db.tabelas.conforto_declaracoes.filter((l) => l.property_id === IMOVEL) as { chave: string; confirmado: boolean; versao_lista: number }[];
  assert.equal(CHAVES_CONFORTO.length, 12);
  assert.equal(lidas.filter((l) => l.confirmado && l.versao_lista === VERSAO_CONFORTO).length, 12);
  const e = estadoConfortoMinimo(lidas, null, AGORA);
  assert.equal(e.completo, true);
  assert.equal(e.faltantes.length, 0);
});

test("lista ausente não desmarca; lista vazia só desmarca com a marca explícita do cliente", async () => {
  // O que o "Salvar como rascunho" do QA mandou (confortoConfirmados = [] sem o dono ter mexido) não vira gravação.
  assert.equal(confortoParaGravar(undefined, undefined), null);
  assert.equal(confortoParaGravar([], undefined), null);
  assert.equal(confortoParaGravar([], false), null);
  assert.equal(confortoParaGravar(CHAVES_CONFORTO, undefined), null);
  assert.equal(confortoParaGravar("tudo", true), null);
  assert.deepEqual(confortoParaGravar([], true), []);
  assert.deepEqual(confortoParaGravar([CHAVES_CONFORTO[0], 7], true), [CHAVES_CONFORTO[0]]);

  // Com a marca explícita, desmarcar um item tira só aquele; os outros 11 continuam confirmados.
  const db = bancoFalso();
  await gravarDeclaracoes(db, IMOVEL, DONO, CHAVES_CONFORTO, AGORA);
  await gravarDeclaracoes(db, IMOVEL, DONO, confortoParaGravar(CHAVES_CONFORTO.slice(1), true)!, AGORA);
  const lidas = db.tabelas.conforto_declaracoes as { chave: string; confirmado: boolean; versao_lista: number }[];
  assert.deepEqual(estadoConfortoMinimo(lidas, null, AGORA).faltantes, [CHAVES_CONFORTO[0]]);
});

test("o autosave numa linha antiga própria com sublocação marcada grava e normaliza", async () => {
  const linha = { id: IMOVEL, owner_id: DONO, status: "draft", ownership_type: "own", sublease_authorized: true, title: "Antes" };
  // Sem as colunas da operação (o autosave de antes): o banco recusa — foi o 400 de produção.
  const antes = bancoFalso({ properties: [{ ...linha }] });
  const r0 = await atualizarRascunhoDoDono(antes, IMOVEL, DONO, { title: "Depois" });
  assert.equal(r0.atualizou, false);
  assert.equal((r0.error as { code: string }).code, "23514");

  // Com as colunas pela regra do updateProperty: grava e a linha volta ao permitido.
  const db = bancoFalso({ properties: [{ ...linha }] });
  const r = await atualizarRascunhoDoDono(db, IMOVEL, DONO, { title: "Depois", ...colunasDeOperacao("own", true) });
  assert.equal(r.atualizou, true);
  assert.equal(r.error, null);
  assert.equal(db.tabelas.properties[0].sublease_authorized, false);
  assert.equal(db.tabelas.properties[0].title, "Depois");
});

test("colunasDeOperacao: a mesma regra do updateProperty", () => {
  assert.deepEqual(colunasDeOperacao("own", true), { ownership_type: "own", sublease_authorized: false });
  assert.deepEqual(colunasDeOperacao("subleased", true), { ownership_type: "subleased", sublease_authorized: true });
  assert.deepEqual(colunasDeOperacao("managed", undefined), { ownership_type: "managed", sublease_authorized: false });
  assert.deepEqual(colunasDeOperacao(undefined, true), { ownership_type: "own", sublease_authorized: false });
});

test("guardas no código: autosave grava a operação; salvar/publicar só grava o checklist com a marca de mexido", () => {
  const actions = readFileSync(new URL("../data/actions.ts", import.meta.url), "utf8");
  const autosave = actions.slice(actions.indexOf("export async function saveDraftData"));
  assert.match(autosave.slice(0, autosave.indexOf("draft_data:")), /\.\.\.colunasDeOperacao\(/);
  assert.match(autosave, /console\.error\("\[saveDraftData\]"/);
  assert.doesNotMatch(actions, /Array\.isArray\(input\.confortoConfirmados\)/);
  assert.equal(actions.match(/confortoParaGravar\(input\.confortoConfirmados, input\.confortoMexido\)/g)?.length, 2);
  const editor = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/page.tsx", import.meta.url), "utf8");
  assert.match(editor, /\.\.\.\(conf\.mexido \? \{ confortoConfirmados: conforto, confortoMexido: true \} : \{\}\)/);
  assert.doesNotMatch(editor, /confortoConfirmados: conforto,\n/);
});
