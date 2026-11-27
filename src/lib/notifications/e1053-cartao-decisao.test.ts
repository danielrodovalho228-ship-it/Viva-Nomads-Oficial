/*
  E1053 — trava: o cartão de decisão do dono (Interessados, antes de Aceitar/Recusar) mostra Entrada, Saída e Total da
  estadia IGUAIS aos da confirmação da candidatura (o quadro do e-mail "enviada", linhasCandidatura) — a mesma função,
  a mesma fonte. E continua SEM nome nem foto antes do aceite (ORDEM-285: o E427 e a promessa na Conta ficam).
  Roda: node --test src/lib/notifications/e1053-cartao-decisao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decisaoDaCandidatura, linhasCandidatura, type DadosCandidatura } from "./dados-candidatura.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const imovel = { id: "p1", titulo: "Apto", bairro: "Centro", cidade: "Uberlândia" };
const casos: { nome: string; d: DadosCandidatura }[] = [
  { nome: "com período e estadia em dias", d: { imovel, interessado: "Ana", entrada: "2026-11-15", saida: "2026-12-28", valorMensal: 3000, totalMensal: 3400, estadiaDias: { dias: 43, total: 4873.33, rotulo: "Total da estadia (43 dias)", periodo: "1 mês + 13 dias", conta: "x" } } },
  { nome: "com período, sem estadia em dias", d: { imovel, interessado: "Ana", entrada: "2026-11-15", saida: "2026-12-15", valorMensal: 3000, totalMensal: 3400 } },
  { nome: "sem datas", d: { imovel, interessado: "Ana", valorMensal: 3000, totalMensal: 3400 } },
];

test("E1053 — Entrada, Saída e Total da estadia do cartão = os da confirmação (mesma função)", () => {
  for (const { nome, d } of casos) {
    const cartao = decisaoDaCandidatura(d);
    const linhas = linhasCandidatura(d);
    assert.equal(cartao.entrada, linhas.find((l) => l.rotulo === "Entrada")?.valor, nome);
    assert.equal(cartao.saida, linhas.find((l) => l.rotulo === "Saída")?.valor, nome);
    const total = linhas.find((l) => l.rotulo.startsWith("Total da estadia"))?.valor ?? null;
    assert.equal(cartao.total, total, nome);
  }
  assert.equal(decisaoDaCandidatura(casos[2].d).total, null); // sem período, nunca um total inventado
});

test("E1053 — o servidor monta a decisão pela mesma leitura do e-mail; o cartão mostra os três rótulos", () => {
  const leads = ler("lib/data/leads.ts");
  assert.match(leads, /decisaoDaCandidatura\(/);
  assert.match(leads, /dadosDoImovelDaCandidatura\(/);
  const email = ler("lib/data/candidatura-email.ts");
  assert.match(email, /export async function dadosDoImovelDaCandidatura\(/);
  const cartao = ler("app/(dashboard)/dashboard/leads/leads-client.tsx");
  assert.match(cartao, /data-testid="decisao-entrada"/);
  assert.match(cartao, /data-testid="decisao-saida"/);
  assert.match(cartao, /data-testid="decisao-total"/);
  assert.match(cartao, />Entrada</);
  assert.match(cartao, />Saída</);
  assert.match(cartao, />Total da estadia</);
});

test("E1053 — antes do aceite: sem nome nem foto (\"Candidato(a)\" fica; E427 e a promessa da Conta intactos)", () => {
  const leads = ler("lib/data/leads.ts");
  // o nome e a foto continuam a sair de cartaoCandidato, com o aceite como condição
  assert.match(leads, /name: cartao\.titulo,/);
  assert.match(leads, /fotoUrl: cartao\.fotoUrl,/);
  assert.match(leads, /r\.status === "accepted",\s*\);/);
  const conta = ler("components/account/conta-blocos.tsx");
  assert.match(conta, /o proprietário vê &quot;Candidato\(a\)&quot;, sem nome nem foto/);
});
