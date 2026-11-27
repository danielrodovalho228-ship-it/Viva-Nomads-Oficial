/*
  E1201 (ORDEM-DUET-968/970) — o assistente de fecho monta um estado NOVO para cada estadia.
  Antes: `<ClosingFlow ctx={realCtx} />` sem `key`. "Abrir fechamento" na lista é navegação no cliente para a mesma
  página: o React reaproveitava a instância do assistente e todo o estado atravessava de um fecho para o outro — a data
  de início (que ALIMENTA o contrato gerado), o prazo, os ocupantes, o passo, o verificado, o "gerado", o contrato
  existente, a URL de assinatura e o id do contrato. Na ronda das 18h, o assistente da ORC-2026-0015 abriu com a data
  de início da ORC-2026-0018 (o fecho aberto por omissão).
  Depois: o assistente é montado com `key` da candidatura + proposta; cada estadia nasce com o seu estado.
  Roda: node --test src/lib/fechamento/e1201-assistente-monta-por-estadia.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fonteSemComentarios } from "../fonte-sem-comentarios.ts";

const cliente = fonteSemComentarios(readFileSync("src/app/(dashboard)/dashboard/fechamento/closing-client.tsx", "utf8"));

test("o assistente real é montado com key da candidatura E da proposta (uma instância por estadia)", () => {
  const usos = cliente.match(/<ClosingFlow\b[^>]*ctx=\{realCtx\}[^>]*\/>/g) ?? [];
  assert.equal(usos.length, 1, "um só ponto monta o assistente real");
  assert.match(usos[0], /key=\{`\$\{realCtx\.leadId\}:\$\{realCtx\.proposta\?\.id \?\? ""\}`\}/, "a key leva a candidatura e a proposta");
});

test("o estado do assistente nasce do contexto (por isso a key basta para trocar de estadia)", () => {
  const fluxo = fonteSemComentarios(readFileSync("src/app/(dashboard)/dashboard/fechamento/closing-flow.tsx", "utf8"));
  assert.match(fluxo, /const \[inicioISO, setInicioISO\] = useState\(ctx\.inicioSugerido \?\? hoje\);/, "a data de início nasce da estadia aberta");
  assert.match(fluxo, /const \[prazoMeses, setPrazoMeses\] = useState\(ACORDO \? ACORDO\.meses : /, "o prazo nasce da proposta aberta");
});
