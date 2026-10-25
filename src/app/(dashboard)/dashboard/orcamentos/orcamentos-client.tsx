"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { PlatformLegalNotice } from "@/components/legal-notice";
import { FILTROS_STATUS, type StatusProposta } from "@/lib/propostas/regras";
import type { InteressadoParaProposta, PropostaResumo } from "@/lib/data/propostas-actions";
import { cn, dataBR, formatBRL } from "@/lib/utils";
import { ROTULO_MENSAL, ROTULO_TOTAL_CONTRATO, ROTULO_TOTAL_MES } from "@/lib/precos";
import { StatusChip } from "@/components/propostas/status-chip";

export function OrcamentosClient({ propostas, interessados }: { propostas: PropostaResumo[]; interessados: InteressadoParaProposta[] }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<"todas" | StatusProposta>("todas");
  const [escolhendo, setEscolhendo] = useState(false);
  const [escolhido, setEscolhido] = useState("");
  const ehDono = interessados.length > 0 || propostas.some((p) => p.papel === "owner");
  const visiveis = filtro === "todas" ? propostas : propostas.filter((p) => p.status === filtro);
  const livres = interessados.filter((i) => !i.temPropostaAberta);

  return (
    <>
      <PageTitle
        title="Orçamentos"
        subtitle={ehDono ? "Propostas para os seus interessados, com contraproposta e aceite pela plataforma." : "Propostas que você recebeu dos proprietários."}
        action={
          ehDono ? (
            <Button variant="secondary" onClick={() => setEscolhendo((v) => !v)} data-testid="nova-proposta">
              <Plus className="h-4 w-4" /> Nova proposta
            </Button>
          ) : undefined
        }
      />

      {escolhendo && (
        <Panel title="Para qual interessado?" className="mb-4" data-testid="escolher-interessado">
          {livres.length === 0 ? (
            <p className="text-sm text-muted">
              Nenhum interessado sem proposta em andamento. Os interessados chegam em{" "}
              <Link href="/dashboard/leads" className="font-medium text-forest underline">
                Interessados
              </Link>
              .
            </p>
          ) : (
            <form
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                if (escolhido) router.push(`/dashboard/orcamentos/nova?interessado=${escolhido}`);
              }}
            >
              <label className="block min-w-0 flex-1">
                <span className="mb-2 block text-sm font-medium text-ink">Interessado</span>
                <select value={escolhido} onChange={(e) => setEscolhido(e.target.value)} className="input" data-testid="interessado-select" required>
                  <option value="">Selecione</option>
                  {livres.map((i) => (
                    <option key={i.leadId} value={i.leadId}>
                      {i.nome} · {i.imovel.titulo}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" disabled={!escolhido}>
                Montar proposta
              </Button>
            </form>
          )}
        </Panel>
      )}

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por status">
        {FILTROS_STATUS.map((f) => {
          const n = f.chave === "todas" ? propostas.length : propostas.filter((p) => p.status === f.chave).length;
          return (
            <button
              key={f.chave}
              type="button"
              role="tab"
              aria-selected={filtro === f.chave}
              onClick={() => setFiltro(f.chave)}
              className={cn(
                "rounded-full border px-3 py-2 text-xs font-medium transition-colors",
                filtro === f.chave ? "border-forest bg-forest text-white" : "border-sage-200 text-ink hover:border-sage",
              )}
            >
              {f.rotulo} {n > 0 && <span className="opacity-70">({n})</span>}
            </button>
          );
        })}
      </div>

      {visiveis.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={propostas.length === 0 ? "Nenhuma proposta ainda" : "Nada neste filtro"}
          text={
            propostas.length === 0
              ? ehDono
                ? "Envie uma proposta a um interessado: ele aceita, recusa ou contrapropõe por aqui."
                : "Quando um proprietário enviar uma proposta, ela aparece aqui e na conversa."
              : "Escolha outro status acima."
          }
          action={
            propostas.length > 0 ? (
              <Button variant="secondary" size="sm" onClick={() => setFiltro("todas")}>
                Ver todas
              </Button>
            ) : (
              <ButtonLink href={ehDono ? "/dashboard/leads" : "/buscar"} variant="secondary" size="sm">
                {ehDono ? "Ver interessados" : "Buscar imóveis"}
              </ButtonLink>
            )
          }
        />
      ) : (
        <>
          {/* Celular: cartões. */}
          <ul className="space-y-3 md:hidden" data-testid="lista-propostas">
            {visiveis.map((p) => (
              <li key={p.id}>
                <Link href={`/dashboard/propostas/${p.id}`} className="block rounded-xl border border-sage-200 bg-white p-4 hover:border-sage" data-testid="proposta-item">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-muted">
                        {p.numero} · v{p.versaoAtual}
                      </p>
                      <p className="truncate font-medium text-ink">{p.imovel}</p>
                      <p className="text-xs text-muted">{p.outraParte}</p>
                    </div>
                    <StatusChip status={p.status} />
                  </div>
                  <p className="mt-2 text-sm text-ink">
                    {ROTULO_MENSAL} {formatBRL(p.valorMensal)} · {ROTULO_TOTAL_MES.toLowerCase()} {formatBRL(p.totalPorMes)}
                  </p>
                  <p className="text-xs text-muted" data-testid="orcamento-conta">
                    {ROTULO_TOTAL_CONTRATO}: <strong className="text-ink">{p.conta ?? formatBRL(p.totalContrato)}</strong>
                  </p>
                  <p className="text-xs text-muted">Validade: {dataBR(p.validaAte)}</p>
                </Link>
              </li>
            ))}
          </ul>
          {/* Computador: tabela. */}
          <div className="hidden overflow-hidden rounded-xl border border-sage-200 bg-white md:block">
            <table className="w-full text-left text-sm" data-testid="tabela-propostas">
              <thead className="bg-surface-2 text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Número</th>
                  <th className="px-4 py-3 font-medium">Imóvel</th>
                  <th className="px-4 py-3 font-medium">{ehDono ? "Interessado" : "Proprietário"}</th>
                  <th className="px-4 py-3 text-right font-medium">Total do contrato</th>
                  <th className="px-4 py-3 font-medium">Validade</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Versão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage-200">
                {visiveis.map((p) => (
                  <tr key={p.id} className="cursor-pointer hover:bg-surface-2" onClick={() => router.push(`/dashboard/propostas/${p.id}`)}>
                    <td className="px-4 py-3 font-medium text-forest">
                      <Link href={`/dashboard/propostas/${p.id}`}>{p.numero}</Link>
                    </td>
                    <td className="max-w-[16rem] truncate px-4 py-3 text-ink">{p.imovel}</td>
                    <td className="px-4 py-3 text-ink">{p.outraParte}</td>
                    <td className="px-4 py-3 text-right font-semibold text-ink" title={p.conta ?? undefined}>
                      {formatBRL(p.totalContrato)}
                      {p.conta && <span className="block text-xs font-normal text-muted">{p.conta}</span>}
                    </td>
                    <td className="px-4 py-3 text-muted">{dataBR(p.validaAte)}</td>
                    <td className="px-4 py-3">
                      <StatusChip status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-muted">v{p.versaoAtual}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="mt-6">
        <PlatformLegalNotice />
      </div>
    </>
  );
}
