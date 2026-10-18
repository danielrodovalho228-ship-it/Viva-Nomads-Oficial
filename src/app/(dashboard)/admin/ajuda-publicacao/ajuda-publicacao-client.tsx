"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HandHelping, Hammer, Send } from "lucide-react";
import { PageTitle, Panel, StatCard } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { mudarStatusAjudaPublicacao, type PedidoAjuda } from "@/lib/data/ajuda-publicacao-actions";
import { proximosStatus, ROTULO_STATUS, type StatusAjuda } from "@/lib/ajuda-publicacao/ajuda";

const TOM: Record<StatusAjuda, string> = {
  recebido: "bg-amber-50 text-amber-800",
  em_montagem: "bg-blue-50 text-blue-700",
  enviado_dono: "bg-green-50 text-green-800",
  aprovado_dono: "bg-green-100 text-green-900",
  ajustes_pedidos: "bg-amber-50 text-amber-800",
  cancelado: "bg-surface-2 text-muted",
};
const ACAO: Partial<Record<StatusAjuda, string>> = {
  em_montagem: "Começar a montar",
  enviado_dono: "Enviar para o dono aprovar",
  cancelado: "Cancelar",
};

function data(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function AjudaPublicacaoClient({ fila }: { fila: PedidoAjuda[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<Record<string, string>>({});
  const contar = (s: StatusAjuda) => fila.filter((p) => p.status === s).length;

  async function mover(id: string, para: StatusAjuda) {
    setBusy(id);
    setErro((e) => ({ ...e, [id]: "" }));
    const r = await mudarStatusAjudaPublicacao(id, para);
    setBusy(null);
    if (!r.ok) setErro((e) => ({ ...e, [id]: r.error ?? "Não foi possível mudar a etapa." }));
    router.refresh();
  }

  return (
    <>
      <PageTitle
        title="Publicamos para você"
        subtitle="Pedidos de donos que querem ajuda para montar o anúncio. O dono aprova o rascunho antes de publicar."
      />
      <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
        <StatCard label="Recebidos" value={contar("recebido")} icon={HandHelping} />
        <StatCard label="Em montagem" value={contar("em_montagem")} icon={Hammer} />
        <StatCard label="Com o dono" value={contar("enviado_dono")} icon={Send} />
      </div>
      <Panel data-testid="ajuda-fila">
        {fila.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Nenhum pedido ainda.</p>
        ) : (
          <ul className="divide-y divide-sage-200">
            {fila.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between" data-testid="ajuda-item">
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {p.owner_nome || "Proprietário"} <span className="text-xs font-normal text-muted">· {data(p.criado_em)}</span>
                  </p>
                  {p.link_anuncio && <p className="mt-1 break-all text-sm text-muted">{p.link_anuncio}</p>}
                  {p.texto_anuncio && <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-muted">{p.texto_anuncio}</p>}
                  {!!p.fotos?.length && (
                    <ul className="mt-2 flex flex-wrap gap-2" data-testid="ajuda-item-fotos">
                      {p.fotos.map((u) => (
                        <li key={u}>
                          <a href={u} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={u} alt="Foto enviada pelo dono" loading="lazy" className="h-16 w-16 rounded-lg object-cover" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  {p.observacao && <p className="mt-1 text-xs text-muted">Recado: {p.observacao}</p>}
                  {erro[p.id] && <p className="mt-1 text-xs text-red-600" role="alert">{erro[p.id]}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", TOM[p.status])}>{ROTULO_STATUS[p.status]}</span>
                  {proximosStatus(p.status).map((s) => (
                    <Button key={s} size="sm" variant={s === "cancelado" ? "outline" : "gold"} disabled={busy === p.id} onClick={() => mover(p.id, s)}>
                      {s === "em_montagem" ? "Começar a montar" : ACAO[s]}
                    </Button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
