"use client";

import { useEffect, useState } from "react";
import { Check, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CATEGORIAS_PROFISSIONAIS,
  CATEGORIA_NAO_INFORMAR,
  CATEGORIA_OUTRO_PREFIX,
  CATEGORIA_OUTRO_MAXLEN,
} from "@/config/categorias-profissionais";
import { contemContato, CONTATO_AVISO } from "@/lib/pedidos/pedidos";
import { getMinhaCategoria, setMinhaCategoria } from "@/lib/data/perfil-actions";

const SELECT_OUTRO = "__outro__";

/**
 * Perfil profissional do inquilino (Conta). Select agrupado (fonte única em
 * config/categorias-profissionais), com "Outro" (campo livre 40 chars, mesma
 * sanitização do bloqueio de contato) e "Prefiro não informar". Salva em
 * profiles.professional_category — o rótulo escolhido aparece no laudo, sem
 * ranking nem juízo.
 */
export function CategoriaProfissional() {
  const [sel, setSel] = useState<string>("");
  const [outro, setOutro] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Hidrata a escolha salva. "outro:<texto>" abre o campo livre preenchido.
  useEffect(() => {
    let alive = true;
    getMinhaCategoria()
      .then((v) => {
        if (!alive) return;
        if (v?.startsWith(CATEGORIA_OUTRO_PREFIX)) {
          setSel(SELECT_OUTRO);
          setOutro(v.slice(CATEGORIA_OUTRO_PREFIX.length));
        } else if (v) {
          setSel(v);
        }
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const isOutro = sel === SELECT_OUTRO;
  const outroTemContato = isOutro && outro.length > 0 && contemContato(outro);

  async function salvar() {
    setErro(null);
    setOk(false);
    if (!sel) {
      setErro("Escolha uma categoria.");
      return;
    }
    if (outroTemContato) {
      setErro(CONTATO_AVISO);
      return;
    }
    const value = isOutro ? CATEGORIA_OUTRO_PREFIX + outro.trim() : sel;
    setSaving(true);
    const res = await setMinhaCategoria(value);
    setSaving(false);
    if (res.ok) setOk(true);
    else setErro(res.error ?? "Não foi possível salvar.");
  }

  return (
    <div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">Categoria profissional</span>
        <select
          value={sel}
          disabled={loading}
          onChange={(e) => {
            setSel(e.target.value);
            setOk(false);
          }}
          className="w-full rounded-xl border border-sage-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-sage"
        >
          <option value="" disabled>
            {loading ? "Carregando…" : "Selecione…"}
          </option>
          {CATEGORIAS_PROFISSIONAIS.map((g) => (
            <optgroup key={g.grupo} label={g.grupo}>
              {g.opcoes.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ))}
          <optgroup label="Outros">
            <option value={SELECT_OUTRO}>Outro (descrever)</option>
            <option value={CATEGORIA_NAO_INFORMAR}>Prefiro não informar</option>
          </optgroup>
        </select>
      </label>

      {isOutro && (
        <label className="mt-3 block">
          <span className="mb-1.5 block text-sm font-medium text-ink">Descreva (até {CATEGORIA_OUTRO_MAXLEN})</span>
          <input
            value={outro}
            maxLength={CATEGORIA_OUTRO_MAXLEN}
            onChange={(e) => {
              setOutro(e.target.value);
              setOk(false);
            }}
            placeholder="Sua ocupação (sem telefone, e-mail ou apps)"
            className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:border-sage ${
              outroTemContato ? "border-red-300" : "border-sage-200"
            }`}
          />
          {outroTemContato && (
            <span className="mt-1 flex items-start gap-1.5 text-xs text-red-600">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {CONTATO_AVISO}
            </span>
          )}
        </label>
      )}

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={salvar} disabled={saving || loading || outroTemContato}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Salvando…" : "Salvar perfil"}
        </Button>
        {ok && (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-forest">
            <Check className="h-4 w-4" /> Salvo.
          </span>
        )}
      </div>
      {erro && <p className="mt-2 text-sm text-red-700">{erro}</p>}
    </div>
  );
}
