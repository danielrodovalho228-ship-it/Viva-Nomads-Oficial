/*
  E1069 — ORDEM-DUET-1059: o falhar-fechado do pacote de provas registrado, pelo COMPORTAMENTO (não pela forma do throw).
  Se a leitura dos nomes das partes (profiles) falhar, a geração LANÇA (a rota responde 503), NÃO regista o documento
  (registrarDocumento) e NÃO gera o PDF (gerarPdf). Controlo: com a leitura boa, regista, gera e o PDF leva os nomes.
  Corre o módulo REAL (src/lib/fiscal/pacote-provas.ts) com o cliente de serviço falso e o registro/PDF como dublês
  (harness em ./e1069-harness/loader.mjs).
  Roda: node --test src/lib/fiscal/e1069-pacote-provas-falha-fechada.test.ts
*/
import { register } from "node:module";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { DadosProvas } from "../contrato-provas.ts";

register("./e1069-harness/loader.mjs", import.meta.url);
const { gerarPacoteProvasRegistrado } = await import("./pacote-provas.ts");

type Chamada = { fn: string; conteudo?: { corpo: string[] } };
const g = globalThis as unknown as { __e1069Admin: unknown; __e1069Chamadas: Chamada[] };

const OWNER = "00000000-0000-4000-8000-0000000000a1";
const TENANT = "00000000-0000-4000-8000-0000000000b2";

/** Cliente de serviço falso: o contrato lê-se; a leitura de profiles devolve o que o caso mandar. */
function adminFalso(profiles: { data: unknown; error: unknown }) {
  const lidas: string[] = [];
  const admin = {
    lidas,
    from(tabela: string) {
      lidas.push(tabela);
      const resposta =
        tabela === "contratos"
          ? { data: { tenant_id: TENANT, properties: { owner_id: OWNER } }, error: null }
          : tabela === "profiles"
            ? profiles
            : { data: null, error: { message: `tabela inesperada: ${tabela}` } };
      const b: Record<string, unknown> = {
        select: () => b,
        eq: () => b,
        in: () => b,
        maybeSingle: async () => resposta,
        then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resposta).then(ok, ko),
      };
      return b;
    },
  };
  return admin;
}

const dados: DadosProvas = {
  contratoId: "11111111-2222-3333-4444-555555555555",
  imovel: "Studio Centro",
  situacao: "Em vigência",
  registradoEm: "2026-11-20T18:00:00Z",
  resumo: ["MINUTA DE TESTE — sem validade"],
  assinaturas: [
    { papel: "proprietario", em: "2026-11-20T21:40:00Z", hash: "h" },
    { papel: "inquilino", em: "2026-11-20T21:52:00Z", hash: "h" },
  ],
  pagamentos: [],
  conferencias: [],
};

beforeEach(() => {
  g.__e1069Chamadas = [];
});

test("1. a leitura dos nomes (profiles) falha: a geração LANÇA, não regista o documento e não gera o PDF", async () => {
  const admin = adminFalso({ data: null, error: { message: "permission denied for table profiles" } });
  g.__e1069Admin = admin;
  await assert.rejects(gerarPacoteProvasRegistrado(dados, OWNER), /nomes das partes/);
  assert.ok(admin.lidas.includes("profiles"), "a geração tem de ter tentado ler os nomes");
  assert.equal(g.__e1069Chamadas.filter((c) => c.fn === "registrarDocumento").length, 0, "não pode registar o documento");
  assert.equal(g.__e1069Chamadas.filter((c) => c.fn === "gerarPdf").length, 0, "não pode gerar o PDF");
});

test("2. controlo: com a leitura dos nomes boa, regista uma vez, gera o PDF e o PDF leva os nomes das duas partes", async () => {
  g.__e1069Admin = adminFalso({
    data: [
      { id: OWNER, full_name: "Dora Souza Lima" },
      { id: TENANT, full_name: "Iris Prado Reis" },
    ],
    error: null,
  });
  const bytes = await gerarPacoteProvasRegistrado(dados, OWNER);
  assert.ok(bytes instanceof Uint8Array);
  assert.equal(g.__e1069Chamadas.filter((c) => c.fn === "registrarDocumento").length, 1);
  const pdf = g.__e1069Chamadas.filter((c) => c.fn === "gerarPdf");
  assert.equal(pdf.length, 1);
  const corpo = pdf[0].conteudo!.corpo.join("\n");
  assert.match(corpo, /Dora Souza Lima \(proprietário\)/);
  assert.match(corpo, /Iris Prado Reis \(inquilino\)/);
});
