"use client";

import { useActionState, useState, useTransition } from "react";
import { resolverReporteProximidade } from "@/lib/data/proximidades-actions";
import { alternarDestino, buscarPontoDestino, salvarDestino, type ResultadoDestino } from "@/lib/destinos/actions";
import { TIPOS_DESTINO } from "@/lib/destinos/regras";
import { pontoColado, type PontoSugerido } from "@/lib/destinos/ponto";
import { Button } from "@/components/ui/button";
import { PropertyMap } from "@/components/property-map-lazy";

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
  const [buscando, iniciarBusca] = useTransition();
  const [sugestoes, setSugestoes] = useState<PontoSugerido[] | null>(null);
  const [fonte, setFonte] = useState<string>("");
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [ponto, setPonto] = useState<{ lat: string; lng: string }>({
    lat: inicial?.lat != null ? String(inicial.lat) : "",
    lng: inicial?.lng != null ? String(inicial.lng) : "",
  });
  // E32: apagar o ponto de um destino gravado é ação explícita e confirmada (o destino sai dos ativos).
  const [limpar, setLimpar] = useState<"nao" | "confirmar" | "sim">("nao");
  const lat = Number(ponto.lat.replace(",", "."));
  const lng = Number(ponto.lng.replace(",", "."));
  const temPonto = ponto.lat !== "" && ponto.lng !== "" && Number.isFinite(lat) && Number.isFinite(lng);
  // "-18.9186, -48.2772" colado (como o Google Maps copia) em qualquer um dos campos preenche os dois.
  const mudaCoordenada = (campo: "lat" | "lng", valor: string) => setPonto(pontoColado(valor) ?? { ...ponto, [campo]: valor });
  const buscar = (form: HTMLFormElement | null) => {
    const cidade = (form?.elements.namedItem("cidade") as HTMLInputElement | null)?.value ?? "";
    const uf = (form?.elements.namedItem("uf") as HTMLInputElement | null)?.value ?? "";
    iniciarBusca(async () => {
      const r = await buscarPontoDestino(busca, cidade, uf);
      if (!r.ok) {
        setErroBusca(r.erro);
        setSugestoes(null);
        return;
      }
      setErroBusca(null);
      setFonte(r.fonte);
      setSugestoes(r.itens);
    });
  };

  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-2" data-testid="destino-form" key={inicial?.slug ?? "novo"}>
      {inicial && <input type="hidden" name="slug" value={inicial.slug} />}
      <div className="sm:col-span-2">
        <label htmlFor="nome" className="block text-sm font-semibold">Nome</label>
        <input id="nome" name="nome" required maxLength={80} defaultValue={inicial?.nome} className={campo} placeholder="Ex.: HC-UFU" />
      </div>
      <div>
        <label htmlFor="tipo" className="block text-sm font-semibold">Tipo</label>
        <select id="tipo" name="tipo" defaultValue={inicial?.tipo ?? "hospital"} className={campo}>
          {TIPOS_DESTINO.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="artigo" className="block text-sm font-semibold">Como se fala</label>
        <select id="artigo" name="artigo" defaultValue={inicial?.artigo ?? "o"} className={campo}>
          <option value="o">“perto do …” (o)</option>
          <option value="a">“perto da …” (a)</option>
          <option value="">“perto de …” (sem artigo)</option>
        </select>
      </div>
      <div><label htmlFor="cidade" className="block text-sm font-semibold">Cidade</label><input id="cidade" name="cidade" required maxLength={80} defaultValue={inicial?.cidade ?? "Uberlândia"} className={campo} /></div>
      <div><label htmlFor="uf" className="block text-sm font-semibold">UF</label><input id="uf" name="uf" required maxLength={2} defaultValue={inicial?.uf ?? "MG"} className={`${campo} uppercase`} /></div>
      <div className="sm:col-span-2">
        <span className="block text-sm font-semibold">Ponto no mapa</span>
        <div className="mt-1 flex gap-2">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                buscar(e.currentTarget.form);
              }
            }}
            placeholder="Busque pelo nome ou endereço (ex.: Hospital de Clínicas UFU)"
            aria-label="Buscar o ponto no mapa"
            className={campo.replace("mt-1 ", "")}
            data-testid="destino-busca"
          />
          <Button type="button" variant="outline" disabled={buscando} onClick={(e) => buscar(e.currentTarget.form)} data-testid="destino-buscar">
            {buscando ? "Buscando…" : "Buscar"}
          </Button>
        </div>
        {erroBusca && <p role="alert" className="mt-2 text-sm text-red-600">{erroBusca}</p>}
        {sugestoes && (
          <div className="mt-2" data-testid="destino-sugestoes">
            {sugestoes.length === 0 ? (
              <p className="text-sm text-muted">Nada encontrado. Tente outro nome ou cole a latitude e a longitude abaixo.</p>
            ) : (
              <ul className="divide-y divide-sage-200 rounded-lg border border-sage-200">
                {sugestoes.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-ink hover:bg-sage-100"
                      data-testid="destino-sugestao"
                      onClick={() => {
                        setPonto({ lat: s.lat.toFixed(6), lng: s.lng.toFixed(6) });
                        setSugestoes(null);
                      }}
                    >
                      {s.rotulo}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {fonte === "osm" && sugestoes.length > 0 && <p className="mt-1 text-xs text-muted">Dados do mapa © OpenStreetMap</p>}
          </div>
        )}
        <div className="mt-2 grid grid-cols-2 gap-3">
          <label className="text-xs text-muted">Latitude<input name="lat" value={ponto.lat} onChange={(e) => mudaCoordenada("lat", e.target.value)} inputMode="decimal" className={campo} data-testid="destino-lat" /></label>
          <label className="text-xs text-muted">Longitude<input name="lng" value={ponto.lng} onChange={(e) => mudaCoordenada("lng", e.target.value)} inputMode="decimal" className={campo} data-testid="destino-lng" /></label>
        </div>
        {limpar === "sim" && <input type="hidden" name="limpar_ponto" value="1" />}
        {inicial && inicial.lat != null && inicial.lng != null && limpar !== "sim" && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            {limpar === "nao" ? (
              <button type="button" className="font-semibold text-red-700 underline" onClick={() => setLimpar("confirmar")} data-testid="destino-remover-ponto">
                Remover o ponto
              </button>
            ) : (
              <>
                <span className="text-ink">Sem ponto, o destino sai dos ativos. Remover mesmo?</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLimpar("sim");
                    setPonto({ lat: "", lng: "" });
                  }}
                  data-testid="destino-remover-ponto-confirmar"
                >
                  Remover o ponto
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setLimpar("nao")}>
                  Manter
                </Button>
              </>
            )}
          </div>
        )}
        {limpar === "sim" && <p className="mt-2 text-sm text-red-700" data-testid="destino-ponto-removido">O ponto será removido ao salvar.</p>}
        {temPonto && (
          <div className="mt-3 overflow-hidden rounded-xl" data-testid="destino-mapa">
            <PropertyMap className="aspect-[16/9] w-full" center={{ lat, lng }} markers={[{ id: "destino", lat, lng, label: "Destino", kind: "workspace" }]} />
          </div>
        )}
        <p className="mt-2 text-xs text-muted">Confira se o pino está na entrada certa antes de ativar. Também dá para colar “latitude, longitude” copiado do Google Maps. Sem ponto conferido, o destino não pode ser ativado.</p>
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

/** PERTO-B: "Resolvido" num aviso de lugar por perto marcado como errado pelo dono. */
export function ResolverReporte({ id }: { id: string }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pendente}
        data-testid="resolver-reporte"
        onClick={() => iniciar(async () => {
          const r = await resolverReporteProximidade(id);
          setErro(r.ok ? null : r.erro ?? null);
          if (r.ok) window.location.reload();
        })}
      >
        Resolvido
      </Button>
      {erro && <span role="alert" className="text-xs text-red-600">{erro}</span>}
    </span>
  );
}
