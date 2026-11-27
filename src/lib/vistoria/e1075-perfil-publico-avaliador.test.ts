/*
  E1075 (ORDEM-DUET-355, decisão do Daniel de 21/11/2026): a página pública do avaliador do Rogério Silva no ar já, sem
  esperar pelo CNPJ. Âmbito fechado: SÓ o perfil público. O credenciamento (avaliadores_credenciamento), o rodízio, a
  escolha pelo dono, os pedidos e a chave VISTORIA_ATIVA ficam como estão.
  Desenho: um registo mínimo de perfil público (avaliadores_perfil_publico, migração 0349) com número tirado do mesmo
  contador da cidade (proximo_numero_avaliador: nunca colide com um credenciado), lido pela função
  avaliador_perfil_publico(numero). /avaliadores/[numero] procura primeiro o credenciado (como antes) e depois o perfil.
  Roda: node --test src/lib/vistoria/e1075-perfil-publico-avaliador.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { SELO_AVALIADOR_SOCIO } from "./regras.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const MIG = "supabase/migrations/0349_avaliador_perfil_publico_e1075.sql";
const APLICAR = "supabase/producao/aplicar-0349.sql";
const ROLLBACK = "supabase/producao/rollback/0349_rollback.sql";
const PAGINA = "src/app/(public)/avaliadores/[numero]/page.tsx";
const semComentarios = (s: string) => s.replace(/--.*$/gm, "");

test("E1075: a migração cria o registo do perfil público do Rogério Silva, em Uberlândia, com número do contador da cidade", () => {
  for (const f of [MIG, APLICAR]) {
    assert.ok(existsSync(f), f);
    const s = semComentarios(ler(f));
    assert.match(s, /create table if not exists public\.avaliadores_perfil_publico/);
    assert.match(s, /insert into public\.avaliadores_perfil_publico \(numero, nome_publico, cidade, selo\)/);
    assert.match(s, /public\.proximo_numero_avaliador\('UDI'\), 'Rogério Silva', 'Uberlândia', 'Avaliador sócio da Viva'/);
    // Idempotente: rodar de novo não cria um segundo perfil nem gasta outro número.
    assert.match(s, /where not exists \(select 1 from public\.avaliadores_perfil_publico where nome_publico = 'Rogério Silva' and cidade = 'Uberlândia'\)/);
  }
  assert.match(ler(APLICAR), /'20261121000349', '0349_avaliador_perfil_publico_e1075'/);
  assert.ok(existsSync(ROLLBACK));
});

test("E1075: âmbito fechado — a migração não toca no credenciamento, no rodízio, nos pedidos nem na chave", () => {
  for (const f of [MIG, APLICAR]) {
    const s = semComentarios(ler(f));
    assert.doesNotMatch(s, /(insert into|update|delete from)\s+public\.avaliadores_credenciamento/);
    assert.doesNotMatch(s, /(insert into|update|delete from)\s+public\.(vistoria_pedidos|vistoria_designacoes|parceiros)/);
    assert.doesNotMatch(s, /VISTORIA_ATIVA/);
    // A tabela não abre para o cliente: só a função lê, e só o que é público.
    assert.match(s, /revoke all on public\.avaliadores_perfil_publico from public, anon, authenticated;/);
    assert.match(s, /grant execute on function public\.avaliador_perfil_publico\(text\) to anon, authenticated;/);
    assert.match(s, /where p\.numero = p_numero and p\.publicado/);
  }
});

test("E1075: a página mostra o perfil do registo — nome, selo, cidade, número e os estados vazios honestos", () => {
  const p = ler(PAGINA);
  assert.match(p, /sb\.rpc\("avaliador_perfil_publico", \{ p_numero: numero \}\)/);
  assert.match(p, /if \(!a && !perfil\) notFound\(\);/);
  assert.match(p, /data-testid="avaliador-perfil-publico"/);
  // E1079 (asserção alterada): o desenho aprovado (avaliador-perfil-publico-mobile) usa o escudo no selo.
  assert.match(p, /data-testid="avaliador-selo">\s*<ShieldCheck[^>]*\/>\s*\{SELO_AVALIADOR_SOCIO\}/);
  assert.match(p, /data-testid="avaliador-nome">\{perfil\.nome_publico\}/);
  assert.match(p, /data-testid="avaliador-cidade">\{perfil\.cidade\}/);
  assert.match(p, /data-testid="avaliador-numero">\{perfil\.numero\}/);
  assert.match(p, /data-testid="avaliador-feitas">\{perfil\.avaliacoes_feitas\}/);
  // E1079 (asserção alterada): o estado vazio honesto passa a ser o cartão "Novo na Viva" do desenho aprovado.
  assert.match(p, /novoNaViva\(perfil\.avaliacoes_feitas, nota\)/);
  assert.match(p, /data-testid="avaliador-novo"/);
  assert.equal(SELO_AVALIADOR_SOCIO, "Avaliador sócio da Viva");
});

test("E1075: o perfil não se apresenta como credenciado nem como escolhível (o credenciamento espera o CNPJ)", () => {
  const p = ler(PAGINA);
  const perfil = p.slice(p.indexOf("function PerfilPublico"));
  assert.ok(perfil.length > 100, "a página tem o bloco do perfil público");
  assert.doesNotMatch(perfil, /ROTULO_AVALIADOR_CREDENCIADO|LINHA_PUBLICA_DESIGNACAO|credenciad/i);
  // Sem botão de contratar/escolher.
  assert.doesNotMatch(perfil, /<(Button|button|Link)\b/);
});

test("E1075: sem telefone nem e-mail do Rogério (pedido do Daniel, 21/11 12:20) — nem na tabela, nem na função, nem na página", () => {
  const contato = /telefone|whats|celular|e-?mail|tel:|mailto:|wa\.me|contato|contact/i;
  for (const f of [MIG, APLICAR]) {
    const s = semComentarios(ler(f));
    const tabela = s.slice(s.indexOf("create table if not exists public.avaliadores_perfil_publico"), s.indexOf("alter table public.avaliadores_perfil_publico"));
    assert.doesNotMatch(tabela, contato, `${f}: a tabela não tem coluna de contacto`);
    const funcao = s.slice(s.indexOf("create or replace function public.avaliador_perfil_publico"), s.indexOf("revoke all on function public.avaliador_perfil_publico"));
    assert.doesNotMatch(funcao, contato, `${f}: a função não devolve contacto`);
  }
  const p = ler(PAGINA);
  const perfil = p.slice(p.indexOf("function PerfilPublico"));
  assert.doesNotMatch(perfil, contato, "o bloco do perfil não mostra nem liga para contacto");
  assert.match(p, /type Perfil = \{ numero: string; nome_publico: string; cidade: string; selo: string; avaliacoes_feitas: number; nota_conduta: number \| string \| null \};/);
});
