/*
  E1230 (ORDENS-DUET 1207 e 1300; MAPA-E1230 e FRESCURA-E1238-E1230 da Fable) — a hora da entrada nas telas e nos
  e-mails da estadia vem das INSTRUÇÕES do contrato (contratos_checkin.horario), pelo LEITOR ÚNICO horaDeEntrada — o
  mesmo que a âncora da conferência (E1238) lê. As colunas do anúncio (checkin_after / checkout_before) não ficam nem
  como recurso nas superfícies do prompt.
   - o morador (e o convidado dele) só vê a hora DEPOIS das duas assinaturas; o dono vê sempre (horaParaQuemVe);
   - a saída mostra-se SEM hora: "Saída em {data}, horário a combinar com o proprietário" (a data pela regra de sempre);
   - superfícies: "Sua estadia" (página da estadia dos dois lados, do convidado e do contrato), a agenda e o "Entra hoje"
     do dono (por contrato), e os dois e-mails da entrada (instruções liberadas; lembrete da entrada);
   - não troca a função de datas das telas; o prazo de 48 h é do E1238 e não muda aqui.
  Roda: node --test src/lib/e1230-hora-da-entrada.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fonteSemComentarios } from "./fonte-sem-comentarios.ts";
import { montarLinhaDoTempo } from "./estadia-linha-tempo.ts";
import * as estadia from "./estadia/estadia.ts";
import { cartoesDeHoje } from "./painel/hoje-dono.ts";
import { linhasDaEstadia } from "./estadia/emails-chegada.ts";

const janela = (await import("./data/janela-conferencia.ts")) as unknown as {
  horaDeEntrada?: (admin: unknown, contratoId: string) => Promise<string | null>;
  horasDeEntrada?: (admin: unknown, ids: string[]) => Promise<Map<string, string | null>>;
};
const hora = (await import("./estadia/hora-da-entrada.ts").catch(() => ({}))) as {
  horaParaQuemVe?: (p: { hora: string | null; papel: "proprietario" | "inquilino"; assinadoProprietarioEm: string | null; assinadoInquilinoEm: string | null }) => string | null;
  HORARIO_SAIDA_A_COMBINAR?: string;
};
const ler = (rel: string) => fonteSemComentarios(readFileSync(new URL(rel, import.meta.url), "utf8"));
const CONTRATO = "11111111-2222-4333-8444-555555555555";

/** Falso FIEL: só contratos_checkin (só as colunas pedidas); qualquer leitura do anúncio é registrada. */
function falso(linhas: Record<string, unknown>[]) {
  const lidas: { tabela: string; colunas: string }[] = [];
  return {
    lidas,
    admin: {
      from(tabela: string) {
        let colunas = "";
        let ids: unknown[] = [];
        const b: Record<string, unknown> = {};
        b.select = (s: string) => ((colunas = s), lidas.push({ tabela, colunas: s }), b);
        b.in = (_k: string, v: unknown[]) => ((ids = v), b);
        b.eq = (_k: string, v: unknown) => ((ids = [v]), b);
        const dados = () => (tabela === "contratos_checkin" ? linhas.filter((l) => ids.includes(l.contrato_id)).map((l) => Object.fromEntries(colunas.split(",").map((c) => c.trim()).map((c) => [c, l[c] ?? null]))) : []);
        b.maybeSingle = async () => ({ data: dados()[0] ?? null, error: null });
        b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: dados(), error: null }).then(ok);
        return b;
      },
    },
  };
}

test("1. o leitor único: horaDeEntrada lê contratos_checkin.horario — só a coluna da hora, nunca o anúncio", async () => {
  assert.equal(typeof janela.horaDeEntrada, "function");
  assert.equal(typeof janela.horasDeEntrada, "function");
  const f = falso([{ contrato_id: CONTRATO, horario: "14:00", instrucoes: "segredo", plantao: "+55 11 9" }]);
  assert.equal(await janela.horaDeEntrada!(f.admin, CONTRATO), "14:00");
  assert.deepEqual(f.lidas, [{ tabela: "contratos_checkin", colunas: "contrato_id, horario" }], "nem as instruções nem o telefone; nada do anúncio");
  assert.equal(await janela.horaDeEntrada!(falso([]).admin, CONTRATO), null, "sem instruções: null ('a combinar')");
  const m = await janela.horasDeEntrada!(falso([{ contrato_id: CONTRATO, horario: "14:00" }]).admin, [CONTRATO, "outro"]);
  assert.deepEqual([...m], [[CONTRATO, "14:00"], ["outro", null]]);
});

