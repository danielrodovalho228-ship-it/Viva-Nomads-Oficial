"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  chipsDe,
  interpretarLocal,
  limparDescricao,
  localExistente,
  sanearFiltros,
  semFiltro,
  temFiltro,
  DESCRICAO_MAX_CARACTERES,
  DICA_SEM_FILTRO,
  type ChaveChip,
  type FiltrosDescricao,
} from "@/lib/busca/descricao-filtros";

/**
 * "Descreva o lugar ideal" (ordem c470bb63, Próximo do FF 2/6). Converte a frase nos
 * filtros que a /buscar já tem e os mostra como chips que dá para tirar. A IA só
 * preenche filtros; se ela falhar (ou estiver desligada) vale o leitor local, sem aviso de erro.
 * O texto digitado não é guardado.
 */
export function DescricaoBusca({
  locais,
  onAplicar,
  onRemover,
}: {
  /** Cidades e bairros do catálogo: o local citado só vale se existir aqui. */
  locais: readonly string[];
  onAplicar: (f: FiltrosDescricao) => void;
  onRemover: (chave: ChaveChip) => void;
}) {
  const [texto, setTexto] = useState("");
  const [aplicados, setAplicados] = useState<FiltrosDescricao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [semResultado, setSemResultado] = useState(false);

  async function interpretar(e: React.FormEvent) {
    e.preventDefault();
    const descricao = limparDescricao(texto);
    if (descricao.length < 3 || carregando) return;
    setCarregando(true);
    setSemResultado(false);
    let filtros: FiltrosDescricao | null = null;
    try {
      const res = await fetch("/api/busca/descricao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descricao }),
      });
      if (res.ok) {
        const json = (await res.json()) as { filtros?: unknown };
        if (json.filtros) filtros = sanearFiltros(json.filtros);
      }
    } catch {
      // Plano B silencioso: segue com o leitor local.
    }
    const final = filtros && temFiltro(filtros) ? filtros : interpretarLocal(descricao, locais);
    final.local = localExistente(final.local, locais);
    setCarregando(false);
    if (!temFiltro(final)) {
      setAplicados(null);
      setSemResultado(true);
      return;
    }
    setAplicados(final);
    onAplicar(final);
  }

  function tirar(chave: ChaveChip) {
    setAplicados((f) => (f ? semFiltro(f, chave) : f));
    onRemover(chave);
  }

  const chips = aplicados ? chipsDe(aplicados) : [];

  return (
    <section aria-label="Busca por descrição" data-testid="descricao-busca" className="container-page mt-3 lg:order-2 lg:mt-3 lg:max-w-none lg:px-0">
      <form onSubmit={interpretar} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor="descricao-busca-campo" className="sr-only">
          Descreva o lugar ideal
        </label>
        <div className="relative min-w-0 flex-1">
          <Sparkles className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink" aria-hidden />
          <input
            id="descricao-busca-campo"
            name="descricao"
            type="text"
            autoComplete="off"
            maxLength={DESCRICAO_MAX_CARACTERES}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Descreva o lugar ideal: 2 quartos perto do HC, aceita gato, até 2.500"
            className="h-12 w-full rounded-full border border-line bg-white pl-12 pr-4 text-sm text-ink outline-none placeholder:text-muted hover:border-ink focus:border-ink"
          />
        </div>
        <Button type="submit" disabled={carregando || limparDescricao(texto).length < 3} data-testid="descricao-aplicar" className="h-12 shrink-0">
          {carregando ? "Entendendo…" : "Aplicar nos filtros"}
        </Button>
      </form>
      {semResultado && (
        <p role="status" className="mt-2 text-sm text-muted" data-testid="descricao-vazia">
          {DICA_SEM_FILTRO}
        </p>
      )}
      {chips.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2" aria-label="Filtros aplicados pela descrição" data-testid="descricao-chips">
          {chips.map((c) => (
            <li key={c.chave} className="inline-flex items-center gap-1 rounded-full bg-ink py-1 pl-3 pr-1 text-sm text-white">
              {c.rotulo}
              <button type="button" onClick={() => tirar(c.chave)} aria-label={`Tirar filtro ${c.rotulo}`} className="grid h-6 w-6 place-items-center rounded-full text-white hover:bg-white/15">
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
