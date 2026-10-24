/*
  FOTO-PERFIL-B (E13) — regra da foto, fila de revisão, remoção com motivo, denúncia e o envio pelo servidor.
  Roda: node --test src/lib/perfil/foto-revisao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { avisoRemocao, MOTIVO_DENUNCIA_FOTO, MOTIVOS_REMOCAO_FOTO, motivoRemocaoValido, ordenarFila, textoRemocao } from "./foto-revisao.ts";
import { CATEGORIAS } from "../atendimento/classificar.ts";
import { filaDaCategoria } from "../atendimento/filas.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const sql = readFileSync(new URL("../../../supabase/migrations/0244_fotos_perfil_revisao.sql", import.meta.url), "utf8");

test("motivos: lista fechada, a mesma do banco", () => {
  assert.deepEqual([...MOTIVOS_REMOCAO_FOTO], ["Não mostra um rosto", "Parece ser de criança ou adolescente", "Mais de uma pessoa", "Não parece ser você", "Imagem imprópria"]);
  for (const m of MOTIVOS_REMOCAO_FOTO) {
    assert.equal(motivoRemocaoValido(m), true);
    assert.ok(sql.includes(`'${m}'`), `0244 confere "${m}"`);
  }
  for (const m of ["", "outro", "não mostra um rosto", null, 3]) assert.equal(motivoRemocaoValido(m), false);
});

test("fila: denunciadas no topo (a mais recente primeiro); depois a mais antiga primeiro", () => {
  const f = ordenarFila([
    { id: "nova", enviadaEm: "2026-10-24T10:00:00Z", denunciadaEm: null },
    { id: "antiga", enviadaEm: "2026-10-01T10:00:00Z", denunciadaEm: null },
    { id: "den1", enviadaEm: "2026-10-20T10:00:00Z", denunciadaEm: "2026-10-24T08:00:00Z" },
    { id: "den2", enviadaEm: "2026-10-02T10:00:00Z", denunciadaEm: "2026-10-24T09:00:00Z" },
  ]);
  assert.deepEqual(f.map((x) => x.id), ["den2", "den1", "antiga", "nova"]);
});

test("aviso na Conta: só depois da remoção e enquanto não houver foto nova; o texto leva o motivo", () => {
  assert.equal(avisoRemocao({ status: "removida", motivo: "Imagem imprópria" }, false), "Imagem imprópria");
  assert.equal(avisoRemocao({ status: "removida", motivo: "Imagem imprópria" }, true), null);
  assert.equal(avisoRemocao({ status: "em_revisao", motivo: null }, false), null);
  assert.equal(avisoRemocao(null, false), null);
  assert.match(textoRemocao("Mais de uma pessoa", "Helena"), /^Olá Helena, .*Motivo: Mais de uma pessoa\./);
});

test("servidor: avatar e revisão na mesma transação; o arquivo tem de existir; nada do navegador é confiado", () => {
  const av = ler("lib/data/avatar-actions.ts");
  assert.match(av, /if \(!ehAvatarDoUsuario\(path, user\.id\)\) return \{ ok: false \};/);
  assert.match(av, /storage\.from\(AVATARS_BUCKET\)\.list\(user\.id, \{ search: "avatar\.webp"/);
  assert.match(av, /admin\.rpc\("foto_perfil_enviada", \{ p_user: user\.id, p_caminho: avatarPath\(user\.id\) \}\)/);
  assert.doesNotMatch(av.slice(av.indexOf("export async function setMyAvatarPath"), av.indexOf("export async function clearMyAvatar")), /from\("profiles"\)\s*\.update/);
  const fn = sql.slice(sql.indexOf("create or replace function public.foto_perfil_enviada"), sql.indexOf("revoke all on function"));
  assert.match(fn, /if p_caminho is distinct from p_user::text \|\| '\/avatar\.webp' then/);
  assert.match(fn, /update public\.profiles set avatar_url = p_caminho/);
  assert.match(fn, /insert into public\.fotos_perfil_revisao \(user_id, caminho\)/);
  assert.match(sql, /grant execute on function public\.foto_perfil_enviada\(uuid, text\) to service_role;/);
  assert.match(sql, /revoke all on function public\.foto_perfil_enviada\(uuid, text\) from public, anon, authenticated;/);
});

test("remover: motivo da lista, apaga o arquivo, limpa o avatar e avisa uma vez; aprovar só tira da fila", () => {
  const a = ler("lib/data/fotos-perfil-actions.ts");
  const rem = a.slice(a.indexOf("export async function removerFotoPerfil"), a.indexOf("export async function minhaFotoRemovida"));
  assert.match(rem, /if \(!motivoRemocaoValido\(motivo\)\) return \{ ok: false/);
  assert.match(rem, /const a = await exigirAdmin\(\);/);
  assert.match(rem, /\.eq\("status", "em_revisao"\)/, "só uma vez (corrida inclusive)");
  assert.match(rem, /if \(!linha\) return \{ ok: true, valor: null \};/);
  assert.match(rem, /storage\.from\(AVATARS_BUCKET\)\.remove\(\[linha\.caminho\]\)/);
  assert.match(rem, /from\("profiles"\)\.update\(\{ avatar_url: null/);
  assert.equal(rem.match(/await notify\(/g)?.length, 1);
  assert.match(rem, /event: "foto_perfil_removida"/);
  assert.match(a, /perfil\?\.role !== "admin" \|\| !\(await sessaoAal2\(supabase\)\)/);
  assert.doesNotMatch(a, /notify\(\{ event: "[a-z_]*equipe/, "sem alerta por e-mail para a equipe");
});

test("denúncia: motivo próprio só pelo contexto 'perfil'; a foto volta para o topo da fila", () => {
  const cat = CATEGORIAS.find((c) => c.key === "foto_perfil");
  assert.ok(cat);
  assert.equal(cat.rotulo, MOTIVO_DENUNCIA_FOTO);
  assert.equal(cat.soContexto, "perfil");
  assert.equal(filaDaCategoria("foto_perfil"), "suporte");
  const at = ler("lib/data/atendimento-actions.ts");
  assert.match(at, /if \(cat\.key === "foto_perfil" && contextoTipo === "perfil" && contextoId && \(await reabrirFotoPorDenuncia\(admin, contextoId\)/);
  assert.match(at, /if \(id === userId\) return false;/);
  const srv = ler("lib/data/fotos-perfil-servidor.ts");
  assert.match(srv, /update\(\{ denunciada_em: agora \}\)\.eq\("user_id", userId\)\.eq\("status", "em_revisao"\)/);
  assert.match(srv, /insert\(\{ user_id: userId, caminho, denunciada_em: agora \}\)/);
  assert.match(ler("app/(public)/proprietario/[id]/page.tsx"), /<ProblemaComIsto tipo="perfil" id=\{id\} \/>/);
});

test("painel: contador 'Fotos de perfil em revisão' e atalho para a fila", () => {
  const at = ler("app/(dashboard)/admin/atalhos-admin.tsx");
  assert.match(at, /\{ rotulo: ROTULO_CONTADOR_FOTOS, valor: fotosPerfil, href: "\/admin\/fotos-perfil" \}/);
  assert.match(at, /from\("fotos_perfil_revisao"\)\.select\("id", \{ count: "exact", head: true \}\)\.eq\("status", "em_revisao"\)/);
  assert.match(at, /\{ href: "\/admin\/fotos-perfil", label: "Fotos de perfil", icon: UserRound \}/);
});
