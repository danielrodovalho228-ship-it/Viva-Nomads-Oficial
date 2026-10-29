/*
  E227-B — parceria com UMA fila (parceiro_solicitacoes). "há N dias" e a ordem da aba Pendentes; o painel E223 e a
  ação atualizarStatusInteresse saíram; parceiros_interesse (0104) vira legado só de leitura (0254) e ninguém mais lê
  a tabela fora da retenção; a Central de Pendências segue contando os pedidos pendentes.
  Roda: node --test src/lib/parceiros/fila-pendentes.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { diasNaFila, idadePedidoParceria, maisAntigoParceria, ordenarPendentes, textoHaDias } from "./fila-pendentes.ts";
import { haQuantoTempo } from "../admin/decisoes-admin.ts";

const RAIZ = new URL("../../../", import.meta.url);
const ler = (p: string) => readFileSync(new URL(p, RAIZ), "utf8");
const existe = (p: string) => existsSync(new URL(p, RAIZ));

test("há N dias: dias inteiros desde o pedido, nunca negativo", () => {
  const agora = new Date("2026-10-29T15:00:00Z");
  assert.equal(diasNaFila("2026-10-29T09:00:00Z", agora), 0);
  assert.equal(diasNaFila("2026-10-28T14:59:00Z", agora), 1);
  assert.equal(diasNaFila("2026-10-19T15:00:00Z", agora), 10);
  assert.equal(diasNaFila("2026-10-30T15:00:00Z", agora), 0);
  assert.equal(diasNaFila("lixo", agora), 0);
  assert.equal(textoHaDias(0), "hoje");
  assert.equal(textoHaDias(1), "há 1 dia");
  assert.equal(textoHaDias(12), "há 12 dias");
});

test("Pendentes: do mais antigo para o mais novo", () => {
  const lista = [
    { id: "c", criado_em: "2026-10-28T10:00:00Z" },
    { id: "a", criado_em: "2026-10-01T10:00:00Z" },
    { id: "b", criado_em: "2026-10-15T10:00:00Z" },
    { id: "a2", criado_em: "2026-10-01T10:00:00Z" },
  ];
  assert.deepEqual(ordenarPendentes(lista).map((x) => x.id), ["a", "a2", "b", "c"]);
  assert.deepEqual(lista.map((x) => x.id), ["c", "a", "b", "a2"], "não muda a lista recebida");
});

test("a tela: Pendentes ordenada e com 'há N dias' em cada pedido; sem situações novas", () => {
  const pagina = ler("src/app/(dashboard)/admin/parceiros/page.tsx");
  assert.match(pagina, /const lista = aba === "pendentes" \? ordenarPendentes\(/);
  assert.match(pagina, /diasNaFila: diasNaFila\(s\.criado_em as string, new Date\(agora\)\)/);
  const fichas = ler("src/app/(dashboard)/admin/parceiros/fichas.tsx");
  assert.match(fichas, /data-testid="ficha-dias" data-dias=\{f\.diasNaFila\}>\s*\{f\.idade\}/);
  for (const t of [pagina, fichas]) assert.doesNotMatch(t, /contatado|arquivado/);
});

test("o painel E223 saiu: sem seção, sem módulos, sem a ação atualizarStatusInteresse", () => {
  const pagina = ler("src/app/(dashboard)/admin/parceiros/page.tsx");
  assert.doesNotMatch(pagina, /interessados|ListaInteresses|lerInteressesParceria|admin-interesses/);
  for (const arq of [
    "src/app/(dashboard)/admin/parceiros/interesses.tsx",
    "src/lib/admin/interesse-parceria.ts",
    "src/lib/admin/interesses-parceria.ts",
    "tests/e2e/specs/t630-e223-interesses-parceria.spec.ts",
  ])
    assert.equal(existe(arq), false, arq);
  assert.doesNotMatch(ler("src/lib/parceiros/admin-actions.ts"), /atualizarStatusInteresse|StatusInteresse|parceiros_interesse/);
  assert.doesNotMatch(ler("tests/e2e/cobertura.json"), /atualizarStatusInteresse|t630-e223/);
  // O atalho do admin conta a MESMA fila (parceiro_solicitacoes pendente/aguardando e-mail).
  const atalho = ler("src/app/(dashboard)/admin/atalhos-admin.tsx");
  assert.match(atalho, /from\("parceiro_solicitacoes"\)\.select\("id", \{ count: "exact", head: true \}\)\.in\("status", \["pendente", "aguardando_email"\]\)/);
  assert.match(atalho, /href: "\/admin\/parceiros" \}/);
});

/** Arquivos de código do app (sem testes), para a guarda dos leitores. */
function arquivos(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(new URL(dir, RAIZ))) {
    const p = join(dir, nome);
    if (statSync(new URL(p, RAIZ)).isDirectory()) arquivos(`${p}/`, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(nome) && !/\.(test|spec)\./.test(nome)) out.push(p);
  }
  return out;
}

