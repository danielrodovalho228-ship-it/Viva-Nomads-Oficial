"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { SoLeituraQa } from "@/components/admin/so-leitura-qa";
import { dataHoraBRT } from "@/lib/datas-brasilia";
import { liberarFotoRepetida, type FotoRepetidaNaFila } from "@/lib/data/foto-repetida-admin-actions";

/** E640 (b): imóveis com foto igual à de outro anúncio — a publicação está travada até conferir a matrícula. */
export function FotosRepetidasAdmin({ itens, soLeitura = false }: { itens: FotoRepetidaNaFila[]; soLeitura?: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  if (itens.length === 0) return null;
  return (
    <Panel title="Foto igual à de outro anúncio" className="mt-6 scroll-mt-24" id="fotos-repetidas" data-testid="fotos-repetidas">
      <p className="text-sm text-muted">Estes imóveis têm foto igual (ou quase) à de outro anúncio. A publicação fica travada até conferir a matrícula: ela destrava sozinha quando a matrícula é conferida, ou você libera à mão.</p>
      <ul className="mt-3 divide-y divide-line">
        {itens.map((i) => (
          <li key={i.propertyId} className="flex flex-wrap items-center justify-between gap-3 py-3" data-testid="foto-repetida-item">
            <span className="min-w-0 text-sm">
              <span className="block font-semibold text-ink">{i.imovel}</span>
              <span className="block text-xs text-muted">
                {i.dono} · {i.fotos} {i.fotos === 1 ? "foto" : "fotos"} · {dataHoraBRT(i.abertoEm)}
              </span>
            </span>
            {soLeitura ? (
              <SoLeituraQa />
            ) : (
              <Button
                size="sm"
                variant="secondary"
                disabled={pendente}
                data-testid="foto-repetida-liberar"
                onClick={() =>
                  iniciar(async () => {
                    setMsg(null);
                    const r = await liberarFotoRepetida(i.propertyId).catch(() => ({ ok: false as const, erro: "Sem conexão. Tente de novo." }));
                    if (r.ok) router.refresh();
                    else setMsg(r.erro);
                  })
                }
              >
                Matrícula conferida: liberar
              </Button>
            )}
          </li>
        ))}
      </ul>
      {msg && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {msg}
        </p>
      )}
    </Panel>
  );
}
