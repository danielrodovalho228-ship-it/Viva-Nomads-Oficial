"use client";

import { useState } from "react";
import { ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AVISO_CONTEUDO_PROPRIO,
  LIMITE_TEXTO_IMPORTAR,
  organizarAnuncio,
  type AnuncioOrganizado,
} from "@/lib/anuncio/importar-anuncio";
import { AMENITY_LABEL, propertyTypeLabel } from "@/lib/amenities";

/** Ordem 4c178768: o dono cola o texto do próprio anúncio, confere o que foi organizado e só então aplica. */
export function ImportarAnuncio({ onAplicar }: { onAplicar: (a: AnuncioOrganizado) => void }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [r, setR] = useState<AnuncioOrganizado | null>(null);
  const [aplicado, setAplicado] = useState(false);

  const linhas = r
    ? ([
        ["Título", r.titulo],
        ["Tipo", r.tipo ? propertyTypeLabel(r.tipo) : ""],
        ["Quartos", r.quartos != null ? String(r.quartos) : ""],
        ["Banheiros", r.banheiros != null ? String(r.banheiros) : ""],
        ["Área", r.areaM2 != null ? `${r.areaM2} m²` : ""],
        ["Vagas", r.vagas != null ? String(r.vagas) : ""],
        ["Comodidades", r.comodidades.map((k) => AMENITY_LABEL[k] ?? k).join(", ")],
        ["Aceita pet", r.aceitaPet == null ? "" : r.aceitaPet ? "Sim" : "Não"],
        ["Permite fumar", r.permiteFumar == null ? "" : r.permiteFumar ? "Sim" : "Não"],
      ] as [string, string][])
    : [];

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-dashed border-sage-300 px-4 py-3 text-left text-sm text-forest hover:bg-sage-50"
        data-testid="importar-abrir"
      >
        <ClipboardPaste className="h-4 w-4 shrink-0" />
        Já tem um anúncio em outro site? Importar meu anúncio
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-sage-200 p-4" data-testid="importar-anuncio">
      <p className="text-sm font-medium text-ink">Importar meu anúncio</p>
      <p className="mt-1 text-xs text-muted" data-testid="importar-aviso">{AVISO_CONTEUDO_PROPRIO}</p>
      <textarea
        value={texto}
        onChange={(e) => { setTexto(e.target.value); setR(null); setAplicado(false); }}
        maxLength={LIMITE_TEXTO_IMPORTAR}
        rows={6}
        placeholder="Cole aqui o texto do seu anúncio"
        aria-label="Texto do seu anúncio"
        className="input mt-3 w-full"
        data-testid="importar-texto"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="gold" onClick={() => setR(organizarAnuncio(texto))} disabled={texto.trim().length < 10} data-testid="importar-organizar">
          Organizar
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setAberto(false); setR(null); setTexto(""); }}>
          Cancelar
        </Button>
      </div>

      {r && (
        <div className="mt-4" data-testid="importar-revisao">
          <p className="text-sm font-medium text-ink">Confira antes de aplicar</p>
          <dl className="mt-2 divide-y divide-sage-100 rounded-lg border border-sage-100 text-sm">
            {linhas.map(([rotulo, valor]) => (
              <div key={rotulo} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-muted">{rotulo}</dt>
                <dd className="text-ink sm:text-right">{valor || "—"}</dd>
              </div>
            ))}
          </dl>
          {r.avisos.map((a) => (
            <p key={a} className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{a}</p>
          ))}
          <p className="mt-2 text-xs text-muted">
            O que não estava no texto fica em branco. Suas fotos você envia na etapa “Fotos” (JPG, PNG ou WebP), e tudo pode ser editado depois.
          </p>
          <Button
            size="sm"
            className="mt-3"
            onClick={() => { onAplicar(r); setAplicado(true); }}
            data-testid="importar-aplicar"
          >
            Aplicar ao meu anúncio
          </Button>
          {aplicado && <p className="mt-2 text-xs font-medium text-forest" role="status" data-testid="importar-aplicado">Aplicado. Revise nas próximas etapas.</p>}
        </div>
      )}
    </div>
  );
}