test("GUARDA: ninguém lê parceiros_interesse fora da retenção (falha se surgir um leitor novo)", () => {
  const PERMITIDOS = new Set(["src/config/retencao.ts"]);
  const leitores = [...arquivos("src/"), ...(existe("supabase/functions/") ? arquivos("supabase/functions/") : [])].filter((f) =>
    /parceiros_interesse/.test(ler(f)),
  );
  assert.deepEqual(leitores.filter((f) => !PERMITIDOS.has(f)), []);
  assert.match(ler("src/config/retencao.ts"), /i\("parceiros_interesse", "public\.parceiros_interesse"/);
});

test("0254: parceiros_interesse só de leitura para anon/authenticated, com o comentário; a tabela fica", () => {
  const mig = ler("supabase/migrations/0254_parceiros_interesse_legado.sql");
  const aplicar = ler("supabase/producao/aplicar-0254.sql");
  const COMENTARIO = "'Legado — fonte única: parceiro_solicitacoes (0190). Sai pela política de retenção.'";
  for (const sql of [mig, aplicar]) {
    assert.match(sql, /revoke insert, update, delete on public\.parceiros_interesse from anon, authenticated;/);
    assert.ok(sql.includes(`comment on table public.parceiros_interesse is ${COMENTARIO};`));
    assert.doesNotMatch(sql, /drop table/i);
  }
  assert.match(aplicar, /^begin;$/m);
  assert.match(aplicar, /^commit;$/m);
  assert.match(aplicar, /'20261029000254', '0254_parceiros_interesse_legado'/);
  assert.match(aplicar, /where not exists \(select 1 from supabase_migrations\.schema_migrations where version = '20261029000254'\)/);
  const volta = ler("supabase/producao/rollback/0254_rollback.sql");
  assert.match(volta, /grant insert \(tipo, nome, cidade, uf, whatsapp, email, site, aceite_contato\) on public\.parceiros_interesse to anon, authenticated;/);
  assert.match(volta, /grant update on public\.parceiros_interesse to authenticated;/);
  assert.match(volta, /delete from supabase_migrations\.schema_migrations where version = '20261029000254';/);
});

test("a Central de Pendências segue contando os pedidos de parceria pendentes (parceiro_solicitacoes)", () => {
  const decisoes = ler("src/lib/data/admin-decisoes.ts");
  const ini = decisoes.indexOf("async function parceriasPendentes(");
  assert.ok(ini > 0);
  const corpo = decisoes.slice(ini, decisoes.indexOf("\n}\n", ini));
  assert.match(corpo, /from\("parceiro_solicitacoes"\)/);
  assert.match(corpo, /pendente/);
  assert.match(decisoes, /parceiros_para_aprovar: parcerias/);
});

test("E234: a idade do pedido de parceria é UMA conta — o caso 16 × 17 (pedido de 12/10 12:52) dá o mesmo número nas duas telas", () => {
  const criado = "2026-10-12T15:52:00Z"; // 12/10 12:52 em Brasília
  const agora = new Date("2026-10-29T06:00:00Z"); // 16 dias e ~14 h depois: 16,59 dias
  const horas = (agora.getTime() - Date.parse(criado)) / 3_600_000;
  // O que acontecia: a Visão geral arredondava as horas para o dia mais próximo (17); a Pendentes contava dias inteiros (16).
  assert.equal(haQuantoTempo(horas), "há 17 dias");
  assert.equal(textoHaDias(diasNaFila(criado, agora)), "há 16 dias");
  // Agora as duas telas saem da mesma função.
  assert.equal(idadePedidoParceria(criado, agora), "há 16 dias");
  assert.equal(maisAntigoParceria(criado, agora), "mais antigo há 16 dias");
  // Bordas: logo antes e logo depois de completar 17 dias; e o mesmo dia.
  assert.equal(idadePedidoParceria(criado, new Date(Date.parse(criado) + 17 * 86_400_000 - 60_000)), "há 16 dias");
  assert.equal(idadePedidoParceria(criado, new Date(Date.parse(criado) + 17 * 86_400_000)), "há 17 dias");
  assert.equal(idadePedidoParceria(criado, new Date(Date.parse(criado) + 3 * 3_600_000)), "hoje");
  assert.equal(maisAntigoParceria(criado, new Date(Date.parse(criado) + 3 * 3_600_000)), "mais antigo de hoje");
  assert.equal(maisAntigoParceria(null, agora), null);
  assert.equal(maisAntigoParceria("lixo", agora), null);
  // O texto da Visão geral é o da Pendentes com "mais antigo" na frente, para qualquer idade.
  for (const h of [0, 5, 23.9, 24, 47, 48, 60, 397.4, 398.2, 407.9, 408]) {
    const t = new Date(Date.parse(criado) + h * 3_600_000);
    const idade = idadePedidoParceria(criado, t);
    assert.equal(maisAntigoParceria(criado, t), idade === "hoje" ? "mais antigo de hoje" : `mais antigo ${idade}`, `${h} h`);
  }
});

test("E234: as duas telas usam a MESMA função (Pendentes e as duas linhas de parceria da Visão geral)", () => {
  const pagina = ler("src/app/(dashboard)/admin/parceiros/page.tsx");
  assert.match(pagina, /idade: idadePedidoParceria\(s\.criado_em as string, new Date\(agora\)\)/);
  assert.doesNotMatch(ler("src/app/(dashboard)/admin/parceiros/fichas.tsx"), /textoHaDias\(/);
  const decisoes = ler("src/lib/data/admin-decisoes.ts");
  for (const fn of ["parceriasSemResposta1Dia", "parceriasPendentes"]) {
    const ini = decisoes.indexOf(`async function ${fn}(`);
    const corpo = decisoes.slice(ini, decisoes.indexOf("\n}\n", ini));
    assert.match(corpo, /detalhe: maisAntigoParceria\(linhas\[0\]\?\.criado_em, agora\)/, fn);
    assert.doesNotMatch(corpo, /maisAntigo\(/, fn);
  }
  assert.match(decisoes, /ler\(parceriasPendentes\(admin, agora\)\)/);
  // A idade sai SÓ de fila-pendentes.ts: nenhuma outra conta de dias para pedido de parceria.
  assert.equal((ler("src/lib/parceiros/fila-pendentes.ts").match(/86_400_000/g) ?? []).length, 1);
});
