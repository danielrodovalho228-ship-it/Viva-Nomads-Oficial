"use client";

import { dataBRT } from "@/lib/datas-brasilia";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { ListaNumeros, NumeroHeroi } from "@/components/admin/numeros";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { mudarStatusAjudaPublicacao, type PedidoAjuda } from "@/lib/data/ajuda-publicacao-actions";
import { proximosStatus, ROTULO_STATUS, type StatusAjuda } from "@/lib/ajuda-publicacao/ajuda";
import { rotuloDoAdmin } from "@/config/menu-admin";

const TOM: Record<StatusAjuda, string> = {
  recebido: "border border-line bg-white text-amber-800",
  em_montagem: "border border-line bg-white text-forest",
  enviado_dono: "border border-line bg-white text-forest",
  aprovado_dono: "border border-line bg-white text-forest",
  ajustes_pedidos: "border border-line bg-white text-amber-800",
  cancelado: "bg-surface-2 text-muted",
};
const ACAO: Partial<Record<StatusAjuda, string>> = {
  em_montagem: "Começar a montar",
  enviado_dono: "Enviar para o dono aprovar",
  cancelado: "Cancelar",
};

function data(iso: string) {
  return dataBRT(iso);
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
        title={rotuloDoAdmin("/admin/ajuda-publicacao")}
        subtitle="Pedidos de donos que querem ajuda para montar o anúncio. O dono aprova o rascunho antes de publicar."
      />
      <NumeroHeroi rotulo="Pedidos recebidos" valor={contar("recebido")} href="#lista" />
      <ListaNumeros
        className="mb-6"
        itens={[
          { rotulo: "Em montagem", valor: contar("em_montagem"), href: "#lista" },
          { rotulo: "Com o dono", valor: contar("enviado_dono"), href: "#lista" },
        ]}
      />
      <Panel data-testid="ajuda-fila" id="lista" className="scroll-mt-24">
        {fila.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Nenhum pedido ainda.</p>
        ) : (
          <ul className="divide-y divide-sage-200">
            {fila.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between" data-testid="ajuda-item">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
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
                  <span className={cn("rounded-full px-2 py-1 text-xs font-semibold", TOM[p.status])}>{ROTULO_STATUS[p.status]}</span>
                  {proximosStatus(p.status).map((s) => (
                    <Button key={s} size="sm" variant="secondary" disabled={busy === p.id} onClick={() => mover(p.id, s)}>
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
