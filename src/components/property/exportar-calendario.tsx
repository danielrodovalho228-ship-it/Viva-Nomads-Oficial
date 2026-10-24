"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { linkExportacaoCalendario } from "@/lib/data/blocks-actions";

/**
 * E44 — "Exportar para outro site": o link secreto (.ics) que o dono cola no Airbnb/Booking. Lá, as datas ocupadas
 * daqui (contratos e bloqueios manuais) passam a aparecer bloqueadas. Par do "Importar datas de outro site" (Prompt 53).
 */
export function ExportarCalendario({ propertyId }: { propertyId: string }) {
  const [estado, setEstado] = useState<{ url?: string; erro?: string; demo?: boolean; carregando: boolean }>({ carregando: true });
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let vivo = true;
    linkExportacaoCalendario(propertyId)
      .then((r) => vivo && setEstado({ url: r.url, erro: r.ok ? undefined : r.error, demo: r.demo, carregando: false }))
      .catch(() => vivo && setEstado({ erro: "Não foi possível carregar o link agora.", carregando: false }));
    return () => {
      vivo = false;
    };
  }, [propertyId]);

  async function copiar() {
    if (!estado.url) return;
    try {
      await navigator.clipboard.writeText(estado.url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* sem permissão de área de transferência: o campo continua selecionável */
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-line bg-white p-4" data-testid="exportar-calendario">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Share2 className="h-4 w-4 text-sage" aria-hidden /> Exportar para outro site
      </h3>
      <p className="mt-1 text-xs text-muted">
        Cole este link no calendário do Airbnb ou do Booking (opção “importar calendário”). As datas ocupadas aqui — contratos
        e os bloqueios que você fizer — aparecem bloqueadas lá. Só as datas: nada do morador. Não compartilhe o link.
      </p>
      {estado.carregando ? (
        <p className="mt-3 text-sm text-muted">Carregando o link…</p>
      ) : estado.url ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor={`ics-${propertyId}`}>
            Link de exportação do calendário (.ics)
          </label>
          <input
            id={`ics-${propertyId}`}
            readOnly
            value={estado.url}
            onFocus={(e) => e.currentTarget.select()}
            className="min-h-11 w-full min-w-0 rounded-lg border border-line bg-surface-2 px-3 text-sm text-ink"
            data-testid="exportar-calendario-link"
          />
          <Button type="button" variant="secondary" size="sm" onClick={copiar} data-testid="exportar-calendario-copiar">
            {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copiado ? "Copiado" : "Copiar link"}
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted" data-testid="exportar-calendario-indisponivel">
          {estado.demo ? "No anúncio de exemplo não há link de calendário." : estado.erro}
        </p>
      )}
    </div>
  );
}
