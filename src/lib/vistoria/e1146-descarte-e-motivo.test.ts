import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LIMITE_MOTIVO_DA_FILA, fechoDaDesignacaoAoDevolver, motivoSemAvaliador } from "./regras.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

/*
  E1146 (ORDENS-DUET 628 e 631). Duas partes que não dependem da decisão "o descartado volta à lista?":
   a) O REGISTO DO DESCARTE. O dono que descartava a proposta ("Escolher outro avaliador", E1100) devolvia o pedido à
      escolha, mas a designação continuava a dizer "aceita" para sempre (caso VN-1202DF). A regra: quando o pedido
      volta ao dono, a designação NUNCA fica "aceita" — fica com o que aconteceu, e o descarte leva a marca própria
      (proposta_descartada_em, migração 0360), para não se ler como recusa do avaliador.
   b) O MOTIVO NA FILA DO ADMIN. Sem ninguém para o dono escolher, o item "sem avaliador" dizia só "Nenhum avaliador
      disponível…" e ninguém lia por que regra (casos VN-F6CDC7 e VN-BD237F: a avaliação anterior do imóvel era do
      único avaliador da cidade). Passa a dizer, por avaliador, a regra que o impede.
*/
const ler = (p: string) => readFileSync(p, "utf8");

test("E1146 (a): o dono descarta a proposta — a designação deixa de dizer 'aceita' e leva a marca do descarte", () => {
  assert.deepEqual(fechoDaDesignacaoAoDevolver("aceita", "descartada"), { resposta: "recusada", descartada: true });
});

test("E1146 (a): a divergência não nasce pelo dono nem pelo avaliador — com a designação 'aceita', o descarte, a recusa e a ausência mudam-na", () => {
  for (const motivo of ["recusada", "ausencia", "descartada"] as const) {
    const f = fechoDaDesignacaoAoDevolver("aceita", motivo);
    assert.ok(f, `"aceita" + ${motivo}: a designação tem de mudar`);
    assert.notEqual(f.resposta, "aceita");
  }
  // O avaliador recusa depois de já ter proposto (tela antiga aberta): é recusa DELE, sem a marca do dono.
  assert.deepEqual(fechoDaDesignacaoAoDevolver("aceita", "recusada"), { resposta: "recusada", descartada: false });
  // A proposta que vence é do E1142: registrarPropostaExpirada grava "expirada" com a marca ANTES de devolver, e só
  // ela põe essa marca (trava do E1143). Aqui a designação com proposta não é tocada pela expiração.
  assert.equal(fechoDaDesignacaoAoDevolver("aceita", "expirada"), null);
  assert.equal(fechoDaDesignacaoAoDevolver("expirada", "expirada"), null);
});

test("E1146 (a): o que já valia continua — a designação sem resposta recebe o motivo; a já terminada não é reescrita", () => {
  assert.deepEqual(fechoDaDesignacaoAoDevolver(null, "recusada"), { resposta: "recusada", descartada: false });
  assert.deepEqual(fechoDaDesignacaoAoDevolver(null, "expirada"), { resposta: "expirada", descartada: false }, "o silêncio do avaliador não leva marca nenhuma");
  assert.equal(fechoDaDesignacaoAoDevolver("recusada", "descartada"), null);
  assert.equal(fechoDaDesignacaoAoDevolver("expirada", "recusada"), null);
  // A ausência vale sobre qualquer resposta, como sempre.
  for (const atual of [null, "aceita", "recusada", "expirada"]) assert.deepEqual(fechoDaDesignacaoAoDevolver(atual, "ausencia"), { resposta: "ausencia", descartada: false });
});

