/*
  L-86 (t941, Pista C): o aviso "anuncio_compartilhar" (contrato assinado → o dono recebe o cartão do anúncio) não era
  entregue: o notify não levava o e-mail do dono e a matriz deixa o evento sem push. Agora leva o e-mail.
  Roda: node --test src/lib/cartoes/l86-aviso-email.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("L-86: o aviso do cartão leva o e-mail do dono (quem assinou por último ou a outra parte)", () => {
  const s = ler("src/lib/data/contrato-assinar-actions.ts");
  assert.match(s, /const emailDono = ownerId === user\.id \? user\.email : pessoa\?\.user\?\.email;/);
  assert.match(s, /event: "anuncio_compartilhar",\s*email: emailDono \?\? undefined,\s*userId: ownerId,/);
  // A matriz segue sem push para este evento: o e-mail (e a central) é o canal.
  assert.match(ler("src/config/matriz-notificacoes.ts"), /anuncio_compartilhar: \{ categoria: "outros", papeis: \["proprietario"\], canais: SEM_PUSH \}/);
});
