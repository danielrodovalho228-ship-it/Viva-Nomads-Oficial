/*
  E74 — Central de Agentes: "Ao vivo" só com dado vivo de verdade; estado vazio sem jargão.
  Roda: node --test src/lib/agentes/selo-vivo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JANELA_AO_VIVO_MS, estadoDaCentral } from "./selo-vivo.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const agora = new Date("2026-10-24T11:00:00Z");
const agentes = [{ slug: "renato" }, { slug: "moacir" }];
const ronda = (minAtras: number) => ({ iniciada_em: new Date(agora.getTime() - minAtras * 60_000).toISOString() });

test("ao vivo: acesso liberado, agentes e ronda dentro da janela", () => {
  assert.equal(estadoDaCentral({ acessoLiberado: true, agentes, rondas: [ronda(300), ronda(6)], agora }).tipo, "ao_vivo");
  assert.equal(estadoDaCentral({ acessoLiberado: true, agentes, rondas: [ronda(JANELA_AO_VIVO_MS / 60_000)], agora }).tipo, "ao_vivo");
});

test("parado: há agentes mas a última ronda é velha ou não existe — nunca 'Ao vivo'", () => {
  const velho = estadoDaCentral({ acessoLiberado: true, agentes, rondas: [ronda(3 * 24 * 60)], agora });
  assert.deepEqual([velho.tipo, velho.selo, velho.vazio], ["parado", "Última ronda há 3 dias", null]);
  const nunca = estadoDaCentral({ acessoLiberado: true, agentes, rondas: [], agora });
  assert.deepEqual([nunca.tipo, nunca.selo], ["parado", "Nenhuma ronda registrada"]);
});

test("sem acesso (sessão sem a verificação em duas etapas): não diz que está vazio, manda digitar o código", () => {
  const e = estadoDaCentral({ acessoLiberado: false, agentes: [], rondas: [], agora });
  assert.equal(e.tipo, "sem_acesso");
  assert.equal(e.vazio?.titulo, "Confirme o código para ver a equipe");
  assert.equal(e.vazio?.acao?.href, "/auth/verificar-codigo?redirect=%2Fadmin%2Fagentes");
  // Mesmo com ronda "nova" em memória, sem acesso não é ao vivo.
  assert.equal(estadoDaCentral({ acessoLiberado: false, agentes, rondas: [ronda(1)], agora }).tipo, "sem_acesso");
});

test("vazio de verdade: texto da equipe, sem número de migração nem nome de tabela", () => {
  const e = estadoDaCentral({ acessoLiberado: true, agentes: [], rondas: [], agora });
  assert.equal(e.tipo, "vazio");
  for (const t of [e.vazio!.titulo, e.vazio!.texto, estadoDaCentral({ acessoLiberado: false, agentes: [], rondas: [], agora }).vazio!.texto]) {
    assert.doesNotMatch(t, /migra[çc][ãa]o|\b0\d{3}\b|tabela|banco|RLS|aal/i);
  }
});

test("a tela usa a regra: selo condicionado, vazio da regra, KPIs '–' sem acesso; a leitura pergunta is_admin à sessão", () => {
  const tela = ler("src/app/(dashboard)/admin/agentes/central-client.tsx");
  assert.doesNotMatch(tela, /migração 0078/);
  assert.match(tela, /estado\.tipo === "ao_vivo" \? \(/);
  assert.match(tela, /estado\.vazio \? \(\s*<Vazio titulo=\{estado\.vazio\.titulo\}/);
  assert.match(tela, /agora && dados\.acessoLiberado \? indicadores\(/);
  const dados = ler("src/lib/data/agentes-actions.ts");
  assert.match(dados, /supabase\.rpc\("is_admin"\)/);
  assert.match(dados, /acessoLiberado: adm\.data === true/);
});
