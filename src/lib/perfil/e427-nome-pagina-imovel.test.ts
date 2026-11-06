/* Roda: node --test src/lib/perfil/e427-nome-pagina-imovel.test.ts
  E427 (resto; prova ao vivo 05/11, rodada qa-e413-e414-e427): na visita confirmada o morador vê o nome COMPLETO do dono em
  "Quem recebe" e em /proprietario/[id], mas "Sobre o proprietário" na página do anúncio seguia com o nome abreviado
  ("Daniel P.") — a MESMA pessoa com dois nomes. Auditoria da página pública do anúncio:
   1. "Sobre o proprietário" (OwnerCard): só mostrava o nome curto, mesmo para quem tem o aceite;
   2. o caminho de reserva do OwnerCard (perfil público indisponível) caía em `owner.name`/`ownerName`, que vinham do banco
      com o nome INTEIRO (ou o e-mail) — a página pública às vezes mostrava curto, às vezes completo, e o nome inteiro seguia
      no que chega ao navegador.
  Regra aprovada: antes do aceite, o nome curto (nomeCurto) para todos; depois do aceite, o completo (nomeCompleto), só para
  quem tem o aceite com ESTE dono — o mesmo critério e a mesma função de /proprietario/[id]. A página do anúncio é estática
  (revalidate 60 s, indexável): o nome completo nunca entra no HTML dela; chega depois, do servidor, a quem tem o aceite
  (fail-closed). Nenhuma exposição nova.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nomeCompleto, nomeCurto } from "./perfil-publico.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("as duas formas do mesmo nome: curto para o público, completo para quem tem o aceite", () => {
  assert.equal(nomeCurto("Daniel Pereira 1"), "Daniel P.");
  assert.equal(nomeCompleto("Daniel Pereira 1"), "Daniel Pereira 1");
  assert.equal(nomeCurto("daniel@exemplo.com"), null);
  assert.equal(nomeCompleto("daniel@exemplo.com"), null);
});

test("origem do anúncio: o nome do dono que vai para a página pública já sai abreviado (nunca o nome inteiro nem o e-mail)", () => {
  const src = ler("src/lib/data/properties.ts");
  assert.match(src, /ownerName: nomeCurto\(ownerRow\?\.full_name\) \?\? base\.ownerName,/);
  assert.match(src, /name: nomeCurto\(ownerRow\.full_name\) \?\? "Proprietário",/);
  assert.doesNotMatch(src, /ownerName: ownerRow\?\.full_name/);
  assert.doesNotMatch(src, /name: ownerRow\.full_name/);
  assert.match(src, /import \{[^}]*\bnomeCurto\b[^}]*\} from "@\/lib\/perfil\/perfil-publico"/);
});

test("ação de servidor: devolve o nome completo só pela função fail-closed de /proprietario/[id]", () => {
  const src = ler("src/lib/data/nome-dono-actions.ts");
  assert.match(src, /^"use server";/);
  assert.match(src, /import \{ nomeCompletoParaQuemTemAceite \} from "@\/lib\/data\/perfil-proprietario";/);
  assert.match(src, /export async function nomeDoDonoDepoisDoAceite\(donoId: string\): Promise<string \| null> \{/);
  assert.match(src, /return await nomeCompletoParaQuemTemAceite\(donoId\)/);
  assert.match(src, /catch \{\s*return null;/);
});

test("OwnerCard: pede o nome do aceite depois de abrir, só em anúncio real, e usa o MESMO nome no cartão, na foto e no título", () => {
  const src = ler("src/components/property/owner-card.tsx");
  assert.match(src, /import \{ nomeDoDonoDepoisDoAceite \} from "@\/lib\/data\/nome-dono-actions";/);
  assert.match(src, /const \[nomeAceite, setNomeAceite\] = useState<string \| null>\(null\);/);
  assert.match(src, /useEffect\(\(\) => \{[\s\S]*?if \(exemplo \|\| !donoId\) return;[\s\S]*?nomeDoDonoDepoisDoAceite\(donoId\)/);
  assert.match(src, /const nomeExibido = nomeAceite \?\? d\.nome;/);
  assert.match(src, /<AvatarDono nome=\{nomeExibido\}/);
  assert.match(src, /data-testid="proprietario-nome"[^>]*>\s*\{nomeExibido\}/);
  assert.doesNotMatch(src, /\{d\.nome\}/);
});

test("a página do anúncio segue estática: o servidor dela não lê a sessão para o nome", () => {
  const page = ler("src/app/(public)/imoveis/[id]/page.tsx");
  assert.match(page, /export const revalidate = 60;/);
  assert.doesNotMatch(page, /nomeCompletoParaQuemTemAceite|nomeDoDonoDepoisDoAceite/);
});
