"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { pontoColado } from "@/lib/destinos/ponto";
import { ACESSOS_CHACARA, INTERNETS_CHACARA, LINHA_FIXA_CHACARA, faltaChacara, type AcessoChacara, type InternetChacara } from "@/lib/anuncio/chacara";

const MapaMarcarPonto = dynamic(() => import("./mapa-marcar-ponto"), { ssr: false, loading: () => <div className="h-64 w-full rounded-xl bg-surface-2" /> });

export interface ValorChacara {
  acesso?: AcessoChacara;
  internet?: InternetChacara;
  ponto?: { lat: number; lng: number } | null;
}

/**
 * TIPO-CHACARA-B — os campos só deste tipo, obrigatórios para publicar: acesso, tipo de internet (a velocidade continua
 * no bloco de internet do Essencial) e o ponto no mapa marcado pelo dono. A distância até a cidade é calculada do
 * ponto no servidor, nunca digitada. A linha fixa lembra que se anuncia só a casa para morar.
 */
export function CamposChacara({
  valor,
  onChange,
  centro,
  pontoGravado = false,
}: {
  valor: ValorChacara;
  onChange: (v: ValorChacara) => void;
  /** Onde o mapa abre sem ponto (o endereço geocodificado ou o centro da cidade). */
  centro: { lat: number; lng: number };
  /** O anúncio já tem ponto marcado gravado (edição): marcar de novo é opcional. */
  pontoGravado?: boolean;
}) {
  const [colado, setColado] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const falta = faltaChacara({ acesso: valor.acesso, internet: valor.internet, pontoMarcado: !!valor.ponto || pontoGravado });

  function usarMinhaLocalizacao() {
    if (!navigator.geolocation) return setAviso("Este aparelho não informa a localização. Marque no mapa.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setAviso(null);
        onChange({ ...valor, ponto: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
      },
      () => setAviso("Não foi possível pegar a localização. Marque no mapa."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <section className="rounded-xl border border-sage-200 p-4" data-testid="campos-chacara" data-falta={falta.join(",")}>
      <h3 className="text-base font-semibold text-ink">Chácara/Sítio</h3>
      <p className="mt-1 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink" data-testid="chacara-linha-fixa">
        {LINHA_FIXA_CHACARA}
      </p>

      <fieldset className="mt-4">
        <legend className="text-sm font-semibold text-ink">Acesso até a casa</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {ACESSOS_CHACARA.map((a) => (
            <label key={a.valor} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm text-ink has-[:checked]:border-forest">
              <input type="radio" name="chacara-acesso" value={a.valor} checked={valor.acesso === a.valor} onChange={() => onChange({ ...valor, acesso: a.valor })} data-testid={`chacara-acesso-${a.valor}`} />
              {a.rotulo}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="text-sm font-semibold text-ink">Tipo de internet</legend>
        <p className="text-xs text-muted">A velocidade (Mbps) vai no bloco de internet, como em todo anúncio.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {INTERNETS_CHACARA.map((a) => (
            <label key={a.valor} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm text-ink has-[:checked]:border-forest">
              <input type="radio" name="chacara-internet" value={a.valor} checked={valor.internet === a.valor} onChange={() => onChange({ ...valor, internet: a.valor })} data-testid={`chacara-internet-${a.valor}`} />
              {a.rotulo}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4">
        <p className="text-sm font-semibold text-ink">Ponto da casa no mapa</p>
        <p className="text-xs text-muted">
          Endereço rural costuma cair no lugar errado: toque no mapa onde fica a casa (ou arraste o pino). O ponto exato não aparece no anúncio; a
          distância até a cidade é calculada daqui.
        </p>
        <div className="mt-2">
          <MapaMarcarPonto ponto={valor.ponto ?? null} centro={valor.ponto ?? centro} onMarcar={(p) => onChange({ ...valor, ponto: p })} />
        </div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button type="button" size="sm" variant="secondary" onClick={usarMinhaLocalizacao} data-testid="chacara-minha-localizacao">
            Usar minha localização
          </Button>
          <input
            value={colado}
            onChange={(e) => {
              setColado(e.target.value);
              const p = pontoColado(e.target.value);
              if (p) {
                setAviso(null);
                onChange({ ...valor, ponto: { lat: Number(p.lat), lng: Number(p.lng) } });
              }
            }}
            placeholder="Ou cole a latitude e a longitude (ex.: -18.95, -48.30)"
            aria-label="Latitude e longitude do ponto"
            className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-base outline-none focus:border-ink"
            data-testid="chacara-coordenadas"
          />
        </div>
        <p className="mt-2 text-sm text-ink" data-testid="chacara-ponto" data-marcado={valor.ponto || pontoGravado ? "1" : "0"}>
          {valor.ponto ? "Ponto marcado." : pontoGravado ? "Ponto já marcado. Toque no mapa para mudar." : "Ponto ainda não marcado."}
        </p>
        {aviso && (
          <p role="alert" className="mt-1 text-sm text-red-700">
            {aviso}
          </p>
        )}
      </div>
    </section>
  );
}
