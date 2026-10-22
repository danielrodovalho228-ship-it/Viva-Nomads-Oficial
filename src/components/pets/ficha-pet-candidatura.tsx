"use client";

import { useEffect, useState } from "react";
import { PawPrint, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fichaPetsDaCandidatura, resumoFichaPets, type FichaPetsCandidatura } from "@/lib/data/pets-candidatura";

type Alvo = { leadId: string } | { propertyId: string; tenantId: string };

/**
 * Ficha do pet para o DONO, no contexto de uma candidatura (complemento do #876): o resumo
 * ("Com 1 pet · Totó (cão, porte médio)") e o botão "Ver ficha do pet", que abre as fotos, a carteira de vacina,
 * a raça, as observações e a conferência com as regras do anúncio. Os dados vêm só de fichaPetsDaCandidatura
 * (dono da candidatura, candidatura viva, links de 10 minutos). Sem pet ou sem acesso: não aparece.
 */
export function FichaPetCandidatura({ alvo, resumo: resumoInicial, className }: { alvo: Alvo; resumo?: string | null; className?: string }) {
  const [resumo, setResumo] = useState<string | null | undefined>(resumoInicial);
  const [leadId, setLeadId] = useState<string | null>("leadId" in alvo ? alvo.leadId : null);
  const [aberta, setAberta] = useState(false);
  const [ficha, setFicha] = useState<FichaPetsCandidatura | null>(null);
  const [carregando, setCarregando] = useState(false);
  const chave = "leadId" in alvo ? alvo.leadId : `${alvo.propertyId}:${alvo.tenantId}`;

  useEffect(() => {
    if (resumoInicial !== undefined) return;
    let vivo = true;
    resumoFichaPets(alvo)
      .then((r) => {
        if (!vivo) return;
        setResumo(r?.resumo ?? null);
        if (r) setLeadId(r.leadId);
      })
      .catch(() => vivo && setResumo(null));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, resumoInicial]);

  if (!resumo || !leadId) return null;

  async function abrir() {
    setAberta(true);
    setCarregando(true);
    // Links de 10 minutos: busca de novo a cada abertura.
    const f = await fichaPetsDaCandidatura(leadId!).catch(() => ({ pets: [], quantidade: null }));
    setFicha(f);
    setCarregando(false);
  }

  return (
    <div className={className} data-testid="ficha-pet-candidatura">
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink">
        <span className="inline-flex items-center gap-1" data-testid="ficha-pet-resumo">
          <PawPrint className="h-3.5 w-3.5 text-forest" aria-hidden /> {resumo}
        </span>
        <Button type="button" size="sm" variant="secondary" onClick={aberta ? () => setAberta(false) : abrir} data-testid="ver-ficha-pet" aria-expanded={aberta}>
          {aberta ? "Fechar ficha do pet" : "Ver ficha do pet"}
        </Button>
      </div>
      {aberta && (
        <div className="mt-3 rounded-xl border border-sage-200 bg-white p-3 text-sm" data-testid="ficha-pet-painel">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="font-semibold text-ink">Ficha do pet</p>
            <button type="button" onClick={() => setAberta(false)} aria-label="Fechar ficha do pet" className="rounded-lg p-1 text-muted hover:bg-sage-50">
              <X className="h-4 w-4" />
            </button>
          </div>
          {carregando ? (
            <p className="text-muted">Carregando…</p>
          ) : !ficha || ficha.pets.length === 0 ? (
            <p className="text-muted" data-testid="ficha-pet-indisponivel">A ficha do pet não está mais disponível para esta candidatura.</p>
          ) : (
            <ul className="space-y-4">
              {ficha.quantidade && (
                <li className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800" data-testid="ficha-pet-quantidade">{ficha.quantidade}</li>
              )}
              {ficha.pets.map((p) => (
                <li key={p.nome} data-testid="ficha-pet-item">
                  <p className="font-medium text-ink">
                    {p.nome} <span className="font-normal text-muted">({p.especie}, porte {p.porte})</span>
                  </p>
                  <p
                    className={p.conferencia.ok ? "mt-1 text-[13px] font-medium text-forest" : "mt-1 text-[13px] font-medium text-amber-800"}
                    data-testid="ficha-pet-conferencia"
                  >
                    {p.conferencia.texto}
                  </p>
                  <dl className="mt-2 grid grid-cols-1 gap-1 text-[13px] sm:grid-cols-2">
                    <div>
                      <dt className="inline text-muted">Raça: </dt>
                      <dd className="inline text-ink" data-testid="ficha-pet-raca">{p.raca || "não informada"}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="inline text-muted">Observações: </dt>
                      <dd className="inline break-words text-ink" data-testid="ficha-pet-observacoes">{p.observacoes || "nenhuma"}</dd>
                    </div>
                  </dl>
                  {p.fotos.length > 0 && (
                    <div className="mt-2 grid grid-cols-3 gap-2" data-testid="ficha-pet-fotos">
                      {p.fotos.map((u, i) => (
                        <a key={u} href={u} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={u} alt={`Foto ${i + 1} de ${p.nome}`} className="aspect-square w-full rounded-lg object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-[13px]">
                    {p.carteira ? (
                      <a href={p.carteira} target="_blank" rel="noopener noreferrer" download className="font-medium text-forest underline" data-testid="ficha-pet-carteira">
                        Abrir carteira de vacina
                      </a>
                    ) : (
                      <span className="text-muted">Carteira de vacina não enviada.</span>
                    )}
                  </p>
                </li>
              ))}
              <li className="text-xs text-muted">Os links das fotos valem por 10 minutos. Para ver de novo, abra a ficha outra vez.</li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
