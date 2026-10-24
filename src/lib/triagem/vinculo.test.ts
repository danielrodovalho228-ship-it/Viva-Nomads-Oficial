/* Prompt 52 — triagem do morador (vínculo). Roda: node --test src/lib/triagem/vinculo.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MOTIVOS_RECUSA,
  caminhoVinculo,
  estadoVinculo,
  metricasTriagem,
  moradorVerificado,
  podeEnviar,
  textoDaRecusa,
  textoParaDono,
  validoAte,
  type LinhaVinculo,
} from "./vinculo.ts";

const agora = new Date("2026-10-23T12:00:00Z");
const aprovado: LinhaVinculo = { tipo: "carta_empregador", status: "aprovado", motivo: null, decidido_em: "2026-10-01T12:00:00Z", valido_ate: validoAte(new Date("2026-10-01T12:00:00Z")), enviado_em: "2026-09-30T12:00:00Z" };
const confirmada = { estado: "confirmada" };

test("validade de 12 meses a partir da decisão", () => {
  assert.equal(validoAte(new Date("2026-10-01T12:00:00Z")), "2027-10-01T12:00:00.000Z");
  assert.equal(estadoVinculo(aprovado, agora), "aprovado");
  assert.equal(estadoVinculo(aprovado, new Date("2027-10-01T12:00:01Z")), "vencido");
  assert.equal(estadoVinculo(null, agora), "nenhum");
  assert.equal(estadoVinculo({ ...aprovado, status: "pendente", valido_ate: null }, agora), "pendente");
});

test("selo só com as DUAS confirmações e dentro da validade", () => {
  assert.equal(moradorVerificado(confirmada, aprovado, agora), true);
  assert.equal(moradorVerificado({ estado: "vencida" }, aprovado, agora), false, "identidade vencida");
  assert.equal(moradorVerificado({ estado: "simulavel" }, aprovado, agora), false);
  assert.equal(moradorVerificado(null, aprovado, agora), false, "sem identidade");
  assert.equal(moradorVerificado(confirmada, null, agora), false, "sem vínculo");
  assert.equal(moradorVerificado(confirmada, { ...aprovado, status: "pendente" }, agora), false);
  assert.equal(moradorVerificado(confirmada, { ...aprovado, status: "recusado" }, agora), false);
  assert.equal(moradorVerificado(confirmada, aprovado, new Date("2027-10-02T00:00:00Z")), false, "vínculo vencido");
});

test("o dono vê só o selo e o tipo do vínculo — nunca valor nem arquivo", () => {
  assert.equal(textoParaDono(confirmada, aprovado, agora), "Morador verificado · vínculo confirmado (carta do empregador)");
  assert.equal(textoParaDono(confirmada, { ...aprovado, tipo: "contracheque" }, agora), "Morador verificado · vínculo confirmado (contracheque)");
  assert.equal(textoParaDono({ estado: "vencida" }, aprovado, agora), null);
  const t = textoParaDono(confirmada, aprovado, agora)!;
  assert.doesNotMatch(t, /R\$|\d{3,}|salári|renda|\.pdf|\.png|\.jpg|http/i);
});

test("recusa com motivo legível e nova tentativa na hora", () => {
  assert.equal(podeEnviar("recusado"), true);
  assert.equal(podeEnviar("nenhum"), true);
  assert.equal(podeEnviar("vencido"), true);
  assert.equal(podeEnviar("pendente"), true, "troca o arquivo pendente");
  assert.equal(podeEnviar("aprovado"), false);
  assert.equal(textoDaRecusa("ilegivel"), MOTIVOS_RECUSA.ilegivel);
  assert.equal(textoDaRecusa("sem_nome", "  Está no nome da sua mãe. "), `${MOTIVOS_RECUSA.sem_nome} Está no nome da sua mãe.`);
});

test("contas de teste fora das métricas da triagem", () => {
  const linhas = [
    { user_id: "a", status: "pendente" },
    { user_id: "b", status: "aprovado" },
    { user_id: "qa", status: "aprovado" },
    { user_id: "qa", status: "pendente" },
    { user_id: "c", status: "recusado" },
  ];
  assert.deepEqual(metricasTriagem(linhas, new Set(["qa"])), { pendentes: 1, aprovados: 1, recusados: 1 });
});

test("caminho no bucket privado sem nome de arquivo do usuário", () => {
  assert.equal(caminhoVinculo("u1", "f1", "pdf"), "u1/f1.pdf");
});

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("chave desligada = nenhuma tela nova: cada entrada confere triagemVinculoAtiva()", () => {
  assert.match(ler("../../app/api/upload/triagem-vinculo/route.ts"), /if \(!\(await triagemVinculoAtiva\(\)\)\) return/);
  assert.match(ler("../../components/triagem/vinculo-morador.tsx"), /export function VinculoMorador/);
  assert.match(ler("../../app/(dashboard)/dashboard/candidaturas/page.tsx"), /triagemLigada && <VinculoMorador/);
  assert.match(ler("../../app/(dashboard)/admin/documentos/page.tsx"), /triagemLigada \? <VinculosAdmin/);
  const acoes = ler("../data/triagem-actions.ts");
  for (const f of ["meuVinculo", "listarVinculosPendentes", "decidirVinculo", "linkVinculoAdmin"]) {
    assert.match(acoes, new RegExp(`export async function ${f}[\\s\\S]*?if \\(!\\(await triagemVinculoAtiva\\(\\)\\)\\)`), f);
  }
  assert.match(ler("../data/leads.ts"), /await triagemVinculoAtiva\(\)/);
  // Proposta: só o dono e só com a chave (o helper confere as duas coisas).
  assert.match(ler("../../app/(dashboard)/dashboard/propostas/[id]/page.tsx"), /p\.papel === "owner" && p\.leadId \? await seloDoCandidato/);
  const srv = ler("./servidor.ts");
  assert.match(srv, /if \(!\(await triagemVinculoAtiva\(\)\)/);
  assert.match(srv, /lead\.owner_id !== user\.id\) return null/);
});

test("o dono nunca abre o arquivo: o link assinado é só do próprio morador e do admin com 2FA", () => {
  const acoes = ler("../data/triagem-actions.ts");
  assert.match(acoes, /export async function linkVinculoAdmin[\s\S]*?ehAdmin\(/);
  assert.match(acoes, /export async function decidirVinculo[\s\S]*?ehAdmin\(/);
  assert.match(acoes, /createSignedUrl\([^)]*LINK_TTL\)/);
  assert.match(acoes, /const LINK_TTL = 60 \* 10;/);
  // Na tela do dono (candidaturas recebidas) só entra o texto do selo; nada de path, link ou tipo do arquivo.
  const leads = ler("../data/leads.ts");
  assert.doesNotMatch(leads, /triagem_vinculos"\)\.select\("[^"]*path/);
});
