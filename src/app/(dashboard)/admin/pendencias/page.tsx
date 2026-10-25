import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { centralDePendencias } from "@/lib/data/central-pendencias";
import { FILTROS_CENTRAL, ehFiltroCentral, hrefCentral, idadeHoras, textoPrazo, type FiltroCentral, type LinhaCentral } from "@/lib/admin/central-pendencias";
import { haQuantoTempo } from "@/lib/admin/decisoes-admin";
import { DecidirContestacao } from "@/components/admin/decidir-contestacao";
import { DecidirRevisaoAvaliacao } from "@/components/admin/decidir-revisao-avaliacao";
import { AnalisarFotoNivel } from "@/components/admin/analisar-foto-nivel";
import { RodarPrazos } from "@/components/conforto/rodar-prazos";
import { integracoesSimuladas } from "@/lib/integracoes";
import { rotuloDoAdmin, tituloDoAdmin } from "@/config/menu-admin";
import { DecisoesHoje } from "@/components/admin/numeros";
import { decisoesDoAdmin } from "@/lib/data/admin-decisoes";

export const metadata = { title: tituloDoAdmin("/admin/pendencias"), robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const ROTULO_GRAVIDADE = { alta: "Alta", media: "Média", baixa: "Baixa" } as const;
// Selo do admin: pill branca com texto (vermelho/âmbar só para o estado).
const COR_GRAVIDADE = { alta: "text-red-700", media: "text-amber-800", baixa: "text-muted" } as const;

const LADOS = [
  { lado: "equipe", titulo: "Decide a equipe da Viva" },
  { lado: "proprietario", titulo: "Esperando o proprietário" },
  { lado: "morador", titulo: "Esperando o morador" },
] as const;

/**
 * Admin → Central de Pendências (Adendo 59.1, item 6): uma fila com filtros. Amplia o topo de decisões (mesma contagem):
 * contestações e "não confere" do padrão mínimo e do nível, manutenção fora do prazo, adequações, fotos de nível,
 * documentos e as confirmações de 48 h do morador. Contas de teste ficam à parte.
 */
export default async function CentralDePendenciasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const filtro = ehFiltroCentral(sp.filtro) ? sp.filtro : null;
  const admin = createAdminClient();
  const agora = new Date();
  // ADMIN-4: as filas de operação (antes na inicial) abrem a página; a inicial mostra as 5 primeiras delas.
  const [central, decisoes] = await Promise.all([
    admin ? centralDePendencias(admin, agora, filtro).catch(() => null) : null,
    filtro ? null : decisoesDoAdmin(agora).catch(() => null),
  ]);
  return (
    <div data-testid="central-pendencias">
      <PageTitle
        title={rotuloDoAdmin("/admin/pendencias")}
        subtitle="Uma fila só. Gravidade, prazo e idade de cada item; a ação em um toque. Contas de teste à parte."
        action={
          <Link href="/admin" className="text-sm text-forest underline">
            Voltar à visão geral
          </Link>
        }
      />
      {!filtro && <DecisoesHoje decisoes={decisoes} nivel="h2" />}
      {!central && (
        <p role="alert" className="mb-4 rounded-xl border border-line bg-white px-4 py-3 text-sm text-amber-800">
          Não foi possível ler as pendências agora. Tente de novo em instantes.
        </p>
      )}
      {central && (
        <>
          <DecisoesDaCentral contagens={central.contagens} total={central.total} filtro={filtro} />
          <Panel title={filtro ? FILTROS_CENTRAL.find((f) => f.chave === filtro)!.rotulo : "Todas as pendências"}>
            {central.linhas.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="Nada pendente aqui"
                text="Quando surgir um item nesta fila, ele aparece com o prazo e a ação."
                action={<ButtonLink href="/admin" variant="secondary" size="sm">Voltar à visão geral</ButtonLink>}
              />
            ) : (
              <ul className="divide-y divide-sage-100">
                {central.linhas.map((l) => (
                  <Linha key={`${l.filtro}-${l.id}`} l={l} agora={agora} />
                ))}
              </ul>
            )}
          </Panel>
          {central.teste.length > 0 && (
            <Panel title={`Contas de teste · ${central.teste.length}`} className="mt-6" data-testid="central-teste">
              <ul className="divide-y divide-sage-100">
                {central.teste.map((l) => (
                  <Linha key={`t-${l.filtro}-${l.id}`} l={l} agora={agora} />
                ))}
              </ul>
            </Panel>
          )}
        </>
      )}
      <Panel title="Prazos" className="mt-6">
        <p className="mb-3 text-sm text-muted">A rotina roda sozinha a cada 15 minutos: lembretes do padrão mínimo, anúncios fora da busca, confirmações por prazo e avisos da manutenção.</p>
        <RodarPrazos laboratorio={integracoesSimuladas()} />
      </Panel>
    </div>
  );
}

