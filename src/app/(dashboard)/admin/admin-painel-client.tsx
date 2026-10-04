"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Home, Users, ClipboardList, FileSignature, Megaphone, ShieldCheck } from "lucide-react";
import { PageTitle, Panel, StatCard } from "@/components/dashboard/primitives";
import { MotivoDialog } from "@/components/admin/motivo-dialog";
import { revisarChecklist, type ChecklistPendente, type ResumoAdmin } from "@/lib/data/admin-painel";
import { cn } from "@/lib/utils";

const DOC_LABEL: Record<string, { texto: string; tom: string }> = {
  approved: { texto: "Aprovado", tom: "text-emerald-700" },
  pending: { texto: "Em análise", tom: "text-amber-700" },
  rejected: { texto: "Recusado", tom: "text-red-600" },
  none: { texto: "Não enviado", tom: "text-muted" },
};

export function AdminPainelClient({
  resumo,
  checklists,
  aviso,
}: {
  resumo: ResumoAdmin | null;
  checklists: ChecklistPendente[];
  aviso: string | null;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<Record<string, string>>({});
  const [recusando, setRecusando] = useState<ChecklistPendente | null>(null);

  async function aprovar(c: ChecklistPendente) {
    setOcupado(c.id);
    setErro((e) => ({ ...e, [c.id]: "" }));
    const res = await revisarChecklist(c.id, true);
    setOcupado(null);
    // Só sai da fila quando o BANCO confirmou; senão mostra o erro na linha.
    if (res.ok) router.refresh();
    else setErro((e) => ({ ...e, [c.id]: res.error ?? "Não foi possível aprovar." }));
  }

  async function recusar(motivo: string): Promise<string | null> {
    if (!recusando) return null;
    const res = await revisarChecklist(recusando.id, false, motivo);
    if (!res.ok) return res.error ?? "Não foi possível recusar.";
    setRecusando(null);
    router.refresh();
    return null;
  }

  return (
    <>
      <PageTitle title="Administração" subtitle="Números reais da plataforma e checklists para revisar." />

      {aviso && (
        <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {aviso}
        </p>
      )}

      <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Usuários" value={resumo?.usuarios ?? "—"} icon={Users} />
        <StatCard label="Proprietários" value={resumo?.proprietarios ?? "—"} icon={Users} />
        <StatCard label="Inquilinos" value={resumo?.inquilinos ?? "—"} icon={Users} />
        <StatCard label="Imóveis ativos" value={resumo?.imoveisAtivos ?? "—"} icon={Home} />
        <StatCard label="Rascunhos" value={resumo?.imoveisRascunho ?? "—"} icon={Home} />
        <StatCard label="Pedidos ativos" value={resumo?.pedidosAtivos ?? "—"} icon={Megaphone} href="/admin/pedidos" />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard label="Checklists pendentes" value={resumo?.checklistsPendentes ?? "—"} icon={ClipboardList} />
        <StatCard
          label="Documentos pendentes"
          value={resumo?.documentosPendentes ?? "—"}
          icon={FileSignature}
          href="/admin/documentos"
        />
      </div>

      <Panel title="Checklists aguardando revisão" className="p-0 pt-6">
        <div className="overflow-x-auto px-6 pb-6">
          {checklists.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Nenhum checklist aguardando revisão.</p>
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-2 font-medium">Proprietário</th>
                  <th className="py-2 font-medium">Imóvel</th>
                  <th className="py-2 font-medium">Pontuação</th>
                  <th className="py-2 font-medium">Elegível</th>
                  <th className="py-2 font-medium">Documento</th>
                  <th className="py-2 font-medium">Enviado</th>
                  <th className="py-2 text-right font-medium">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage-200">
                {checklists.map((c) => {
                  const doc = DOC_LABEL[c.documento] ?? DOC_LABEL.none;
                  return (
                    <tr key={c.id} className={cn(ocupado === c.id && "opacity-60")}>
                      <td className="py-3 font-medium text-ink">{c.ownerNome}</td>
                      <td className="py-3 text-muted">{c.imovel ?? "— (sem imóvel ainda)"}</td>
                      <td className="py-3">
                        {c.nota == null ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <>
                            <span className="font-semibold text-forest">{c.nota}</span>
                            <span className="text-muted">/100</span>
                          </>
                        )}
                      </td>
                      <td className="py-3">
                        {c.elegivel ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <ShieldCheck className="h-4 w-4" /> Sim
                          </span>
                        ) : (
                          <span className="text-red-600">Não</span>
                        )}
                      </td>
                      <td className={cn("py-3", doc.tom)}>{doc.texto}</td>
                      <td className="py-3 text-muted">
                        {c.criadoEm ? new Date(c.criadoEm).toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="py-3">
                        {c.proprio ? (
                          <p className="text-right text-xs text-muted">Seu checklist: outro admin revisa.</p>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => aprovar(c)}
                              disabled={ocupado === c.id}
                              className="inline-flex items-center gap-1 rounded-full bg-forest px-3 py-1.5 text-xs font-medium text-white hover:bg-forest-700 disabled:opacity-60"
                            >
                              <Check className="h-3.5 w-3.5" /> Aprovar
                            </button>
                            <button
                              onClick={() => setRecusando(c)}
                              disabled={ocupado === c.id}
                              className="inline-flex items-center gap-1 rounded-full border border-sage-200 px-3 py-1.5 text-xs font-medium text-ink hover:border-red-300 hover:text-red-600 disabled:opacity-60"
                            >
                              <X className="h-3.5 w-3.5" /> Recusar
                            </button>
                          </div>
                        )}
                        {erro[c.id] && (
                          <p role="alert" className="mt-1 text-right text-xs text-red-600">
                            {erro[c.id]}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Panel>

      <MotivoDialog
        // key: cada abertura começa limpa (o motivo digitado e cancelado não
        // reaparece na próxima recusa).
        key={recusando?.id ?? "fechado"}
        open={!!recusando}
        titulo="Recusar checklist"
        descricao={
          recusando
            ? `${recusando.ownerNome}${recusando.imovel ? " · " + recusando.imovel : ""}. O motivo vai por e-mail ao proprietário.`
            : undefined
        }
        confirmar="Recusar"
        onCancel={() => setRecusando(null)}
        onConfirm={recusar}
      />
    </>
  );
}
