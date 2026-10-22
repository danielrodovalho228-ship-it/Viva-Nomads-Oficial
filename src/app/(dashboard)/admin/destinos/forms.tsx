"use client";

import { useActionState, useState, useTransition } from "react";
import { alternarDestino, salvarDestino, type ResultadoDestino } from "@/lib/destinos/actions";
import { TIPOS_DESTINO } from "@/lib/destinos/regras";
import { Button } from "@/components/ui/button";
import { LocationSearch } from "@/components/location-search";
import { PropertyMap } from "@/components/property-map-lazy";
import type { GeoSuggestion } from "@/lib/integrations/geocoding";

const campo = "mt-1 w-full rounded-lg border border-sage-200 px-3 py-2 text-base";

export interface DestinoEditavel {
  slug: string;
  nome: string;
  artigo: string;
  tipo: string;
  cidade: string;
  uf: string;
  lat: number | null;
  lng: number | null;
}

/** Cadastro/correção: busca pelo nome (o geocoding sugere), confere no mapa e salva. */
export function DestinoForm({ inicial }: { inicial?: DestinoEditavel }) {
  const [res, acao, pendente] = useActionState<ResultadoDestino | null, FormData>(salvarDestino, null);
  const [busca, setBusca] = useState("");
  const [ponto, setPonto] = useState<{ lat: string; lng: string }>({
    lat: inicial?.lat != null ? String(inicial.lat) : "",
    lng: inicial?.lng != null ? String(inicial.lng) : "",
  });
  const lat = Number(ponto.lat.replace(",", "."));
  const lng = Number(ponto.lng.replace(",", "."));
  const temPonto = ponto.lat !== "" && ponto.lng !== "" && Number.isFinite(lat) && Number.isFinite(lng);

  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-2" data-testid="destino-form" key={inicial?.slug ?? "novo"}>
      {inicial && <input type="hidden" name="slug" value={inicial.slug} />}
      <div className="sm:col-span-2">
        <label htmlFor="nome" className="block text-sm font-medium">Nome</label>
        <input id="nome" name="nome" required maxLength={80} defaultValue={inicial?.nome} className={campo} placeholder="Ex.: HC-UFU" />
      </div>
      <div>
        <label htmlFor="tipo" className="block text-sm font-medium">Tipo</label>
        <select id="tipo" name="tipo" defaultValue={inicial?.tipo ?? "hospital"} className={campo}>
          {TIPOS_DESTINO.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="artigo" className="block text-sm font-medium">Como se fala</label>
        <select id="artigo" name="artigo" defaultValue={inicial?.artigo ?? "o"} className={campo}>
          <option value="o">“perto do …” (o)</option>
          <option value="a">“perto da …” (a)</option>
          <option value="">“perto de …” (sem artigo)</option>
        </select>
      </div>
      <div><label htmlFor="cidade" className="block text-sm font-medium">Cidade</label><input id="cidade" name="cidade" required maxLength={80} defaultValue={inicial?.cidade ?? "Uberlândia"} className={campo} /></div>
      <div><label htmlFor="uf" className="block text-sm font-medium">UF</label><input id="uf" name="uf" required maxLength={2} defaultValue={inicial?.uf ?? "MG"} className={`${campo} uppercase`} /></div>
      <div className="sm:col-span-2">
        <span className="block text-sm font-medium">Ponto no mapa</span>
        <div className="mt-1">
          <LocationSearch
            placeholder="Busque pelo nome ou endereço"
            value={busca}
            onChange={setBusca}
            onSelect={(s: GeoSuggestion) => {
              setBusca(s.label);
              setPonto({ lat: s.lat.toFixed(6), lng: s.lng.toFixed(6) });
            }}
          />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <label className="text-xs text-muted">Latitude<input name="lat" value={ponto.lat} onChange={(e) => setPonto({ ...ponto, lat: e.target.value })} inputMode="decimal" className={campo} data-testid="destino-lat" /></label>
          <label className="text-xs text-muted">Longitude<input name="lng" value={ponto.lng} onChange={(e) => setPonto({ ...ponto, lng: e.target.value })} inputMode="decimal" className={campo} data-testid="destino-lng" /></label>
        </div>
        {temPonto && (
          <div className="mt-3 overflow-hidden rounded-xl" data-testid="destino-mapa">
            <PropertyMap className="aspect-[16/9] w-full" center={{ lat, lng }} markers={[{ id: "destino", lat, lng, label: "Destino", kind: "workspace" }]} />
          </div>
        )}
        <p className="mt-2 text-xs text-muted">Confira se o pino está na entrada certa antes de ativar. Sem ponto conferido, o destino não pode ser ativado.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pendente} data-testid="salvar-destino">Salvar destino</Button>
        {res && (res.ok ? <p role="status" className="text-sm text-ink">{res.mensagem}</p> : <p role="alert" className="text-sm text-red-600">{res.erro}</p>)}
      </div>
    </form>
  );
}

export function DestinoBotao({ id, ativo, temPonto }: { id: string; ativo: boolean; temPonto: boolean }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pendente || (!ativo && !temPonto)}
        data-testid="alternar-destino"
        onClick={() => iniciar(async () => {
          const r = await alternarDestino(id, !ativo);
          setErro(r.ok ? null : r.erro ?? null);
        })}
      >
        {ativo ? "Desativar" : "Ativar"}
      </Button>
      {erro && <span role="alert" className="text-xs text-red-600">{erro}</span>}
    </span>
  );
}
