"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMeuEspacoTrabalho, setMeuEspacoTrabalho } from "@/lib/data/perfil-actions";
import { OFERTA, PROCURA, ROTULO_OFERTA, ROTULO_PROCURA } from "@/lib/perfil/espaco-trabalho";

const CAMPO = "w-full rounded-xl border border-sage-200 bg-white px-4 py-3 text-sm outline-none focus:border-sage";

/**
 * Duas perguntas opcionais sobre espaço de trabalho (ordem 286312f8): só para medir interesse; não vira anúncio nem reserva.
 * Uma conta só: as duas aparecem para todo mundo.
 */
export function EspacoTrabalho() {
  const [oferta, setOferta] = useState("");
  const [procura, setProcura] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    getMeuEspacoTrabalho()
      .then((v) => {
        if (!vivo || !v) return;
        setOferta(v.oferta ?? "");
        setProcura(v.procura ?? "");
      })
      .catch(() => {})
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(false);
    setSalvando(true);
    try {
      const r = await setMeuEspacoTrabalho({ oferta, procura });
      if (r.ok) setOk(true);
      else setErro(r.error ?? "Não foi possível salvar.");
    } catch {
      setErro("Não foi possível salvar agora. Tente de novo em instantes.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="mt-6 border-t border-sage-200 pt-4" data-testid="espaco-trabalho" aria-busy={carregando}>
      <h3 className="font-title text-base font-semibold text-ink">Espaço de trabalho</h3>
      <p className="mt-1 text-sm text-muted">Opcional. Só para a Viva entender se vale oferecer isso no futuro; nada vira anúncio.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">Você também tem sala, consultório ou espaço de trabalho mobiliado?</span>
          <select value={oferta} onChange={(e) => { setOferta(e.target.value); setOk(false); }} className={CAMPO} data-testid="espaco-oferta">
            <option value="">Prefiro não responder</option>
            {OFERTA.map((v) => <option key={v} value={v}>{ROTULO_OFERTA[v]}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">Vai precisar de espaço de trabalho fora de casa?</span>
          <select value={procura} onChange={(e) => { setProcura(e.target.value); setOk(false); }} className={CAMPO} data-testid="espaco-procura">
            <option value="">Prefiro não responder</option>
            {PROCURA.map((v) => <option key={v} value={v}>{ROTULO_PROCURA[v]}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={salvando || carregando} data-testid="espaco-salvar">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Salvar
        </Button>
        {ok && <span role="status" className="text-sm text-forest">Salvo.</span>}
        {erro && <span role="alert" className="text-sm text-red-700">{erro}</span>}
      </div>
    </form>
  );
}
