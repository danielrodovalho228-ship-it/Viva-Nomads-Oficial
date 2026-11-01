/*
  Auditoria de erros e estados vazios — achado nº 17: no admin, a fila do Atendimento (chamados e aprovações) e a fila
  de Fotos de perfil mostravam "Nada pendente" quando a leitura do banco falhava — chamados P1/P2 e denúncias de foto
  ficariam sem resposta. Agora as páginas pedem com `exigir`: a falha lança e o admin mostra "Não conseguimos abrir esta
  tela" com "Tentar de novo".
  Roda: node --test src/lib/data/filas-atendimento-fotos-falha.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("as filas lançam na falha do banco quando a página pede com exigir", () => {
  const at = ler("src/lib/data/atendimento-actions.ts");
  assert.match(at, /export async function filaAtendimento\(f: FiltrosFila = \{\}, opcoes: \{ exigir\?: boolean \} = \{\}\)/);
  assert.match(at, /if \(error && opcoes\.exigir\) throw new Error\(MSG_FILA_ATENDIMENTO_NAO_CARREGOU\);/);
  const fo = ler("src/lib/data/fotos-perfil-actions.ts");
  assert.match(fo, /export async function filaFotosPerfil\(opcoes: \{ exigir\?: boolean \} = \{\}\)/);
  assert.match(fo, /if \(error && opcoes\.exigir\) throw new Error\(MSG_FILA_FOTOS_NAO_CARREGOU\);/);
});

test("as páginas do admin pedem com exigir", () => {
  const at = ler("src/app/(dashboard)/admin/atendimento/page.tsx");
  assert.match(at, /filaAtendimento\(filtros, \{ exigir: true \}\)/);
  assert.match(at, /filaAtendimento\(\{ aprovacao: true \}, \{ exigir: true \}\)/);
  assert.match(ler("src/app/(dashboard)/admin/fotos-perfil/page.tsx"), /await filaFotosPerfil\(\{ exigir: true \}\)/);
});