/**
 * Adendo 59.1, Parte A — "decisões primeiro" (padrão do Prompt 46): no topo, o que espera decisão, uma linha por fila com
 * a contagem e o botão que abre a fila. A equipe decide primeiro; depois o que espera o proprietário e o morador.
 * As filas do 59-A (manutenção fora do prazo e contestações) são filtros daqui.
 */
function DecisoesDaCentral({ contagens, total, filtro }: { contagens: Record<FiltroCentral, number>; total: number; filtro: FiltroCentral | null }) {
  return (
    <section aria-labelledby="central-decisoes-titulo" className="mb-8" data-testid="central-decisoes" data-total={total}>
      <h2 id="central-decisoes-titulo" className="font-title text-2xl font-semibold text-ink sm:text-[28px]">
        {total === 0 ? "Nada pendente agora" : total === 1 ? "1 pendência esperando ação" : `${total} pendências esperando ação`}
      </h2>
      {LADOS.map(({ lado, titulo }) => {
        const filas = FILTROS_CENTRAL.filter((f) => f.lado === lado && contagens[f.chave] > 0);
        if (!filas.length) return null;
        return (
          <div key={lado} className="mt-4" data-testid={`central-lado-${lado}`}>
            <p className="text-xs font-semibold text-muted">{titulo}</p>
            <ul className="mt-1 divide-y divide-line border-y border-line">
              {filas.map((f) => (
                <li key={f.chave} className="flex flex-wrap items-center justify-between gap-3 py-3" data-decisao={f.chave} data-ativo={filtro === f.chave ? "1" : "0"}>
                  <span className={`min-w-0 ${filtro === f.chave ? "font-semibold text-forest" : "font-semibold text-ink"}`}>
                    <span className="tabular-nums">{contagens[f.chave]}</span> · {f.rotulo}
                  </span>
                  <ButtonLink href={hrefCentral(f.chave)} variant="secondary" size="sm" data-testid={`central-filtro-${f.chave}`} data-n={contagens[f.chave]}>
                    Abrir
                  </ButtonLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {filtro && (
        <Link href="/admin/pendencias" className="mt-3 inline-block text-sm text-forest underline" data-testid="central-filtro-todos" data-n={total}>
          Ver todas as pendências
        </Link>
      )}
    </section>
  );
}

function Linha({ l, agora }: { l: LinhaCentral; agora: Date }) {
  const prazo = textoPrazo(l.prazoAte, agora);
  return (
    <li className="space-y-1 py-3 text-sm" data-testid={l.filtro === "conforto_contestacoes" ? "contestacao-linha" : "central-linha"} data-filtro={l.filtro} data-gravidade={l.gravidade}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 font-semibold text-ink">{l.titulo}</p>
        <span className={`rounded-full border border-line bg-white px-2 py-1 text-xs ${COR_GRAVIDADE[l.gravidade]}`}>{ROTULO_GRAVIDADE[l.gravidade]}</span>
      </div>
      {l.detalhe && <p className="break-words text-muted">{l.detalhe}</p>}
      <p className="text-xs text-muted">
        Na fila {haQuantoTempo(idadeHoras(l.desde, agora)) ?? "agora"}
        {prazo ? ` · ${prazo}` : ""}
        {" · "}
        <Link href={l.acao.href} className="text-forest underline">
          {l.acao.rotulo}
        </Link>
      </p>
      {l.filtro === "conforto_contestacoes" && l.ref?.pendencia && <DecidirContestacao id={l.ref.pendencia} />}
      {l.filtro === "avaliacoes_contestadas" && l.ref?.revisao && <DecidirRevisaoAvaliacao id={l.ref.revisao} />}
      {l.filtro === "fotos_nivel" && l.ref?.imovel && l.ref?.chave && (
        <div className="flex flex-wrap items-center gap-3" data-testid="foto-nivel-linha" data-chave={l.ref.chave}>
          {l.ref.foto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={l.ref.foto} alt={`Foto: ${l.titulo}`} className="h-20 w-20 rounded-lg object-cover" />
          )}
          <AnalisarFotoNivel imovel={l.ref.imovel} chave={l.ref.chave} />
        </div>
      )}
    </li>
  );
}
