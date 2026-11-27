/*
  Roda: node --test src/components/layout/e788-selo-equipe-sem-avatar.test.ts
  E788 (reprova da prova ao vivo de 11/11): no topo do admin o "Equipe" era inerte — primeiro um círculo que não abria nada,
  depois só o texto, sem círculo e sem clique; os dois foram reprovados. Decisão: avatar FUNCIONAL. O selo da equipe é o
  avatar (iniciais do nome completo, as mesmas do Perfil e do rodapé) + "Equipe ▾", e abre o menu da Conta
  (Minha conta · Ajuda · Sair) — o mesmo componente MenuConta dos outros papéis.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { iniciais } from "../../lib/avatar.ts";
import { itensDaEquipe } from "../../config/abas-painel.ts";

const selo = readFileSync("src/components/layout/papel-ativo.tsx", "utf8");
const casca = readFileSync("src/components/layout/dashboard-shell.tsx", "utf8");
const menu = readFileSync("src/components/layout/topo-dono.tsx", "utf8");

test("o selo da equipe é um avatar que abre o menu da Conta (não é texto inerte)", () => {
  const equipe = selo.slice(selo.indexOf("export function SeloEquipe"));
  assert.ok(equipe.length > 0, "SeloEquipe existe");
  assert.match(equipe, /<MenuConta[^>]*px="equipe"[^>]*rotulo="Equipe"/);
  assert.match(equipe, /data-testid="papel-ativo"/);
  assert.match(equipe, /data-papel="admin"/);
  // A casca usa o selo funcional na área da equipe, com o MESMO nome do avatar do rodapé e do Perfil.
  assert.match(casca, /papelAtivo \? \(\s*<PapelAtivo papel=\{papelAtivo\} nome=\{nomeAvatar\} foto=\{fotoNav\} \/>\s*\) : \(\s*<SeloEquipe nome=\{nomeAvatar\} foto=\{fotoNav\} itens=\{itensDaEquipe\(\)\} onAcao=\{aoAcaoConta\} \/>/);
  // O botão do menu mostra o rótulo recebido (Equipe), com o avatar ao lado.
  assert.match(menu, /rotulo\?: string;/);
  assert.match(menu, /\{p\.rotulo \?\? "Conta"\}/);
});

test("o menu da equipe: Minha conta · Ajuda · Sair (sem 'Painel admin', já está nele; sem troca de modo)", () => {
  assert.deepEqual(
    itensDaEquipe().map((i) => i.id),
    ["conta", "ajuda", "sair"]
  );
  assert.equal(itensDaEquipe().find((i) => i.id === "sair")?.acao, "sair");
});

test("papéis com Perfil seguem com avatar e link", () => {
  assert.match(selo, /<Link[\s\S]*?<Avatar/);
});

test("a inicial é sempre maiúscula (função única) e o círculo nunca a desenha abaixo de 13 px", () => {
  assert.equal(iniciais("camila"), "C");
  assert.equal(iniciais("Camila Souza"), "CS");
  const av = readFileSync("src/components/ui/avatar.tsx", "utf8");
  assert.match(av, /TAMANHO_MINIMO_INICIAL = 13/);
  assert.match(av, /Math\.max\(size \* 0\.4, TAMANHO_MINIMO_INICIAL\)/);
  assert.match(av, /rounded-full uppercase font-title/);
});
