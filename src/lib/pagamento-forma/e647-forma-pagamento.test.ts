/*
  E647 — a FORMA DE PAGAMENTO é escolha do DONO (Daniel, 06/11/2026, por voz): bloco completo, mensal ou ambos, nas duas faixas
  (30–90 e 91–180 dias). A Viva constrói as ferramentas e NÃO impõe a forma; o desenho anterior (bloco até 90, mensal de 91 a 180)
  vira o padrão pré-selecionado. Só a parte NEUTRA, atrás da chave FORMA_PAGAMENTO_DONO_ATIVA (desligada): nada de atraso, status
  de inadimplência, encargos ou notificação formal (travados até o parecer da Dra. Beatriz).
  Roda: node --test src/lib/pagamento-forma/e647-forma-pagamento.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ESCOLHA_PADRAO,
  FAIXAS,
  FORMAS,
  PADRAO_RECOMENDADO,
  cronogramaPorForma,
  faixaDaEstadia,
  formasDaEstadia,
  linhaFormaPagamento,
  momentoDaTaxa,
  normalizarEscolha,
  textoParaMorador,
} from "./regras.ts";
import { MIN_DIAS_COBRANCA_MENSAL, cronogramaMensal } from "../cobranca-mensal/regras.ts";
import { GRUPOS_DETALHE, linhasDetalhes, normalizarDetalhes } from "../anuncio/detalhes-anuncio.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("três formas, duas faixas, e o desenho anterior é o padrão recomendado (bloco até 90, mensal de 91 a 180)", () => {
  assert.deepEqual([...FORMAS], ["bloco", "mensal", "ambos"]);
  assert.deepEqual(FAIXAS.map((f) => [f.id, f.min, f.max]), [["ate_90", 30, 90], ["de_91", 91, 180]]);
  assert.deepEqual(PADRAO_RECOMENDADO, { ate_90: "bloco", de_91: "mensal" });
  assert.deepEqual(ESCOLHA_PADRAO, { ate_90: "bloco", de_91: "mensal" });
});

test("a faixa da estadia pelos dias: 30–90 e 91–180; fora disso não tem faixa", () => {
  assert.equal(faixaDaEstadia(29), null);
  assert.equal(faixaDaEstadia(30), "ate_90");
  assert.equal(faixaDaEstadia(90), "ate_90");
  assert.equal(faixaDaEstadia(91), "de_91");
  assert.equal(faixaDaEstadia(180), "de_91");
  assert.equal(faixaDaEstadia(181), null);
  assert.equal(faixaDaEstadia(Number.NaN), null);
});

test("normalizar a escolha: lixo vira nada; faixa que falta ou é inválida cai no padrão recomendado; o que é válido fica", () => {
  for (const ruim of [null, undefined, "bloco", 3, [], {}, { ate_90: "pix" }, { x: 1 }]) assert.equal(normalizarEscolha(ruim), null, JSON.stringify(ruim));
  assert.deepEqual(normalizarEscolha({ ate_90: "ambos" }), { ate_90: "ambos", de_91: "mensal" });
  assert.deepEqual(normalizarEscolha({ de_91: "bloco" }), { ate_90: "bloco", de_91: "bloco" });
  assert.deepEqual(normalizarEscolha({ ate_90: "mensal", de_91: "ambos" }), { ate_90: "mensal", de_91: "ambos" });
  assert.deepEqual(normalizarEscolha({ ate_90: "mensal", de_91: "xx", extra: 1 }), { ate_90: "mensal", de_91: "mensal" });
});

test("as formas que o morador pode usar numa estadia: 'ambos' oferece as duas; sem escolha do dono vale o padrão", () => {
  assert.deepEqual(formasDaEstadia({ ate_90: "ambos", de_91: "bloco" }, 60), ["bloco", "mensal"]);
  assert.deepEqual(formasDaEstadia({ ate_90: "ambos", de_91: "bloco" }, 120), ["bloco"]);
  assert.deepEqual(formasDaEstadia({ ate_90: "mensal", de_91: "ambos" }, 45), ["mensal"]);
  assert.deepEqual(formasDaEstadia(null, 60), ["bloco"]);
  assert.deepEqual(formasDaEstadia(null, 150), ["mensal"]);
  assert.deepEqual(formasDaEstadia({ ate_90: "ambos", de_91: "ambos" }, 10), []);
});

test("a taxa da Viva segue a forma: bloco na assinatura, mensal mês a mês", () => {
  assert.equal(momentoDaTaxa("bloco"), "assinatura");
  assert.equal(momentoDaTaxa("mensal"), "mes_a_mes");
});

test("o que o morador lê: as duas faixas com a forma do dono, antes da proposta — sem prometer nem ameaçar", () => {
  const t = textoParaMorador({ ate_90: "ambos", de_91: "mensal" });
  assert.match(t.titulo, /forma de pagamento/i);
  assert.equal(t.linhas.length, 2);
  assert.match(t.linhas[0], /30 a 90 dias/);
  assert.match(t.linhas[0], /bloco completo ou mensal/i);
  assert.match(t.linhas[1], /91 a 180 dias/);
  assert.match(t.linhas[1], /mensal/i);
  assert.match(t.nota, /proprietário/i);
  assert.match(t.nota, /diretamente/i);
  const tudo = [t.titulo, ...t.linhas, t.nota].join(" ");
  assert.doesNotMatch(tudo, /atras|multa|juros|inadimpl|encargo|cobran[çc]a judicial|negativ/i);
  assert.equal(linhaFormaPagamento(null), null);
  assert.ok(linhaFormaPagamento({ ate_90: "bloco", de_91: "mensal" }));
});

test("cronograma por forma — bloco: uma parcela na assinatura, com a taxa sobre o valor do bloco; sem valor do bloco, não inventa", () => {
  const ok = cronogramaPorForma({ forma: "bloco", checkin: "2026-12-01", checkout: "2027-01-30", aluguelMensal: 3000, taxa: 0.1, valorBloco: 6000 });
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.parcelas.length, 1);
    assert.deepEqual([ok.parcelas[0].tipo, ok.parcelas[0].venceEm, ok.parcelas[0].valor, ok.parcelas[0].taxaViva], ["bloco", "assinatura", 6000, 600]);
  }
  assert.equal(cronogramaPorForma({ forma: "bloco", checkin: "2026-12-01", checkout: "2027-01-30", aluguelMensal: 3000, taxa: 0.1 }).ok, false);
});

test("cronograma por forma — mensal vale também de 30 a 90 dias; de 91 a 180 é igual ao do E641; o E641 puro segue recusando menos de 91", () => {
  const curto = cronogramaPorForma({ forma: "mensal", checkin: "2026-12-01", checkout: "2027-01-30", aluguelMensal: 3000, taxa: 0.1 });
  assert.ok(curto.ok);
  if (curto.ok) assert.ok(curto.parcelas.length >= 2);
  const longo = { checkin: "2026-12-01", checkout: "2027-04-15", aluguelMensal: 3000, taxa: 0.1 };
  assert.deepEqual(cronogramaPorForma({ forma: "mensal", ...longo }), cronogramaMensal(longo));
  assert.equal(cronogramaMensal({ checkin: "2026-12-01", checkout: "2027-01-30", aluguelMensal: 3000, taxa: 0.1 }).ok, false, "E641 intacto");
  assert.equal(MIN_DIAS_COBRANCA_MENSAL, 91);
  const curtinho = cronogramaPorForma({ forma: "mensal", checkin: "2026-12-01", checkout: "2026-12-20", aluguelMensal: 3000, taxa: 0.1 });
  assert.equal(curtinho.ok, false, "menos de 30 dias fica fora");
});

test("fica em detalhes_anuncio.pagamento: normalizado ao gravar, fora dos grupos com toggle e fora das linhas de detalhe", () => {
  assert.deepEqual(normalizarDetalhes({ pagamento: { ate_90: "ambos" } })?.pagamento, { ate_90: "ambos", de_91: "mensal" });
  assert.equal(normalizarDetalhes({ pagamento: "lixo" }), null);
  assert.ok(!GRUPOS_DETALHE.some((g) => (g.chave as string) === "pagamento"));
  assert.deepEqual(linhasDetalhes({ pagamento: { ate_90: "ambos", de_91: "ambos" } }), []);
});

test("INERTE com a chave desligada: a chave só liga com 'on', o servidor guarda o que já estava, e a tela e o anúncio não mostram nada", () => {
  const flags = ler("src/lib/flags.ts");
  assert.match(flags, /export const FORMA_PAGAMENTO_DONO_ATIVA = process\.env\.NEXT_PUBLIC_FORMA_PAGAMENTO_DONO_ATIVA === "on";/);
  assert.match(ler("src/config/chaves-ambiente.ts"), /nome: "FORMA_PAGAMENTO_DONO_ATIVA"[\s\S]*?NEXT_PUBLIC_FORMA_PAGAMENTO_DONO_ATIVA/);
  const acoes = ler("src/lib/data/actions.ts");
  assert.match(acoes, /FORMA_PAGAMENTO_DONO_ATIVA \? \(pagamentoEnviado \?\? pagamentoGravado\) : pagamentoGravado/);
  assert.match(ler("src/components/property/stay-rules.tsx"), /FORMA_PAGAMENTO_DONO_ATIVA \? normalizarEscolha\(/);
  const editor = ler("src/app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx");
  assert.match(editor, /FORMA_PAGAMENTO_DONO_ATIVA && <FormaPagamentoCampo/);
  assert.match(editor, /\.\.\.\(FORMA_PAGAMENTO_DONO_ATIVA \? \{ pagamento \} : \{\}\)/);
});

test("fora do escopo, de propósito: nenhuma palavra de atraso/encargo no módulo, e a cobrança mensal (E641) continua sob a SUA chave", () => {
  // O cabeçalho do módulo cita o que fica de fora; o que vale é o código e o texto que ele produz.
  const modulo = ler("src/lib/pagamento-forma/regras.ts").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(modulo, /atras|multa|juros|inadimpl|encargo|notifica[çc][ãa]o formal/i);
  for (const f of ["src/lib/cobranca-mensal/servidor.ts", "src/lib/cobranca-mensal/acoes.ts", "src/app/api/cron/cobranca-mensal/route.ts"]) {
    assert.doesNotMatch(ler(f), /pagamento-forma|FORMA_PAGAMENTO_DONO_ATIVA/, f);
  }
  assert.match(ler("src/lib/flags.ts"), /COBRANCA_MENSAL_ATIVA = process\.env\.NEXT_PUBLIC_COBRANCA_MENSAL_ATIVA === "on"/);
});
