// E761 (Phoenix/RELATORIO-005): "Sua identidade — a confirmar" aparece no "Antes de publicar" mas NÃO entra nos "Faltam N itens" —
// não ficava claro se a identidade trava a publicação. Ela não trava (decisão do código desde o E251: a equipe confere o documento).
// Contagem e texto agora dizem isso: a conta avisa que a identidade a confirmar fica de fora, e a linha da seção diz "não impede a publicação".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contaDaConferencia, secoesAntesDePublicar } from "./passo10-colunas.ts";

const itens = [{ ok: false, faltam: ["a", "b"] }];

test("E761: a conta diz que a identidade a confirmar não entra e não impede de publicar (só quando ela está a confirmar)", () => {
  const base = { itens, pendentesNaRevisao: [] as string[], aceitouIa: true };
  const sem = contaDaConferencia(base)!;
  const com = contaDaConferencia({ ...base, identidadeAConfirmar: true })!;
  assert.equal(com, `${sem} A identidade, ainda a confirmar, não entra nesta conta e não impede de publicar.`);
  assert.doesNotMatch(sem, /identidade/);
  // a contagem em si não muda com a identidade
  assert.match(com, /^A conta: 2 itens em 1 passo da lista\./);
  // nada falta → sem conta, sem frase solta
  assert.equal(contaDaConferencia({ itens: [], pendentesNaRevisao: [], aceitouIa: true, identidadeAConfirmar: true }), null);
});

test("E761: a linha da seção Sua identidade diz 'não impede a publicação' em todo estado a confirmar, e 'Confirmada' quando ok", () => {
  const BASE = {
    faltaOperacao: "", rotuloOperacao: "Sou o proprietário", documento: "aprovado" as const, declaracoes: { iptuOk: true, habitavel: true, convencao: "" } as never, emCondominio: false,
  };
  for (const identidade of ["pendente", "em_breve", "sem_cpf"] as const) {
    const s = secoesAntesDePublicar({ ...BASE, identidade }).find((x) => x.id === "identidade")!;
    assert.equal(s.estado, "aviso");
    assert.match(s.resumo, /não impede a publicação/, identidade);
  }
  assert.equal(secoesAntesDePublicar({ ...BASE, identidade: "ok" }).find((x) => x.id === "identidade")!.resumo, "Confirmada");
});

test("E761: a Revisão passa o estado da identidade para a conta", () => {
  const t = readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/etapa-revisar.tsx", "utf8");
  assert.match(t, /identidadeAConfirmar = !!identidadeSituacao && identidadeSituacao\.identidade\.estado !== "confirmada"/);
  assert.match(t, /contaDaConferencia\(\{[^}]*identidadeAConfirmar \}\)/);
});
