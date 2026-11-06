/*
  E647 (refino, Daniel 06/11/2026): a escolha da forma de pagamento existe em DOIS momentos — (1) a preferência no anúncio e
  (2) NA HORA DA PROPOSTA: ao responder ao orçamento, o dono aceita a forma pedida ou propõe a outra, sempre dentro das faixas
  legais (91–180 dias: mensal até o parecer; bloco nessa faixa nasce BLOQUEADO). O morador vê a forma final ANTES de aceitar.
  Tudo atrás de FORMA_PAGAMENTO_DONO_ATIVA (desligada). Sem atraso/encargos (travados até o parecer da Dra. Beatriz).
  Roda: node --test src/lib/pagamento-forma/e647-proposta.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BLOCO_91_180_BLOQUEADO, formaAlternativa, formaInicialDaProposta, formasPermitidas, textoFormaFinal, validarFormaNaProposta } from "./regras.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

test("o bloco em 91–180 dias nasce bloqueado (até o parecer): mesmo o dono tendo escolhido 'bloco' ou 'ambos'", () => {
  assert.equal(BLOCO_91_180_BLOQUEADO, true);
  assert.deepEqual(formasPermitidas({ ate_90: "ambos", de_91: "ambos" }, 120), ["mensal"]);
  assert.deepEqual(formasPermitidas({ ate_90: "ambos", de_91: "bloco" }, 120), [], "só bloco numa faixa bloqueada: nada a oferecer");
  assert.deepEqual(formasPermitidas({ ate_90: "ambos", de_91: "mensal" }, 120), ["mensal"]);
  assert.deepEqual(formasPermitidas({ ate_90: "ambos", de_91: "mensal" }, 60), ["bloco", "mensal"]);
  assert.deepEqual(formasPermitidas(null, 60), ["bloco"], "sem escolha vale o padrão recomendado");
  assert.deepEqual(formasPermitidas(null, 150), ["mensal"]);
});

test("o dono responde ao orçamento: aceita a forma pedida OU propõe a outra, dentro da lei", () => {
  const escolha = { ate_90: "ambos", de_91: "mensal" } as const;
  assert.deepEqual(validarFormaNaProposta({ forma: "mensal", dias: 60, escolha, quem: "owner" }), { ok: true, forma: "mensal" });
  assert.deepEqual(validarFormaNaProposta({ forma: "bloco", dias: 60, escolha, quem: "owner" }), { ok: true, forma: "bloco" });
  // O dono pode propor a outra mesmo quando a preferência do anúncio era outra (a escolha é dele, também na hora).
  assert.deepEqual(validarFormaNaProposta({ forma: "bloco", dias: 60, escolha: { ate_90: "mensal", de_91: "mensal" }, quem: "owner" }), { ok: true, forma: "bloco" });
  // 91–180: bloco bloqueado para os dois lados.
  const b = validarFormaNaProposta({ forma: "bloco", dias: 120, escolha, quem: "owner" });
  assert.equal(b.ok, false);
  assert.match(!b.ok ? b.erro : "", /91 a 180 dias.*mensal/);
  assert.equal(validarFormaNaProposta({ forma: "mensal", dias: 120, escolha, quem: "owner" }).ok, true);
});

test("o morador só pede uma forma que o proprietário aceita no anúncio (e dentro da lei)", () => {
  const escolha = { ate_90: "mensal", de_91: "mensal" } as const;
  const r = validarFormaNaProposta({ forma: "bloco", dias: 60, escolha, quem: "tenant" });
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.erro : "", /proprietário não aceita/);
  assert.equal(validarFormaNaProposta({ forma: "mensal", dias: 60, escolha, quem: "tenant" }).ok, true);
  assert.equal(validarFormaNaProposta({ forma: "bloco", dias: 60, escolha: { ate_90: "ambos", de_91: "mensal" }, quem: "tenant" }).ok, true);
});

test("fora das faixas (menos de 30 ou mais de 180 dias) e valores estranhos: recusados", () => {
  assert.equal(validarFormaNaProposta({ forma: "mensal", dias: 20, escolha: null, quem: "owner" }).ok, false);
  assert.equal(validarFormaNaProposta({ forma: "mensal", dias: 200, escolha: null, quem: "owner" }).ok, false);
  assert.equal(validarFormaNaProposta({ forma: "ambos" as never, dias: 60, escolha: null, quem: "owner" }).ok, false, "a proposta final tem UMA forma só");
  assert.equal(validarFormaNaProposta({ forma: "xx" as never, dias: 60, escolha: null, quem: "owner" }).ok, false);
});

test("a outra forma e a forma inicial da proposta", () => {
  assert.equal(formaAlternativa("bloco"), "mensal");
  assert.equal(formaAlternativa("mensal"), "bloco");
  assert.equal(formaInicialDaProposta({ ate_90: "ambos", de_91: "ambos" }, 60), "bloco", "com 'ambos' começa pela recomendada da faixa");
  assert.equal(formaInicialDaProposta({ ate_90: "ambos", de_91: "ambos" }, 120), "mensal");
  assert.equal(formaInicialDaProposta({ ate_90: "mensal", de_91: "mensal" }, 60), "mensal");
  assert.equal(formaInicialDaProposta(null, 60), "bloco");
  assert.equal(formaInicialDaProposta({ ate_90: "ambos", de_91: "bloco" }, 120), "mensal", "faixa bloqueada: cai no mensal, que é o legal");
});

test("o morador lê a forma FINAL com clareza antes de aceitar: quando paga, quando a Viva cobra a taxa, e que o pagamento é direto", () => {
  const m = textoFormaFinal("mensal", 120);
  assert.match(m.titulo, /Mensal/);
  assert.match(m.linhas.join(" "), /mês a mês/);
  assert.match(m.nota, /diretamente ao proprietário/);
  const b = textoFormaFinal("bloco", 60);
  assert.match(b.titulo, /Bloco completo/);
  assert.match(b.linhas.join(" "), /assinatura/);
  assert.doesNotMatch(JSON.stringify([m, b]), /atraso|multa|juros|inadimpl|encargo|notifica/i);
});

test("fiação: atrás da chave desligada nada muda (proposta, resposta e tela só leem a forma com a chave ligada)", () => {
  const acoes = ler("../data/propostas-actions.ts");
  assert.match(acoes, /FORMA_PAGAMENTO_DONO_ATIVA/);
  assert.match(acoes, /validarFormaNaProposta\(/);
  const servidor = ler("../data/propostas-servidor.ts");
  assert.match(servidor, /forma_pagamento/);
  assert.match(servidor, /\.\.\.\(t\.formaPagamento \? \{ forma_pagamento: t\.formaPagamento \} : \{\}\)/, "só grava a coluna quando há forma (chave desligada = linha idêntica à de antes)");
  const mig = readFileSync(new URL("../../../supabase/migrations/0314_proposta_forma_pagamento_e647.sql", import.meta.url), "utf8");
  const ap = readFileSync(new URL("../../../supabase/producao/aplicar-0314.sql", import.meta.url), "utf8");
  const rb = readFileSync(new URL("../../../supabase/producao/rollback/0314_rollback.sql", import.meta.url), "utf8");
  assert.match(mig, /add column if not exists forma_pagamento text/);
  assert.match(mig, /check \(forma_pagamento is null or forma_pagamento in \('bloco', 'mensal'\)\)/);
  assert.match(ap, /^begin;/m);
  assert.match(ap, /0314_proposta_forma_pagamento_e647/);
  assert.match(ap, /commit;\s*$/);
  assert.match(rb, /0314/);
});
