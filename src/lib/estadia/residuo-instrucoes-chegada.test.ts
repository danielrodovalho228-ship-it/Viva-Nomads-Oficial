/*
  Varredura ampliada — e-mails de chegada (médio-baixo). As leituras das instruções de chegada não conferiam o erro:
   - D-7 (instruções liberadas) e D-2/D-1 (lembretes): na falha, o morador lia "O proprietário ainda não preencheu as
     instruções de chegada" — com as instruções preenchidas;
   - D-10 (lembrete ao dono): na falha, o dono era cobrado de instruções que já preencheu;
   - D-2/D-1: a leitura de contratos_checkin é a trava "já enviado"; na falha, o lembrete saía DE NOVO.
  Agora: instrução não lida → o e-mail diz que elas estão na página da estadia (nunca "não preencheu"); o lembrete ao
  dono não sai; a trava não lida pula o contrato ("melhor perder um lembrete do que mandar dois").
  Roda: node --test src/lib/estadia/residuo-instrucoes-chegada.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { corpoDaChegada, INSTRUCOES_NA_PAGINA, SEM_INSTRUCOES } from "./emails-chegada.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const E = { imovel: { titulo: "Studio Centro", bairro: "Centro", cidade: "Uberlândia" }, entrada: "2026-11-10" };

test("instruções não lidas: o e-mail aponta a página da estadia, nunca 'não preencheu'", () => {
  const c = corpoDaChegada(E, "sem_leitura", true);
  assert.ok(c.texto.includes(INSTRUCOES_NA_PAGINA));
  assert.ok(!c.texto.includes(SEM_INSTRUCOES));
  // Sem instruções de verdade (lidas e vazias), segue o aviso de sempre.
  assert.ok(corpoDaChegada(E, null, true).texto.includes(SEM_INSTRUCOES));
});

test("cron das automações: D-7 marca 'sem_leitura' na falha; o lembrete D-10 ao dono não sai na falha", () => {
  const r = ler("src/app/api/cron/automacoes/route.ts");
  const d7 = r.slice(r.indexOf("if (liberaHoje(condicao, agora))"), r.indexOf("if (prop?.owner_id && diasEntre"));
  assert.match(d7, /\{ data: im, error: erroIm \}, \{ data: ck, error: erroCk \}/);
  assert.match(d7, /const instrucoes = erroIm \|\| erroCk \? \("sem_leitura" as const\) :/);
  const d10 = r.slice(r.indexOf("if (prop?.owner_id && diasEntre"), r.indexOf("const contagem"));
  assert.match(d10, /\{ data: im, error: erroIm \}, \{ data: ck, error: erroCk \}/);
  assert.match(d10, /if \(!erroIm && !erroCk && lembrarDono\(/);
});

test("lembretes D-2/D-1: a trava não lida pula o contrato; instrução não lida → 'sem_leitura'", () => {
  const r = ler("src/app/api/cron/checkin-lembretes/route.ts");
  assert.match(r, /const \{ data: k, error: erroTrava \} = await admin\.from\("contratos_checkin"\)/);
  assert.ok(r.indexOf("if (erroTrava) continue;") < r.indexOf(".upsert("), "pula antes de marcar e enviar");
  assert.match(r, /const \{ data: im, error: erroIm \} = await admin\.from\("imovel_instrucoes_chegada"\)/);
  assert.match(r, /const instrucoes = erroIm \? \("sem_leitura" as const\) :/);
});
