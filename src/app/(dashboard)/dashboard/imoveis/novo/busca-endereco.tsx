"use client";

import { useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Loader2, Search } from "lucide-react";
import { buscarPorEndereco, podeBuscarEndereco, type OpcaoEndereco } from "@/lib/cep/buscar";

const UFS = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];

/**
 * "Buscar pelo endereço" (prompt 20): quando o CEP não é encontrado, o dono digita a cidade e o começo da rua e
 * escolhe uma das opções do ViaCEP (até 5). Escolher preenche o CEP certo (e rua/bairro vazios).
 */
export function BuscaEndereco(p: { ufInicial: string; cidadeInicial: string; ruaInicial: string; onEscolher: (o: OpcaoEndereco) => void }) {
  const [uf, setUf] = useState(p.ufInicial || "MG");
  const [cidade, setCidade] = useState(p.cidadeInicial);
  const [rua, setRua] = useState(p.ruaInicial);
  const [buscando, setBuscando] = useState(false);
  const [opcoes, setOpcoes] = useState<OpcaoEndereco[] | null>(null);
  const [semRede, setSemRede] = useState(false);

  async function buscar() {
    if (!podeBuscarEndereco(uf, cidade, rua)) return;
    setBuscando(true);
    const r = await buscarPorEndereco(uf, cidade, rua, (url) => fetch(url));
    setOpcoes(r.opcoes);
    setSemRede(r.semRede);
    setBuscando(false);
  }

  return (
    <div className="rounded-xl border border-sage-200 bg-white p-3" data-testid="busca-endereco">
      <p className="text-sm font-medium text-ink">Buscar o CEP pelo endereço</p>
      <div className="mt-2 grid grid-cols-[5rem_minmax(0,1fr)] gap-2">
        <select value={uf} onChange={(e) => setUf(e.target.value)} className="input" aria-label="Estado (UF)" data-testid="busca-endereco-uf">
          {UFS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <input value={cidade} onChange={(e) => setCidade(e.target.value)} className="input" placeholder="Cidade" aria-label="Cidade" data-testid="busca-endereco-cidade" />
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={rua}
          onChange={(e) => setRua(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void buscar();
            }
          }}
          className="input min-w-0 flex-1"
          placeholder="Começo do nome da rua"
          aria-label="Rua"
          data-testid="busca-endereco-rua"
        />
        <button
          type="button"
          onClick={() => void buscar()}
          disabled={buscando || !podeBuscarEndereco(uf, cidade, rua)}
          className={buttonClasses({ className: "disabled:opacity-50" })}
          data-testid="busca-endereco-buscar"
        >
          {buscando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />} Buscar
        </button>
      </div>
      {opcoes && (
        <div className="mt-2" role="status">
          {opcoes.length === 0 ? (
            <p className="text-xs text-muted" data-testid="busca-endereco-vazio">
              {semRede ? "Não conseguimos buscar agora — preencha o endereço abaixo." : "Nada encontrado. Tente só o começo do nome da rua."}
            </p>
          ) : (
            <ul className="divide-y divide-sage-200 rounded-lg border border-sage-200">
              {opcoes.map((o) => (
                <li key={`${o.cep}-${o.rua}`}>
                  <button
                    type="button"
                    onClick={() => p.onEscolher(o)}
                    className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-sage-50"
                    data-testid="busca-endereco-opcao"
                  >
                    <span className="font-medium text-ink">{o.rua}</span>
                    <span className="text-xs text-muted">
                      {[o.bairro, `${o.cidade}/${o.uf}`].filter(Boolean).join(" · ")} · CEP {o.cep}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