test("2. a âncora (E1238) e a tela leem a MESMA função: janelasDosContratos usa horasDeEntrada", () => {
  const f = ler("./data/janela-conferencia.ts");
  const corpo = f.slice(f.indexOf("export async function janelasDosContratos("), f.indexOf("export async function janelaDoContrato("));
  assert.match(corpo, /horasDeEntrada\(admin, ids\)/);
  assert.doesNotMatch(corpo, /from\("contratos_checkin"\)/, "nada de segunda leitura do horário");
});

test("3. a porta das duas assinaturas: o morador só vê a hora depois de as DUAS partes assinarem; o dono vê sempre", () => {
  assert.equal(typeof hora.horaParaQuemVe, "function");
  const v = (papel: "proprietario" | "inquilino", dono: string | null, morador: string | null) => hora.horaParaQuemVe!({ hora: "14:00", papel, assinadoProprietarioEm: dono, assinadoInquilinoEm: morador });
  assert.equal(v("proprietario", null, null), "14:00");
  assert.equal(v("inquilino", null, null), null, "nenhuma assinatura");
  assert.equal(v("inquilino", "2026-11-01", null), null, "só o dono assinou");
  assert.equal(v("inquilino", null, "2026-11-01"), null, "só o morador assinou");
  assert.equal(v("inquilino", "2026-11-01", "2026-11-02"), "14:00", "as duas");
  assert.equal(hora.horaParaQuemVe!({ hora: null, papel: "proprietario", assinadoProprietarioEm: "x", assinadoInquilinoEm: "y" }), null);
});

test("4. a saída sem hora: 'Saída em {data}, horário a combinar com o proprietário' (a data da regra de sempre)", () => {
  assert.equal(hora.HORARIO_SAIDA_A_COMBINAR, "horário a combinar com o proprietário");
  // última noite 14/02 → saída 15/02 (E1089, saidaPeloFim — a função de datas não muda).
  assert.equal(estadia.textoSaida({ inicio: "2026-11-13", fim: "2027-02-14" }), "Saída em 15/02/2027, horário a combinar com o proprietário");
  assert.equal(estadia.textoSaida({ inicio: "2026-11-13", fim: "2027-02-14", checkoutBefore: "11:00" } as estadia.PeriodoEstadia), "Saída em 15/02/2027, horário a combinar com o proprietário", "nenhuma hora de saída, venha de onde vier");
  assert.equal(estadia.textoEntrada({ inicio: "2026-11-13", fim: "2027-02-14", checkinAfter: "14:00" }), "Entrada: 13/11/2026 a partir das 14:00", "a entrada mantém a sua frase");
});

test("5. 'Sua estadia' (linha do tempo): a entrada com a hora resolvida; a saída sempre a combinar com o proprietário", () => {
  const etapas = montarLinhaDoTempo({ inicio: "2026-11-13", fim: "2027-02-14", checkinAfter: "14:00" } as Parameters<typeof montarLinhaDoTempo>[0]);
  assert.equal(etapas.find((e) => e.chave === "entrada")?.horario, "a partir das 14:00, horário de Brasília");
  assert.equal(etapas.find((e) => e.chave === "saida")?.horario, "horário a combinar com o proprietário");
  assert.equal(etapas.find((e) => e.chave === "saida")?.dia, "2027-02-15", "a data da saída não muda");
  const sem = montarLinhaDoTempo({ inicio: "2026-11-13", fim: "2027-02-14", checkinAfter: null } as Parameters<typeof montarLinhaDoTempo>[0]);
  assert.equal(sem.find((e) => e.chave === "entrada")?.horario, "horário a combinar");
});

