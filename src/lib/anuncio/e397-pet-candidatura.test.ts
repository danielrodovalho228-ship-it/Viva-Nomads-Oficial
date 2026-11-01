/*
  E397 (grave) — o pet do morador (ex.: Totó) ia AUTOMATICAMENTE na candidatura mesmo quando o imóvel não aceita
  animais. Regra: a candidatura só leva pet quando o anúncio aceita animais (pets_allowed === true); desmarcado ou não
  informado = não aceita. Vale para o que o DONO vê (ficha, resumo e "Com 1 pet" na lista) e para o aviso ao MORADOR.
  Roda: node --test src/lib/anuncio/e397-pet-candidatura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { petsVaoNaCandidatura } from "./ficha-pet-dono.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("regra: só com 'aceita pets' marcado; false, null e undefined = nenhum pet na candidatura", () => {
  assert.equal(petsVaoNaCandidatura(true), true);
  assert.equal(petsVaoNaCandidatura(false), false);
  assert.equal(petsVaoNaCandidatura(null), false);
  assert.equal(petsVaoNaCandidatura(undefined), false);
});

test("dono: a ficha e o resumo do pet só existem quando o imóvel aceita animais", () => {
  const s = ler("src/lib/data/pets-candidatura.ts");
  const resumo = s.slice(s.indexOf("export async function resumoFichaPets"), s.indexOf("export async function fichaPetsDaCandidatura"));
  assert.match(resumo, /select\("pets_allowed"\)[\s\S]{0,200}if \(!petsVaoNaCandidatura\([\s\S]{0,80}\)\) return null;/);
  const ficha = s.slice(s.indexOf("export async function fichaPetsDaCandidatura"));
  assert.match(ficha, /if \(linhas\.length === 0 \|\| !petsVaoNaCandidatura\(petsAllowed\)\) return vazio;/);
});

test("dono: a lista de interessados não mostra pet (nem ficha nem 'Com 1 pet') em imóvel que não aceita", () => {
  const s = ler("src/lib/data/leads.ts");
  assert.match(s, /property:properties!leads_property_id_fkey \( title, pets_allowed \)/);
  assert.match(s, /const comPets = petsVaoNaCandidatura\(r\.property\?\.pets_allowed\);/);
  assert.match(s, /const fichaPet = comPets && donoVeFichaPet\(/);
  assert.match(s, /pets: fichaPet \|\| !comPets \? 0 : \(pets\.get\(r\.tenant_id\) \?\? 0\),/);
});

test("morador: em imóvel que não aceita animais, o aviso diz que os pets NÃO vão (nunca 'Seus pets vão na candidatura')", () => {
  const s = ler("src/components/property/aviso-pet-candidatura.tsx");
  const naoVai = s.indexOf("if (!petsVaoNaCandidatura(petsAllowed))");
  const vai = s.lastIndexOf("Seus pets vão na candidatura");
  assert.ok(naoVai > 0 && vai > naoVai, "a checagem vem antes do bloco 'Seus pets vão na candidatura'");
  assert.match(s, /data-testid="pet-candidatura-nao-vai"/);
  assert.match(s, /AVISO_PETS_NAO_VAO = "Este imóvel não aceita animais\. Seus pets não vão na candidatura\."/);
});
