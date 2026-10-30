/*
  E202 (candidatura, QA do Muse 29/10): os três e-mails do caminho da candidatura com os dados do pedido.
  Roda: node --test src/lib/notifications/dados-candidatura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aberturaCandidatura, linhasCandidatura, linkCandidaturaDono, linkCandidaturaMorador, periodoDaCandidatura, proximoPassoCandidatura } from "./dados-candidatura.ts";
import { prazoInicial } from "../inicio-estadia.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const imovel = { titulo: "[TESTE QA NÍVEL] Premium", bairro: "Santa Mônica", cidade: "Uberlândia" };

test("quadro: imóvel · interessado · entrada/saída · valor mensal · total por mês · total da estadia (a prova do Muse)", () => {
  const l = linhasCandidatura({ imovel, interessado: "Ana", entrada: "2026-11-15", saida: "2026-12-15", valorMensal: 3200, totalMensal: 3340 });
  assert.deepEqual(l, [
    { rotulo: "Imóvel", valor: "[TESTE QA NÍVEL] Premium · Santa Mônica, Uberlândia" },
    { rotulo: "Interessado", valor: "Ana" },
    { rotulo: "Entrada", valor: "15/11/2026" },
    { rotulo: "Saída", valor: "15/12/2026 (30 dias)" },
    { rotulo: "Valor mensal", valor: "R$ 3.200" },
    { rotulo: "Total por mês", valor: "R$ 3.340" },
    { rotulo: "Total da estadia", valor: "R$ 3.340 em 1 mês" },
  ]);
});

test("sem datas: 'A combinar com o proprietário' e nenhum total da estadia inventado", () => {
  const l = linhasCandidatura({ imovel, interessado: "", entrada: null, saida: null, valorMensal: 3200, totalMensal: 3340 });
  assert.equal(l.find((x) => x.rotulo === "Entrada")?.valor, "A combinar com o proprietário");
  assert.equal(l.find((x) => x.rotulo === "Saída")?.valor, "A combinar com o proprietário");
  assert.equal(l.find((x) => x.rotulo === "Interessado")?.valor, "Interessado");
  assert.equal(l.some((x) => x.rotulo === "Total da estadia"), false);
});

test("período: 30 dias = 1 mês, arredonda para cima; saída antes da entrada não vale", () => {
  assert.deepEqual(periodoDaCandidatura("2026-11-15", "2026-12-15"), { dias: 30, meses: 1 });
  assert.deepEqual(periodoDaCandidatura("2026-11-15", "2027-02-20"), { dias: 97, meses: 4 });
  assert.equal(periodoDaCandidatura("2026-11-15", "2026-11-15"), null);
  assert.equal(periodoDaCandidatura("2026-11-15", null), null);
});

test("abertura e próximo passo de cada momento dizem o imóvel e o que fazer", () => {
  assert.equal(aberturaCandidatura("nova", { nome: "Daniel", imovel, interessado: "Ana" }), "Olá Daniel, Ana enviou uma candidatura para [TESTE QA NÍVEL] Premium. Os dados do pedido estão abaixo.");
  assert.match(aberturaCandidatura("enviada", { nome: "Ana", imovel }), /^Olá Ana, sua candidatura para \[TESTE QA NÍVEL\] Premium foi enviada\./);
  assert.match(aberturaCandidatura("aceita", { imovel }), /^Olá, o proprietário aceitou sua candidatura para \[TESTE QA NÍVEL\] Premium\./);
  assert.match(proximoPassoCandidatura("nova"), /Interessados/);
  assert.match(proximoPassoCandidatura("enviada"), /Minhas candidaturas/);
  assert.match(proximoPassoCandidatura("aceita"), /Mensagens[\s\S]*Fechamento/);
});

test("links desta candidatura (não a lista genérica) e o cartão tem a âncora", () => {
  assert.equal(linkCandidaturaDono("abc"), "/dashboard/leads#candidato-abc");
  assert.equal(linkCandidaturaMorador("abc"), "/dashboard/candidaturas#candidatura-abc");
  assert.match(ler("src/app/(dashboard)/dashboard/leads/leads-client.tsx"), /id=\{`candidato-\$\{l\.id\}`\}/);
  assert.match(ler("src/app/(dashboard)/dashboard/candidaturas/page.tsx"), /id=\{`candidatura-\$\{c\.id\}`\}/);
});

test("guarda: os três momentos da candidatura usam o corpo com dados (envio ao dono, confirmação ao morador, aceite)", () => {
  const acoes = ler("src/lib/data/actions.ts");
  assert.match(acoes, /corpoDoEmailDaCandidatura\(adm, leadId, "nova"\)/);
  assert.match(acoes, /pushUrl: corpo && leadId \? linkCandidaturaDono\(leadId\) : "\/dashboard\/leads"/);
  assert.match(acoes, /corpoDoEmailDaCandidatura\(adm, leadId, "enviada"\)[\s\S]{0,200}event: "application_received"[\s\S]{0,200}pushUrl: linkCandidaturaMorador\(leadId\)/);
  // A saída da candidatura vai ao banco (0258) e o pedido manda a saída escolhida.
  assert.match(acoes, /\.\.\.\(fimOk \? \{ fim_desejado: fim \} : \{\}\)/);
  assert.match(ler("src/app/(public)/imoveis/[id]/property-detail.tsx"), /kind === "candidatura" && selecao\.saida \? selecao\.saida : undefined\)/);
  const leads = ler("src/lib/data/leads-actions.ts");
  assert.match(leads, /corpoDoEmailDaCandidatura\(admin, leadId, "aceita"\)/);
  // A confirmação é do morador na matriz.
  assert.match(ler("src/config/matriz-notificacoes.ts"), /application_received: \{ categoria: "outros", papeis: \["morador"\]/);
  // A 0258 existe com o aplicar idempotente e o rollback.
  assert.match(ler("supabase/producao/aplicar-0258.sql"), /add column if not exists fim_desejado date[\s\S]*'0258_leads_fim_desejado'[\s\S]*commit;/);
  assert.match(ler("supabase/producao/rollback/0258_rollback.sql"), /drop column if exists fim_desejado/);
});

test("(b) Fechamento abre com os meses do período da candidatura aceita (1 mês, não 4)", () => {
  const lim = { padrao: 4, min: 1, max: 6 };
  assert.equal(prazoInicial(1, lim), 1);
  assert.equal(prazoInicial(9, lim), 6);
  assert.equal(prazoInicial(null, lim), 4);
  assert.equal(prazoInicial(undefined, lim), 4);
  assert.match(ler("src/app/(dashboard)/dashboard/fechamento/closing-flow.tsx"), /useState\(ACORDO \? ACORDO\.meses : prazoInicial\(ctx\.mesesSugerido,/);
  assert.match(ler("src/lib/data/leads-actions.ts"), /mesesSugerido = periodoDaCandidatura\(inicioDesejado, \(d\?\.fim_desejado as string \| null\) \?\? null\)\?\.meses \?\? null;/);
});

test("(a) anúncio de teste: sem a faixa de visitante enquanto a sessão/perfil carregam", () => {
  const tela = ler("src/app/(public)/imoveis/[id]/property-detail.tsx");
  assert.match(tela, /const aguardandoPerfil = modoTeste === "visitante" && \(!authChecked \|\| \(!!usuario && usuario\.isTeste === undefined\)\);/);
  assert.match(tela, /\{modoTeste && !aguardandoPerfil && \(/);
  assert.match(tela, /aguardando=\{aguardandoPerfil\}/);
  // O isTeste chega com qualquer perfil lido.
  assert.match(ler("src/components/auth-provider.tsx"), /if \(profile\) \{/);
});
