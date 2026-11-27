/*
  E477 (telas do resíduo do #2845/#2885): o servidor já recusa a conta observadora da QA; aqui a TELA deixa de oferecer o botão e
  mostra "Só leitura: a conta de QA não decide dado real." (mesmo padrão do Atendimento e dos Documentos). Cada tela pergunta uma vez
  no servidor (soLeituraNaTela) e repassa o resultado. Quem não é observador não vê diferença.
  Roda: node --test src/lib/data/e477-telas-so-leitura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const PERGUNTA = /const soLeitura = \(await soLeituraNaTela\(\[\{ id: "configuracao" \}\]\)\)\.length > 0;/;

test("as cinco páginas perguntam ao servidor se a sessão é a do observador", () => {
  for (const p of [
    "src/app/(dashboard)/admin/agentes/page.tsx",
    "src/app/(dashboard)/admin/moderacao/ofensas/page.tsx",
    "src/app/(dashboard)/admin/ajuda-publicacao/page.tsx",
    "src/app/(dashboard)/admin/avaliadores/page.tsx",
    "src/app/(dashboard)/admin/solicitacoes/page.tsx",
  ]) {
    const s = ler(p);
    assert.match(s, /import \{ soLeituraNaTela \} from "@\/lib\/qa\/observador";/, p);
    assert.match(s, PERGUNTA, p);
  }
});

test("Moderação: 'Marcar como revisada' vira 'Só leitura'", () => {
  assert.match(ler("src/app/(dashboard)/admin/moderacao/ofensas/page.tsx"), /<BotaoRevisada id=\{o\.id\} soLeitura=\{soLeitura\} \/>/);
  const b = ler("src/app/(dashboard)/admin/moderacao/ofensas/botao-revisada.tsx");
  assert.match(b, /soLeitura\?: boolean/);
  assert.match(b, /if \(soLeitura\) return <SoLeituraQa \/>;/);
});

test("Ajuda à publicação: as mudanças de etapa viram 'Só leitura'", () => {
  assert.match(ler("src/app/(dashboard)/admin/ajuda-publicacao/page.tsx"), /<AjudaPublicacaoClient fila=\{fila\} soLeitura=\{soLeitura\} \/>/);
  const c = ler("src/app/(dashboard)/admin/ajuda-publicacao/ajuda-publicacao-client.tsx");
  assert.match(c, /\{ fila, soLeitura = false \}: \{ fila: PedidoAjuda\[\]; soLeitura\?: boolean \}/);
  assert.match(c, /soLeitura \? \(\s*<SoLeituraQa \/>\s*\) : \(\s*proximosStatus/);
});

test("Solicitações: 'Reclassificar' vira 'Só leitura'", () => {
  assert.match(ler("src/app/(dashboard)/admin/solicitacoes/page.tsx"), /<ReclassificarOrdem id=\{s\.id\} atual=\{s\.priority as UrgenciaManutencao\} soLeitura=\{soLeitura\} \/>/);
  const c = ler("src/components/admin/reclassificar-ordem.tsx");
  assert.match(c, /soLeitura\?: boolean/);
  assert.match(c, /if \(soLeitura\) return <SoLeituraQa \/>;/);
});

test("Vistoria: todo formulário de ação da página passa pelo mesmo desvio — sem <FormAcao> solto", () => {
  const p = ler("src/app/(dashboard)/admin/avaliadores/page.tsx");
  assert.match(p, /function FormAcaoAdmin\(\{ soLeitura, \.\.\.props \}: ComponentProps<typeof FormAcao> & \{ soLeitura: boolean \}\) \{\s*return soLeitura \? <SoLeituraQa className="mt-2" \/> : <FormAcao \{\.\.\.props\} \/>;/);
  assert.equal((p.match(/<FormAcao\b/g) ?? []).length, 1, "só o desvio usa <FormAcao>");
  assert.ok((p.match(/<FormAcaoAdmin soLeitura=\{soLeitura\}/g) ?? []).length >= 7, "os 7 formulários usam o desvio");
});

test("Vistoria: as ações de escrita dos formulários recusam o observador no servidor", () => {
  const ALVOS: [string, string[]][] = [
    ["src/lib/vistoria/actions.ts", ["adminCriarAvaliacaoTeste", "adminResolverFila", "adminRevisarAuditoria", "adminSalvarPreco", "adminDecidirCredenciamento"]],
    ["src/lib/vistoria/laudo-actions.ts", ["adminAbrirVerificacao", "adminResolverBloqueio"]],
  ];
  for (const [arquivo, fns] of ALVOS) {
    const s = ler(arquivo);
    for (const fn of fns) {
      const i = s.search(new RegExp(`export async function ${fn}\\b`));
      assert.ok(i >= 0, fn);
      const c = s.slice(i, s.indexOf("\n}\n", i));
      assert.match(c, /recusaObservador\(/, fn);
    }
  }
});

test("Agentes: aceite e 'virar ordem' viram 'Só leitura'; o chat avisa que pedido de ação não é registrado", () => {
  assert.match(ler("src/app/(dashboard)/admin/agentes/page.tsx"), /<CentralAgentes [^>]*soLeitura=\{soLeitura\}/);
  const c = ler("src/app/(dashboard)/admin/agentes/central-client.tsx");
  assert.match(c, /const SoLeituraCtx = createContext\(false\);/);
  assert.match(c, /<SoLeituraCtx\.Provider value=\{!!props\.soLeitura\}>/);
  assert.match(c, /function AceiteOrdem[\s\S]*?useContext\(SoLeituraCtx\)[\s\S]*?<SoLeituraQa/);
  assert.match(c, /data-testid="agentes-so-leitura"/);
  assert.equal((c.match(/onClick=\{\(\) => virarOrdem\(/g) ?? []).length, 2, "os dois botões continuam, só para quem não é observador");
  assert.match(c, /soLeitura \? <SoLeituraQa \/> : \(\s*<button className="text-xs font-semibold text-forest hover:underline" onClick=\{\(\) => virarOrdem\(chave, f\.slug, f\.texto\)\}>/);
});
