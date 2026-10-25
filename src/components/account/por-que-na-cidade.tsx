"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { CampoData } from "@/components/ui/campo-data";
import { Button } from "@/components/ui/button";
import { getMeuPorQueNaCidade, setMeuPorQueNaCidade } from "@/lib/data/perfil-actions";
import { EMPRESA_MAX, FRASE_MAX } from "@/lib/perfil/por-que-na-cidade";

const CAMPO = "w-full rounded-xl border border-sage-200 bg-white px-4 py-3 text-sm outline-none focus:border-sage";

/**
 * "Por que estou na cidade" (Conta, modo inquilino): período, empresa/instituição e uma frase curta.
 * Tudo opcional. O proprietário NÃO vê estes campos antes do aceite; aqui não se escreve diagnóstico.
 */
export function PorQueNaCidade() {
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [frase, setFrase] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    getMeuPorQueNaCidade()
      .then((v) => {
        if (!vivo || !v) return;
        setInicio(v.inicio ?? "");
        setFim(v.fim ?? "");
        setEmpresa(v.empresa ?? "");
        setFrase(v.frase ?? "");
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
      const r = await setMeuPorQueNaCidade({ inicio, fim, empresa, frase });
      if (r.ok) setOk(true);
      else setErro(r.error ?? "Não foi possível salvar.");
    } catch {
      setErro("Não foi possível salvar agora. Tente de novo em instantes.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="mt-6 border-t border-sage-200 pt-4" data-testid="por-que-na-cidade" aria-busy={carregando}>
      <h3 className="font-title text-base font-semibold text-ink">Por que estou na cidade</h3>
      <p className="mt-1 text-sm text-muted">
        Opcional. Antes do aceite o proprietário vê só sua categoria, selos e avaliações. Não escreva diagnóstico nem contato.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">Chegada</span>
          <CampoData value={inicio} onChange={(e) => { setInicio(e.target.value); setOk(false); }} aria-label="Chegada" className={CAMPO} data-testid="cidade-inicio" />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">Saída</span>
          <CampoData value={fim} min={inicio || undefined} onChange={(e) => { setFim(e.target.value); setOk(false); }} aria-label="Saída" className={CAMPO} data-testid="cidade-fim" />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-2 block text-sm font-medium text-ink">Empresa ou instituição</span>
          <input type="text" value={empresa} maxLength={EMPRESA_MAX} onChange={(e) => { setEmpresa(e.target.value); setOk(false); }} className={CAMPO} data-testid="cidade-empresa" />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-2 block text-sm font-medium text-ink">Uma frase sobre sua estadia</span>
          <input type="text" value={frase} maxLength={FRASE_MAX} onChange={(e) => { setFrase(e.target.value); setOk(false); }} className={CAMPO} data-testid="cidade-frase" />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" disabled={salvando || carregando}>
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Salvar
        </Button>
        {ok && <span role="status" className="text-sm text-forest">Salvo.</span>}
        {erro && <span role="alert" className="text-sm text-red-700">{erro}</span>}
      </div>
    </form>
  );
}
