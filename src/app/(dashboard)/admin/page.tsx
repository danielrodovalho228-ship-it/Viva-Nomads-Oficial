import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { AvisoAtendimentoAdmin } from "@/components/admin/aviso-atendimento";
import { adminDaPagina, idsContasTeste } from "@/lib/data/admin-indicadores";
import { atividadeRecente, numerosDaInicial } from "@/lib/data/admin-contagens";
import { interesseEspacoTrabalho } from "@/lib/data/admin-espaco-trabalho";
import { decisoesDoAdmin } from "@/lib/data/admin-decisoes";
import { ROTULOS_NUMEROS, RODAPE_CONTAGENS, primeirosSemDuplicata, textoRealTeste } from "@/lib/admin/contagens";
import { haQuantoTempo } from "@/lib/admin/decisoes-admin";
import { idadeHoras } from "@/lib/admin/central-pendencias";
import { ButtonLink } from "@/components/ui/button";
import { rotuloDoAdmin, tituloDoAdmin } from "@/config/menu-admin";

export const metadata = { title: tituloDoAdmin("/admin"), robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** E176 (D3): o alerta do backup mora SÓ em "Precisa da sua atenção" — nunca fica de fora do corte das 5 primeiras. */
function comBackup<T extends { chave: string }>(primeiras: T[], todas: readonly T[]): T[] {
  const backup = todas.find((l) => l.chave === "backup");
  if (!backup || primeiras.some((l) => l.chave === "backup")) return primeiras;
  return [backup, ...primeiras].slice(0, 5);
}

/**
 * ADMIN-4 — inicial enxuta do /admin (mockup admin-visao-geral): 4 números (cada um da MESMA função da página de
 * destino, contas de teste à parte) · "Precisa da sua atenção" (os 5 primeiros da Central, sem duplicata) · "Atividade
 * recente" · uma linha de saúde · o rodapé das contas de teste. Os indicadores do período moram em "Funil e
 * indicadores"; a Receita no Financeiro; os blocos de sistema em Sistema. Três leituras em paralelo.
 */
export default async function AdminPage() {
  const admin = (await adminDaPagina()) ? createAdminClient() : null;
  const agora = new Date();
  const teste = admin ? await idsContasTeste(admin).catch(() => new Set<string>()) : new Set<string>();
  const [numeros, decisoes, atividade, espaco] = await Promise.all([
    admin ? numerosDaInicial(admin, teste).catch(() => null) : null,
    admin ? decisoesDoAdmin(agora).catch(() => null) : null,
    admin ? atividadeRecente(admin, teste).catch(() => []) : [],
    admin ? interesseEspacoTrabalho(admin).catch(() => null) : null,
  ]);
  // As filas de Pendências (a mesma leitura do topo de /admin/pendencias), as 5 primeiras; duas filas que levam ao mesmo
  // lugar contam uma vez só.
  const atencao = decisoes ? comBackup(primeirosSemDuplicata(decisoes.linhas, (l) => l.href), decisoes.linhas) : [];
  // Saúde: os alertas de sistema da MESMA leitura das filas (hoje, o backup), o mesmo número da linha "alertas de backup".
  const alertas = decisoes?.linhas.find((l) => l.chave === "backup")?.n ?? 0;

  return (
    <div data-testid="admin-inicial">
      <AvisoAtendimentoAdmin />
      <PageTitle title={rotuloDoAdmin("/admin")} subtitle="O que está no ar agora e o que precisa de você." />

      <ul className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="admin-numeros">
        {(Object.keys(ROTULOS_NUMEROS) as (keyof typeof ROTULOS_NUMEROS)[]).map((k) => {
          const c = numeros?.[k] ?? null;
          return (
            <li key={k}>
              <Link href={ROTULOS_NUMEROS[k].href} className="block h-full min-h-11 rounded-lg border border-line bg-white p-4 hover:border-ink" data-testid={`admin-numero-${k}`} data-reais={c?.reais ?? ""} data-teste={c?.teste ?? ""}>
                <span className="block text-sm text-muted">{ROTULOS_NUMEROS[k].rotulo}</span>
                <span className="mt-1 block font-title text-2xl font-semibold text-ink tabular-nums sm:text-[28px]">{c ? c.reais : "—"}</span>
                {c && c.teste > 0 && <span className="block text-xs text-muted">{textoRealTeste(c)}</span>}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Precisa da sua atenção" data-testid="admin-atencao">
          {atencao.length === 0 ? (
            <p className="text-sm text-muted">Nada pendente agora.</p>
          ) : (
            <ul className="divide-y divide-line">
              {atencao.map((l) => (
                // A linha inteira é tocável (E73); o botão fica por cima, com o mesmo destino.
                <li key={l.chave} className="relative flex min-h-14 items-center justify-between gap-3 py-2" data-testid="admin-atencao-item" data-chave={l.chave} data-decisao={l.chave}>
                  <span className="min-w-0 text-sm">
                    <Link href={l.href} className="font-semibold text-ink after:absolute after:inset-0 after:content-['']" data-href={l.href} data-valor={l.n}>
                      {l.texto}
                    </Link>
                    {l.detalhe && <span className="block text-xs text-muted">{l.detalhe}</span>}
                  </span>
                  <ButtonLink href={l.href} variant="secondary" size="sm" className="relative z-10" data-testid={`decisao-${l.chave}`}>
                    {l.acao}
                  </ButtonLink>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/pendencias" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-forest underline" data-testid="admin-atencao-todas" data-n={decisoes?.total ?? 0}>
            Ver todas ({decisoes?.total ?? 0}) <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
          </Link>
        </Panel>

        <Panel title="Atividade recente" data-testid="admin-atividade">
          {atividade.length === 0 ? (
            <p className="text-sm text-muted">Nada novo por enquanto.</p>
          ) : (
            <ul className="divide-y divide-line">
              {atividade.map((a) => (
                <li key={a.id}>
                  <Link href={a.href} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm text-ink">
                    <span className="min-w-0 break-words">{a.texto}</span>
                    <span className="shrink-0 text-xs text-muted">{haQuantoTempo(idadeHoras(a.quando, agora)) ?? "agora"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {espaco && (
        <Panel title="Interesse em espaço de trabalho" className="mt-6" data-testid="admin-espaco-trabalho">
          <ul className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
            {([["oferecem", "Têm sala ou consultório"], ["procuram", "Procuram espaço fora de casa"], ["coworking", "Querem coworking"], ["responderam", "Responderam"]] as const).map(([k, rotulo]) => (
              <li key={k} data-testid={`admin-espaco-${k}`} data-reais={espaco[k].reais} data-teste={espaco[k].teste}>
                <span className="block text-muted">{rotulo}</span>
                <span className="mt-1 block font-title text-2xl font-semibold text-ink tabular-nums">{espaco[k].reais}</span>
                {espaco[k].teste > 0 && <span className="block text-xs text-muted">+ {espaco[k].teste} de teste</span>}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <p className="mt-6 text-sm" data-testid="admin-saude" data-alertas={alertas}>
        {/* E176 (D3): o alerta do backup aparece UMA vez, dentro de "Precisa da sua atenção"; aqui só o estado geral. */}
        {alertas === 0 ? <span className="text-forest">Tudo funcionando</span> : <span className="text-ink">Há alertas em “Precisa da sua atenção”.</span>}
      </p>
      <p className="mt-2 text-xs text-muted" data-testid="admin-rodape">
        {RODAPE_CONTAGENS}
      </p>
    </div>
  );
}
