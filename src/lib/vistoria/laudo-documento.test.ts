/*
  Prompt 62-B2 — o conteúdo do laudo VIS e as guardas do que nunca sai em público (dB(A), prova de local).
  Roda: node --test src/lib/vistoria/laudo-documento.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { DELIMITACAO_LAUDO, ITENS_CHECKLIST, type ItemChecklist, type ValorItem } from "../../config/checklist-avaliacao.ts";
import { PREFIXOS } from "../fiscal/prefixos.ts";
import { RETENCAO_DOCUMENTOS } from "../../config/retencao.ts";
import { conteudoLaudo, proximoPasso, type DadosLaudoDocumento } from "./laudo-documento.ts";
import { resultadoAvaliacao, resumoPorGrupo } from "./laudo.ts";

const ITENS = ITENS_CHECKLIST as readonly ItemChecklist[];
const respostas: Record<string, ValorItem> = { ...Object.fromEntries(ITENS.map((i) => [i.chave, i.tipo === "limpeza" ? "pronto" : "conforme"])), iluminacao: "nao_conforme" };
const dados: DadosLaudoDocumento = {
  imovel: "Studio Centro",
  cidade: "Uberlândia",
  visitaEm: "2026-10-20T13:00:00Z",
  avaliador: { nomeCurto: "Ana", numero: "UDI-001" },
  resultado: resultadoAvaliacao(respostas),
  nivel: "conforto",
  resumo: resumoPorGrupo(respostas),
  naoConformes: [{ chave: "iluminacao", valor: "nao_conforme", observacao: "Lâmpada da sala queimada.", temFoto: true }],
  ruido: "baixo",
  internet: [{ ponto: "quarto_principal", downloadMbps: 328, uploadMbps: 42, latenciaMs: 12 }],
  prazoRessalvaAte: "2026-11-04T13:00:00Z",
  motivoVersao: null,
};

test("VIS: prefixo da plataforma com contador próprio e retenção pendente (item 13)", () => {
  assert.deepEqual(PREFIXOS.VIS, { rotulo: "Laudo de avaliação", marca: "plataforma", numeracao: { contador: "VIS" } });
  assert.equal(RETENCAO_DOCUMENTOS.VIS.dias, null);
});

test("laudo: resumo por grupo, não conformes com foto, nível sustentado, ruído, internet, resultado, prazo e o texto fixo", () => {
  const c = conteudoLaudo(dados, { numero: "VIS-2026-000001", emitidoEm: "20/10/2026 às 10:00 (horário de Brasília)", conferir: "Confira em vivanomads.com.br/conferir com o código abc" });
  assert.equal(c.cabecalho?.marca, "plataforma");
  const texto = [c.titulo, c.subtitulo, ...c.quadro.flat(), ...c.corpo, ...c.rodape].join("\n");
  assert.match(texto, /Avaliador credenciado\nAna · nº UDI-001/);
  assert.match(texto, /Nível sustentado\nConforto/);
  assert.match(texto, /Iluminação — Não conforme: Lâmpada da sala queimada\. \(foto no registro\)/);
  assert.match(texto, /Exposição ao ruído: baixo/);
  assert.match(texto, /Quarto principal: 328 Mbps/);
  assert.match(texto, /Com ressalvas/);
  assert.match(texto, /até 04\/11\/2026/);
  assert.ok(c.rodape.includes(DELIMITACAO_LAUDO));
  // Sem valor e sem nome do dono/morador; nunca dB(A) nem distância.
  assert.doesNotMatch(texto, /R\$|dB\(A\)|\bmetros?\b|distância/i);
});

test("próximo passo por resultado (o mesmo texto da notificação)", () => {
  assert.match(proximoPasso("aprovado", null), /12 meses/);
  assert.match(proximoPasso("com_ressalvas", "2026-11-04T13:00:00Z"), /04\/11\/2026/);
  assert.match(proximoPasso("com_ressalvas", "2026-11-04T13:00:00Z"), /reverificação dos itens da ressalva, pelo mesmo avaliador, está incluída no valor já pago/);
  assert.match(proximoPasso("reprovado", null), /nova avaliação: avaliação completa, novo pedido, outro avaliador pelo rodízio, pelo valor da tabela/);
  // Adendo 62-B1: o laudo nunca fala em desconto (a condição de retorno, se existir, aparece só no pedido).
  for (const r of ["aprovado", "com_ressalvas", "reprovado"] as const) assert.doesNotMatch(proximoPasso(r, null), /desconto|metade|90 dias/);
});

const RAIZ = new URL("../../../", import.meta.url).pathname;
function arquivos(dir: string): string[] {
  return readdirSync(join(RAIZ, dir)).flatMap((n) => {
    const p = join(dir, n);
    return statSync(join(RAIZ, p)).isDirectory() ? arquivos(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

test("dB(A) e prova de local: só o servidor da avaliação e o admin leem vistoria_medicoes; nada público", () => {
  const leitores = arquivos("src").filter((p) => !p.endsWith(".test.ts") && /from\("vistoria_medicoes"\)/.test(readFileSync(join(RAIZ, p), "utf8")));
  assert.deepEqual(leitores.sort(), ["src/lib/vistoria/laudo-actions.ts", "src/lib/vistoria/laudo-servidor.ts"]);
  // laudo-servidor lê só a internet (nunca o dBA) para o nível sustentado.
  const servidor = readFileSync(join(RAIZ, "src/lib/vistoria/laudo-servidor.ts"), "utf8");
  assert.doesNotMatch(servidor, /select\([^)]*dba/);
  // Na migração, a leitura da tabela é só do admin.
  const sql = readFileSync(join(RAIZ, "supabase/migrations/0216_laudo_avaliacao.sql"), "utf8");
  assert.match(sql, /create policy vistoria_medicoes_le on public\.vistoria_medicoes for select to authenticated using \(public\.is_admin\(\)\);/);
  assert.doesNotMatch(sql, /grant select on public\.vistoria_medicoes to anon/);
});
