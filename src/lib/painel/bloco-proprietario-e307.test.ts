/* Roda: node --test src/lib/painel/bloco-proprietario-e307.test.ts — bloco proprietário do Muse (31/10): E307–E311. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { VAZIOS_ONBOARDING } from "../onboarding/vazios.ts";
import { tituloMesBR } from "../calendario/mes-br.ts";

const ler = (p: string) => readFileSync(p, "utf8");

test("E307: Orçamentos na área do dono fala com o dono — modo proprietário decide, vazio com o próximo passo dele", () => {
  const c = ler("src/app/(dashboard)/dashboard/orcamentos/orcamentos-client.tsx");
  assert.match(c, /const modoDono = useAuthStore\(\(s\) => s\.activeMode\) === "owner";/);
  assert.match(c, /const ehDono = modoDono \|\| /);
  assert.match(c, /vazioDonoNovo\s*\?\s*VAZIOS_ONBOARDING\.orcamentosDono\.frase/);
  assert.match(c, /vazioDonoNovo\s*\?\s*VAZIOS_ONBOARDING\.orcamentosDono\.acao\.rotulo/);
  const v = VAZIOS_ONBOARDING.orcamentosDono;
  assert.doesNotMatch(v.frase, /recebeu dos proprietários|Buscar imóveis/);
  assert.match(v.frase, /Publique seu anúncio/);
  assert.equal(v.acao.href, "/dashboard/imoveis");
});

test("E308: a capa do 'Continue seu anúncio' aparece inteira (sem recorte nas bordas)", () => {
  const c = ler("src/components/painel/inicio-dono.tsx");
  assert.match(c, /className="aspect-\[16\/10\] w-full rounded-lg bg-surface-2 object-contain" data-testid="inicio-dono-foto"/);
});

test("E309: nenhum título de página repete a marca (o template já põe ' · Viva Nomads')", () => {
  const achados: string[] = [];
  const andar = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) andar(p);
      else if (/page\.tsx$/.test(n)) {
        const s = ler(p);
        for (const m of s.matchAll(/\btitle:\s*"([^"]+)"/g)) if (/[—·\-|]\s*Viva Nomads\s*$/.test(m[1])) achados.push(`${p}: ${m[1]}`);
      }
    }
  };
  andar("src/app");
  assert.deepEqual(achados, []);
  assert.match(ler("src/app/(dashboard)/dashboard/ganhos/page.tsx"), /title: "Ganhos" \}/);
});

test("E310: mês em pt-BR com 'de' minúsculo — sem CSS capitalize (que punha 'Outubro De 2026')", () => {
  assert.equal(tituloMesBR(2026, 9), "outubro de 2026");
  const agenda = ler("src/app/(dashboard)/dashboard/agenda/agenda-client.tsx");
  assert.match(agenda, /first-letter:uppercase" data-testid="agenda-mes-titulo"/);
  for (const f of ["src/app/(dashboard)/dashboard/agenda/agenda-client.tsx", "src/components/property/availability-calendar.tsx", "src/app/(dashboard)/admin/marketing/admin-marketing-client.tsx"])
    assert.doesNotMatch(ler(f), /\bcapitalize\b/, f);
});

test("E311: a foto de Meus anúncios é 4:3 e não estica com o cartão (#1724)", () => {
  const c = ler("src/app/(dashboard)/dashboard/imoveis/imoveis-client.tsx");
  assert.match(c, /aspect-\[4\/3\] w-full shrink-0 sm:w-48 sm:self-start/);
});
