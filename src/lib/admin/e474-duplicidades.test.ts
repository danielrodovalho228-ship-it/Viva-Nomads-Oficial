/* Roda: node --test src/lib/admin/e474-duplicidades.test.ts — E474: um caminho só por destino no admin. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("E474 (ii): a capa com os números é só da aba Equipe; o Diário é o histórico, sem repetir a última ronda de cada agente", () => {
  const c = ler("app/(dashboard)/admin/agentes/central-client.tsx");
  assert.match(c, /\{aba === "Equipe" && \(\s*<section className="grid items-end gap-4 py-8/);
  const diario = c.slice(c.indexOf("function Diario("), c.indexOf("function Rondas("));
  assert.doesNotMatch(diario, /Última ronda de cada agente/);
  assert.doesNotMatch(diario, /ultimaPorAgente/);
  assert.match(diario, /<Rondas dados=\{dados\}/);
  assert.match(diario, /data-testid="diario"/);
});

test("E474 (iii) + E788: o selo 'Equipe' não é link para a Conta — é o avatar que abre o menu da Conta; 'Minha conta →' segue no rodapé", () => {
  // Asserção alterada pelo E788 (reprova da prova ao vivo de 11/11): o selo só-texto ("cursor-default") foi reprovado
  // como inerte; agora ele é o MenuConta (botão com menu), não um <Link> direto para /dashboard/conta.
  const selo = ler("components/layout/papel-ativo.tsx");
  const equipe = selo.slice(selo.indexOf("export function SeloEquipe"));
  assert.ok(equipe.length > 0);
  assert.doesNotMatch(equipe, /<Link|href=/);
  assert.match(equipe, /<MenuConta /);
  // O caminho que fica: o item do rodapé da barra lateral do admin.
  assert.match(ler("config/menu-admin.ts"), /MINHA_CONTA_ADMIN = \{ rotulo: "Minha conta →", href: "\/dashboard\/conta" \}/);
});