test("6. o 'Entra hoje' do dono lê a hora POR CONTRATO; o 'Sai hoje' sem hora", () => {
  const itens = [
    { id: `entrada-${CONTRATO}`, tipo: "entrada", quando: "2026-11-13", imovel: "Apto", propertyId: "im1", pessoa: { nome: "Ana" } },
    { id: "saida-c2", tipo: "saida", quando: "2026-11-13", imovel: "Casa", propertyId: "im1", pessoa: { nome: "Bia" } },
  ] as unknown as Parameters<typeof cartoesDeHoje>[0];
  const c = cartoesDeHoje(itens, "2026-11-13", { [CONTRATO]: { entrada: "14:00" }, c2: { entrada: "16:00" } });
  assert.equal(c.find((x) => x.tipo === "entrada")?.horario, "a partir das 14:00");
  assert.equal(c.find((x) => x.tipo === "saida")?.horario, null);
  const porImovel = cartoesDeHoje(itens, "2026-11-13", { im1: { entrada: "09:00" } });
  assert.equal(porImovel.find((x) => x.tipo === "entrada")?.horario, null, "a chave é o contrato, não o imóvel");
});

test("7. os e-mails da entrada: a entrada com a hora das instruções; a saída 'horário a combinar com o proprietário'", () => {
  const l = linhasDaEstadia({ imovel: { id: "im1", titulo: "Apto" }, entrada: "2026-11-13", saida: "2027-02-15", horarioEntrada: "14:00" } as Parameters<typeof linhasDaEstadia>[0]);
  assert.deepEqual(l.find((x) => x.rotulo === "Entrada")?.valor, "13/11/2026, a partir das 14:00");
  assert.deepEqual(l.find((x) => x.rotulo === "Saída")?.valor, "15/02/2027, horário a combinar com o proprietário");
});

test("8. estático: nenhuma superfície do prompt lê checkin_after nem checkout_before (os outros leitores são o E1252)", () => {
  const superficies = [
    "./data/estadia.ts",
    "./estadia/estadia.ts",
    "./estadia-linha-tempo.ts",
    "./data/estadia-convidados.ts",
    "./data/contrato-assinar-actions.ts",
    "./data/agenda-servidor.ts",
    "./painel/hoje-dono.ts",
    "./estadia/emails-chegada.ts",
    "../app/api/cron/checkin-lembretes/route.ts",
    "../app/(dashboard)/dashboard/estadia/[contratoId]/page.tsx",
    "../app/(dashboard)/dashboard/estadia/[contratoId]/convidado/page.tsx",
    "../app/(dashboard)/dashboard/estadia/[contratoId]/confirmada/page.tsx",
  ];
  for (const s of superficies) assert.doesNotMatch(ler(s), /checkin_after|checkout_before|checkinAfter: [a-z]+\.properties|checkoutBefore/, s);
  const rota = ler("../app/api/cron/automacoes/route.ts");
  const liberadas = rota.slice(rota.indexOf("if (liberaHoje(condicao, agora)) {"), rota.indexOf('tipo: "estadia_instrucoes_liberadas"'));
  assert.doesNotMatch(liberadas, /checkin_after|checkout_before|horarioSaida/, "o e-mail das instruções liberadas");
});

test("9. os leitores passam pelo leitor único e pela porta: estadia, convidado, contrato, agenda e os dois e-mails", () => {
  assert.match(ler("./data/estadia.ts"), /horaParaQuemVe\(\{ hora: janela\.hora, papel/, "a estadia (dono e morador) e o convidado");
  assert.match(ler("./data/estadia-convidados.ts"), /periodoComPrazos\(admin, c, "inquilino"\)/, "o convidado é do lado do morador");
  assert.match(ler("./data/contrato-assinar-actions.ts"), /checkinAfter: horaParaQuemVe\(\{ hora: janela\?\.hora \?\? null, papel/, "a 'Sua estadia' do contrato");
  assert.match(ler("./data/agenda-servidor.ts"), /horasDeEntrada\(admin, /, "a agenda e o 'Entra hoje'");
  const rota = ler("../app/api/cron/automacoes/route.ts");
  const liberadas = rota.slice(rota.indexOf("if (liberaHoje(condicao, agora)) {"), rota.indexOf('tipo: "estadia_instrucoes_liberadas"'));
  assert.match(liberadas, /horarioEntrada: await horaDeEntrada\(admin, c\.id as string\)/, "o e-mail das instruções liberadas");
  assert.match(ler("../app/api/cron/checkin-lembretes/route.ts"), /await horaDeEntrada\(admin, c\.id\)/, "o lembrete da entrada");
});
