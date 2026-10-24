/*
  FISCAL-PARCEIRO-B (E24) — documento do serviço (parceiro) e da taxa (Viva), portão PJ, pendência, filtro da busca e a
  denúncia procedente. Roda: node --test src/lib/parceiros/fiscal.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  documentoDaTaxaViva,
  documentoDoServico,
  emiteNotaParaGravar,
  faltaRespostaNota,
  GERADOR_RPG,
  MOTIVO_NOTA_NAO_EMITIDA,
  passaFiltroNota,
  PENDENCIA_NOTA,
  PERGUNTA_NOTA,
} from "./fiscal.ts";
import { faltaParaPublicar, filtrarParceiros, validarSolicitacao, type ParceiroNaBusca, type SolicitacaoEntrada } from "./regras.ts";
import { NFSE_ATIVA } from "../flags.ts";
import { CATEGORIAS } from "../atendimento/classificar.ts";
import { filaDaCategoria } from "../atendimento/filas.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("documentoDoServico em todos os estados: PF → recibo; PJ Sim → nota; PJ Não ou sem resposta → null", () => {
  assert.equal(documentoDoServico({ tipoPessoa: "pf", emiteNota: null }), "recibo");
  // PF com valor (o banco recusa; a função não confia): continua recibo.
  assert.equal(documentoDoServico({ tipoPessoa: "pf", emiteNota: true }), "recibo");
  assert.equal(documentoDoServico({ tipoPessoa: "pj", emiteNota: true }), "nota");
  assert.equal(documentoDoServico({ tipoPessoa: "pj", emiteNota: false }), null);
  assert.equal(documentoDoServico({ tipoPessoa: "pj", emiteNota: null }), null);
  assert.equal(documentoDoServico({ tipoPessoa: "pj" }), null);
  assert.equal(documentoDoServico({ tipoPessoa: null, emiteNota: true }), null);
});

test("documentoDaTaxaViva em todos os estados; na main de hoje é null (RPG e NFS-e só reservados)", () => {
  assert.equal(documentoDaTaxaViva({ nfseAtiva: true, geradorRpg: true }), "nfse");
  assert.equal(documentoDaTaxaViva({ nfseAtiva: true, geradorRpg: false }), "nfse");
  assert.equal(documentoDaTaxaViva({ nfseAtiva: false, geradorRpg: true }), "comprovante");
  assert.equal(documentoDaTaxaViva({ nfseAtiva: false, geradorRpg: false }), null);
  // Estado real: sem NEXT_PUBLIC_NFSE_ATIVA e com o RPG reservado em fiscal/prefixos.ts → null. Nenhum gerador ligado.
  assert.equal(NFSE_ATIVA, false);
  assert.equal(GERADOR_RPG, false);
  assert.match(ler("lib/fiscal/prefixos.ts"), /RPG: \{.*reservado: true \}/);
  assert.match(ler("lib/fiscal/prefixos.ts"), /NFSE: \{.*reservado: true \}/);
  assert.equal(documentoDaTaxaViva(), null);
});

const base: SolicitacaoEntrada = {
  nome: "Clara Nota Serviços",
  tipoPessoa: "pj",
  documento: "11.222.333/0001-81",
  categorias: ["limpeza"],
  cidades: ["Uberlândia"],
  descricao: "Limpeza de saída e pós-obra.",
  aceite: true,
};

test("cadastro PJ (MEI conta como PJ) sem Sim/Não não conclui; com resposta grava; PF grava sempre null", () => {
  const sem = validarSolicitacao(base);
  assert.equal(sem.ok, false);
  assert.match(!sem.ok ? sem.erro : "", new RegExp(PERGUNTA_NOTA.replace("?", "\\?")));
  for (const lixo of ["sim", 1, "true", null, {}]) assert.equal(validarSolicitacao({ ...base, emiteNota: lixo }).ok, false, `não aceita ${JSON.stringify(lixo)}`);
  const sim = validarSolicitacao({ ...base, emiteNota: true });
  assert.ok(sim.ok && sim.valor.emiteNota === true);
  const nao = validarSolicitacao({ ...base, emiteNota: false });
  assert.ok(nao.ok && nao.valor.emiteNota === false);
  const pf = validarSolicitacao({ ...base, tipoPessoa: "pf", documento: "529.982.247-25", emiteNota: true });
  assert.ok(pf.ok && pf.valor.emiteNota === null, "PF: o que vier do navegador é ignorado");
  assert.deepEqual(emiteNotaParaGravar("pf", false), { ok: true, valor: null });
  assert.equal(emiteNotaParaGravar("xx", true).ok, false);
});

test("pendência: só PJ sem resposta; bloqueia a primeira publicação, nunca quem já esteve no ar", () => {
  assert.equal(faltaRespostaNota({ tipoPessoa: "pj", emiteNota: null }), true);
  assert.equal(faltaRespostaNota({ tipoPessoa: "pj", emiteNota: false }), false);
  assert.equal(faltaRespostaNota({ tipoPessoa: "pf", emiteNota: null }), false);
  const pagina = { avatarPath: "a.webp", descricao: "Limpeza de saída e pós-obra com material próprio.", servicosAtivos: 1, cidades: ["Uberlândia"], categorias: ["limpeza"], fotosGaleria: 0 };
  assert.deepEqual(faltaParaPublicar({ ...pagina, tipoPessoa: "pj", emiteNota: null }), [PENDENCIA_NOTA]);
  assert.deepEqual(faltaParaPublicar({ ...pagina, tipoPessoa: "pj", emiteNota: true }), []);
  assert.deepEqual(faltaParaPublicar({ ...pagina, tipoPessoa: "pf", emiteNota: null }), []);
  // Sem tipo (quem já esteve no ar: o painel não passa a declaração) → não bloqueia.
  assert.deepEqual(faltaParaPublicar(pagina), []);
  const painel = ler("lib/parceiros/painel-actions.ts");
  assert.match(painel, /\.\.\.\(p\.publicado_em \? \{\} : \{ tipoPessoa: /);
  assert.match(painel, /if \(m\.p\.tipo_pessoa !== "pj"\) return \{ ok: false/);
  assert.match(painel, /if \(v\.valor === true && m\.p\.nota_selo_removido_em\) return/);
});

test("servidor: o pedido grava o valor validado e a ativação copia (só PJ) nos dois caminhos", () => {
  assert.match(ler("lib/parceiros/solicitacao-actions.ts"), /emite_nota: v\.valor\.emiteNota,/);
  for (const arq of ["lib/parceiros/ativacao-actions.ts", "lib/vistoria/actions.ts"]) {
    assert.match(ler(arq), /emite_nota: sol\.tipo_pessoa === "pj" \? \(\(sol\.emite_nota as boolean \| null\) \?\? null\) : null,/, arq);
  }
});

test("busca: o filtro passa pela mesma função e a contagem conta só quem emite nota", () => {
  const p = (slug: string, tipoPessoa: string, emiteNota: boolean | null): ParceiroNaBusca => ({ slug, categorias: ["limpeza"], cidades: ["Uberlândia"], notaMedia: null, avaliacoesQtd: 0, publicadoEm: null, teste: false, status: "publicado", tipoPessoa, emiteNota });
  const lista = [p("pf", "pf", null), p("sim", "pj", true), p("nao", "pj", false), p("sem", "pj", null)];
  assert.deepEqual(filtrarParceiros(lista, { soNota: true }).map((x) => x.slug), ["sim"]);
  assert.equal(filtrarParceiros(lista, {}).length, 4);
  assert.equal(passaFiltroNota({ tipoPessoa: "pj", emiteNota: true }, false), true);
  const dados = ler("lib/data/parceiros-publico.ts");
  assert.match(dados, /const comNota = todos\.filter\(\(p\) => passaFiltroNota\(p, true\)\)\.length;/);
  const tela = ler("app/(public)/parceiros/buscar/page.tsx");
  assert.match(tela, /\{ROTULO_FILTRO_NOTA\} \(\{r\.comNota\}\)/);
  assert.match(tela, /const soNota = sp\.nota === "1";/);
});

test("denúncia: motivo próprio só pela página do parceiro; procedente tira o selo, registra e avisa uma vez", () => {
  const cat = CATEGORIAS.find((c) => c.key === "nota_parceiro");
  assert.ok(cat);
  assert.equal(cat.rotulo, MOTIVO_NOTA_NAO_EMITIDA);
  assert.equal(cat.soContexto, "parceiro");
  assert.equal(filaDaCategoria("nota_parceiro"), "suporte");
  assert.match(ler("components/ajuda/central-ajuda.tsx"), /\(!c\.soContexto \|\| c\.soContexto === contexto\?\.tipo\)/);
  const at = ler("lib/data/atendimento-actions.ts");
  assert.match(at, /const CONTEXTOS = \["pedido", "contrato", "anuncio", "parceiro"\] as const;/);
  assert.match(at, /from\("parceiros"\)\.select\("id"\)\.eq\("id", id\)\.eq\("status", "publicado"\)/);
  const adm = ler("lib/parceiros/admin-actions.ts");
  const corpo = adm.slice(adm.indexOf("export async function denunciaNotaProcedente"), adm.indexOf("/** Suporte: a equipe abre o pedido"));
  assert.match(corpo, /const a = await exigirAdminParceria\(\);/);
  assert.match(corpo, /ch\.categoria !== "nota_parceiro" \|\| ch\.contexto_tipo !== "parceiro"/);
  assert.match(corpo, /\.update\(\{ emite_nota: false, nota_selo_removido_em: agora, nota_selo_motivo: MOTIVO_NOTA_NAO_EMITIDA/);
  assert.match(corpo, /\.is\("nota_selo_removido_em", null\)/, "só uma vez (corrida inclusive)");
  assert.match(corpo, /if \(!feito\?\.length\) return \{ ok: true, valor: null \};/);
  assert.equal(corpo.match(/await notify\(/g)?.length, 1, "um aviso");
  assert.match(corpo, /event: "parceiro_selo_nota_removido"/);
  assert.match(ler("app/(public)/parceiros/[slug]/page.tsx"), /documentoDoServico\(p\) === "nota" && \(/);
});
