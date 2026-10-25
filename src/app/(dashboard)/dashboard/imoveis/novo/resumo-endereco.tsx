"use client";

import { useEffect, useState } from "react";
import { Info, MapPin } from "lucide-react";
import { PropertyMap } from "@/components/property-map-lazy";
import { UBERLANDIA_CENTER, geocodeForSave } from "@/lib/integrations/geocoding";

/** "Rua das Flores, 1230, Apto 101 – Santa Mônica, Uberlândia – MG" (o que falta fica de fora). */
export function linhaEndereco(e: { rua: string; numero: string; complemento?: string; bairro: string; cidade: string; uf?: string }): string {
  const ruaNumero = [e.rua.trim(), e.numero.trim(), e.complemento?.trim()].filter(Boolean).join(", ");
  const cidade = [e.cidade.trim(), e.uf?.trim()].filter(Boolean).join(" – ");
  const lugar = [e.bairro.trim(), cidade].filter(Boolean).join(", ");
  return [ruaNumero, lugar].filter(Boolean).join(" – ");
}

/** O resumo e o mapa só aparecem com rua, número, bairro e cidade preenchidos. */
export function enderecoCompletoParaResumo(e: { rua: string; numero: string; bairro: string; cidade: string }): boolean {
  return [e.rua, e.numero, e.bairro, e.cidade].every((v) => v.trim().length > 0);
}

/**
 * Mockup cadastro-imovel-03: o endereço completo numa linha, o "Mapa do bairro" (a mesma área aproximada que o anúncio
 * mostra: o ponto do bairro, nunca o da rua), o aviso de privacidade e as etiquetas do bairro e da cidade.
 */
export function ResumoEndereco(p: {
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  /** O aviso de privacidade do endereço, logo embaixo do mapa. */
  aviso?: React.ReactNode;
}) {
  // Só bairro e cidade vão para a geocodificação: o mapa mostra o bairro, não a rua.
  const [centro, setCentro] = useState<{ lat: number; lng: number }>(UBERLANDIA_CENTER);
  useEffect(() => {
    let vivo = true;
    const t = setTimeout(() => {
      void geocodeForSave({ neighborhood: p.bairro, city: p.cidade }).then((c) => {
        if (vivo) setCentro({ lat: c.lat, lng: c.lng });
      });
    }, 600);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [p.bairro, p.cidade]);
  const cidadeUf = [p.cidade.trim(), p.uf.trim()].filter(Boolean).join(" · ");
  return (
    <div className="space-y-4" data-testid="endereco-resumo-bloco">
      <div>
        <span className="mb-2 block text-sm font-medium text-ink">Endereço completo</span>
        <p className="flex items-start gap-3 rounded-xl border border-line bg-white px-4 py-3 text-base text-ink" data-testid="endereco-resumo">
          <MapPin className="mt-1 h-5 w-5 shrink-0 text-forest" aria-hidden />
          <span className="min-w-0 break-words">{linhaEndereco({ rua: p.rua, numero: p.numero, complemento: p.complemento, bairro: p.bairro, cidade: p.cidade, uf: p.uf })}</span>
        </p>
      </div>
      <div>
        <span className="mb-2 block text-sm font-medium text-ink">Mapa do bairro</span>
        <div className="relative overflow-hidden rounded-xl border border-line" data-testid="mapa-bairro">
          <PropertyMap markers={[{ id: "bairro", lat: centro.lat, lng: centro.lng, kind: "property" }]} center={centro} zoom={14} approximate className="aspect-[16/9] w-full" />
          <span className="pointer-events-none absolute right-3 top-3 z-[400] rounded-lg bg-forest px-3 py-1 text-sm font-semibold text-white" data-testid="mapa-bairro-nome">
            {p.bairro.trim()}
          </span>
        </div>
      </div>
      {p.aviso}
      <p className="flex items-start gap-2 text-sm text-muted" data-testid="endereco-confira">
        <Info className="mt-1 h-4 w-4 shrink-0 text-forest" aria-hidden />
        Confira se o endereço está certo antes de continuar.
      </p>
      <div className="flex flex-wrap gap-3" data-testid="endereco-etiquetas">
        <span className="rounded-full border-2 border-forest px-4 py-2 text-sm font-semibold text-forest">{p.bairro.trim()}</span>
        {cidadeUf && <span className="rounded-full border-2 border-forest px-4 py-2 text-sm font-semibold text-forest">{cidadeUf}</span>}
      </div>
    </div>
  );
}