test("E1146 (a): o servidor grava o descarte — recusarProposta devolve como 'descartada' e devolverAoDono usa a regra", () => {
  const acoes = semComentarios(ler("src/lib/vistoria/actions.ts"));
  const recusar = acoes.slice(acoes.indexOf("export async function recusarProposta"), acoes.indexOf("export async function agendarVisita"));
  assert.match(recusar, /devolverAoDono\([^)]*"descartada"/, "o descarte do dono não é uma recusa do avaliador");
  const servidor = semComentarios(ler("src/lib/vistoria/servidor.ts"));
  const devolver = servidor.slice(servidor.indexOf("export async function devolverAoDono"), servidor.indexOf("export async function registrarPropostaExpirada"));
  assert.match(devolver, /fechoDaDesignacaoAoDevolver\(/);
  assert.match(devolver, /proposta_descartada_em/);
  assert.doesNotMatch(devolver, /proposta_expirada_em/, "a marca da proposta vencida continua a ser só do registo do E1142");
  assert.doesNotMatch(devolver, /\.is\("resposta", null\)/, "a escrita já não se limita à designação sem resposta");
});

test("E1146 (a): o descarte não aparece como recusa do avaliador — nem na lista dele, nem na Central", () => {
  const lista = semComentarios(ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx"));
  assert.match(lista, /proposta_descartada_em/);
  assert.match(lista, /ROTULO_PROPOSTA_DESCARTADA/);
  const central = semComentarios(ler("src/app/(dashboard)/admin/avaliadores/page.tsx"));
  assert.match(central, /\.is\("proposta_descartada_em", null\)/, "as recusas e ausências da Central não contam o descarte do dono");
});

test("E1146 (a): a migração 0360 só acrescenta a coluna, é idempotente e regista-se", () => {
  const m = ler("supabase/migrations/0360_vistoria_designacao_proposta_descartada_e1146.sql");
  assert.match(m, /add column if not exists proposta_descartada_em timestamptz/);
  const p = ler("supabase/producao/aplicar-0360.sql");
  assert.match(p, /^begin;/m);
  assert.match(p, /^commit;/m);
  assert.match(p, /add column if not exists proposta_descartada_em timestamptz/);
  assert.match(p, /'20261124000360', '0360_vistoria_designacao_proposta_descartada_e1146'/);
  assert.match(ler("supabase/producao/rollback/0360_rollback.sql"), /drop column if exists proposta_descartada_em/);
});

test("E1146 (b): o motivo diz, por avaliador, a regra que o impede", () => {
  const texto = motivoSemAvaliador("Uberlândia", [
    { numero: "UBE-001", motivo: "ja_designado" },
    { numero: "UBE-002", motivo: "avaliacao_anterior" },
  ]);
  assert.equal(texto, "Nenhum avaliador disponível para o dono escolher em Uberlândia. Avaliador nº UBE-001: já foi designado neste pedido. Avaliador nº UBE-002: fez a avaliação anterior deste imóvel.");
});

test("E1146 (b): cada regra tem palavras — as de independência, o estado do credenciamento e o piloto", () => {
  const um = (motivo: Parameters<typeof motivoSemAvaliador>[1][number]["motivo"]) => motivoSemAvaliador("Ibiá", [{ numero: "IBI-001", motivo }]);
  assert.match(um("servico_12_meses"), /Avaliador nº IBI-001: prestou serviço a este proprietário nos últimos 12 meses\.$/);
  assert.match(um("relacao_declarada"), /tem relação declarada com o proprietário ou o imóvel\.$/);
  assert.match(um("suspenso"), /está suspenso\.$/);
  assert.match(um("nao_ativo"), /não está ativo\.$/);
  assert.match(um("conta_teste"), /conta de teste fora do rodízio real\.$/);
  assert.match(um("primeira_da_contestacao"), /fez a 1ª avaliação \(contestação\)\.$/);
  assert.match(um("fora_do_piloto"), /não está no piloto da avaliação\.$/);
});

test("E1146 (b): sem credenciado na cidade, o motivo di-lo; sem número, o avaliador continua na lista", () => {
  assert.equal(motivoSemAvaliador("Ibiá", []), "Nenhum avaliador disponível para o dono escolher em Ibiá. Nenhum avaliador credenciado atende esta cidade.");
  assert.equal(motivoSemAvaliador("Ibiá", [{ numero: null, motivo: "suspenso" }]), "Nenhum avaliador disponível para o dono escolher em Ibiá. Um avaliador: está suspenso.");
});

test("E1146 (b): o motivo cabe no limite da coluna (500) e diz quantos ficaram de fora do texto", () => {
  assert.equal(LIMITE_MOTIVO_DA_FILA, 500);
  const muitos = Array.from({ length: 40 }, (_, i) => ({ numero: `UBE-${String(i + 1).padStart(3, "0")}`, motivo: "servico_12_meses" as const }));
  const texto = motivoSemAvaliador("Uberlândia", muitos);
  assert.ok(texto.length <= 500, `tem ${texto.length} caracteres`);
  const ditos = (texto.match(/Avaliador nº/g) ?? []).length;
  assert.ok(ditos >= 3 && ditos < 40);
  assert.match(texto, new RegExp(`E mais ${40 - ditos} impedidos\\.$`));
  assert.match(motivoSemAvaliador("Uberlândia", muitos.slice(0, ditos + 1)), /E mais 1 impedido\.$/);
});

test("E1146 (b): o servidor escreve o motivo e atualiza o item que já estava aberto; a Central mostra-o", () => {
  const servidor = semComentarios(ler("src/lib/vistoria/servidor.ts"));
  const abrir = servidor.slice(servidor.indexOf("export async function abrirEscolha"), servidor.indexOf("export async function sugeridosDoPedido"));
  assert.match(servidor, /motivoSemAvaliador\(l\.p\.cidade, /, "o texto sai da regra pura, com os impedidos da leitura");
  assert.match(abrir, /motivoDoItemSemAvaliador\(admin, l\)/);
  assert.doesNotMatch(abrir, /`Nenhum avaliador disponível/, "o texto fixo saiu do servidor");
  assert.match(abrir, /\.update\(\{ motivo/, "o item aberto com o texto antigo (os três de produção) recebe o motivo no tique seguinte");
  const central = semComentarios(ler("src/app/(dashboard)/admin/avaliadores/page.tsx"));
  assert.match(central, /data-testid="sem-avaliador-motivo"/);
});
