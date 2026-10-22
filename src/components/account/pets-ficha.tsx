"use client";

import { useEffect, useState } from "react";
import { Camera, PawPrint, Trash2, X } from "lucide-react";
import { Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { ROTULO_ESPECIE, ROTULO_PORTE, ESPECIES_PET, PORTES_PET, MAX_PETS } from "@/lib/anuncio/pets-regras";
import { MAX_FOTOS_PET, podeAdicionarFotoPet, type TipoFotoPet } from "@/lib/anuncio/ficha-pet-fotos";
import { cortarObservacoes, TEXTO_MAX_FOTOS_PET } from "@/lib/anuncio/ficha-pet-dono";
import { enviarImagemPet, removerImagemPet, removerPet, meusPets, salvarPet, type PetSalvo } from "@/lib/data/pets-ficha-actions";

const VAZIO = { nome: "", especie: "cao", porte: "P", idadeAnos: "0", raca: "", castrado: "nao", vacinasEmDia: "sim", observacoes: "" };
const CAMPO = "w-full rounded-xl border border-sage-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-sage";

/** Ficha do pet do morador (até 3): aparece na Conta; a candidatura usa a mesma ficha. */
export function PetsFicha() {
  const [pets, setPets] = useState<PetSalvo[] | null | undefined>(undefined);
  const [f, setF] = useState(VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [verMais, setVerMais] = useState<Set<string>>(new Set());

  useEffect(() => {
    let vivo = true;
    meusPets()
      .then((p) => vivo && setPets(p))
      .catch(() => vivo && setPets(null));
    return () => {
      vivo = false;
    };
  }, []);

  if (!pets && pets !== undefined) return null; // sem sessão ou demonstração
  if (pets === undefined) return null;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    const r = await salvarPet({
      ...f,
      idadeAnos: Number(f.idadeAnos),
      castrado: f.castrado === "sim",
      vacinasEmDia: f.vacinasEmDia === "sim",
    }).catch(() => ({ ok: false as const, error: "Sem conexão. Tente de novo." }));
    setSalvando(false);
    if (!r.ok) return setErro(r.error);
    setPets(r.pets);
    setF(VAZIO);
  }

  async function tirar(id: string) {
    const r = await removerPet(id).catch(() => ({ ok: false }));
    if (r.ok) setPets((p) => (p ?? []).filter((x) => x.id !== id));
  }

  async function enviar(petId: string, tipo: TipoFotoPet, arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(null);
    setEnviando(petId);
    const form = new FormData();
    form.set("petId", petId);
    form.set("tipo", tipo);
    form.set("file", arquivo);
    const r = await enviarImagemPet(form).catch(() => ({ ok: false as const, error: "Sem conexão. Tente de novo." }));
    setEnviando(null);
    if (!r.ok) return setErro(r.error);
    setPets(r.pets);
  }

  async function tirarImagem(petId: string, caminho: string) {
    setErro(null);
    const r = await removerImagemPet(petId, caminho).catch(() => ({ ok: false as const, error: "Sem conexão. Tente de novo." }));
    if (!r.ok) return setErro(r.error);
    setPets(r.pets);
  }

  const lista = pets ?? [];
  return (
    <section id="pets" className="scroll-mt-24">
      <Panel title="Meus pets" className="mt-6">
        <p className="text-sm text-muted">
          Cadastre até {MAX_PETS} pets. Quem anuncia vê a ficha na sua candidatura e confere se o imóvel aceita.
        </p>
        {lista.length > 0 && (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2" data-testid="pets-lista">
            {lista.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 rounded-xl border border-sage-200 p-3 text-sm">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-medium text-ink">
                    <PawPrint className="h-4 w-4 text-forest" /> {p.nome}
                  </p>
                  <p className="text-muted">
                    {ROTULO_ESPECIE[p.especie]} · porte {ROTULO_PORTE[p.porte]} · {p.idadeAnos} {p.idadeAnos === 1 ? "ano" : "anos"}
                  </p>
                  <p className="text-muted">
                    {p.castrado ? "Castrado" : "Não castrado"} · vacinas {p.vacinasEmDia ? "em dia" : "pendentes"}
                  </p>
                  {p.raca && (
                    <p className="text-muted" data-testid={`pet-raca-${p.nome}`}>
                      Raça: <span className="text-ink">{p.raca}</span>
                    </p>
                  )}
                  {p.observacoes && (() => {
                    const o = cortarObservacoes(p.observacoes);
                    const inteiro = verMais.has(p.id);
                    return (
                      <p className="break-words text-muted" data-testid={`pet-observacoes-${p.nome}`}>
                        Observações: <span className="text-ink">{inteiro || !o.cortado ? p.observacoes : o.curto}</span>
                        {o.cortado && (
                          <button
                            type="button"
                            className="ml-1 font-medium text-forest underline"
                            onClick={() => setVerMais((v) => { const n = new Set(v); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })}
                            data-testid={`pet-ver-mais-${p.nome}`}
                          >
                            {inteiro ? "ver menos" : "ver mais"}
                          </button>
                        )}
                      </p>
                    );
                  })()}
                  <div className="mt-2 flex flex-wrap items-center gap-2" data-testid={`pet-imagens-${p.nome}`}>
                    {p.fotos.map((f, i) => (
                      <span key={f.caminho} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.url} alt={`Foto ${i + 1} de ${p.nome}`} className="h-14 w-14 rounded-lg object-cover" />
                        <button type="button" onClick={() => tirarImagem(p.id, f.caminho)} aria-label={`Remover foto ${i + 1} de ${p.nome}`} className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-white shadow ring-1 ring-sage-200">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    {!podeAdicionarFotoPet("foto", p.fotos.length) && (
                      <span className="text-xs text-muted" data-testid={`pet-max-fotos-${p.nome}`}>{TEXTO_MAX_FOTOS_PET}</span>
                    )}
                    {podeAdicionarFotoPet("foto", p.fotos.length) && (
                      <label className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-sage-200 px-3 text-xs font-medium text-ink hover:bg-sage-50">
                        <Camera className="h-4 w-4" /> {enviando === p.id ? "Enviando…" : `Foto (${p.fotos.length}/${MAX_FOTOS_PET})`}
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={`Enviar foto de ${p.nome}`} disabled={enviando === p.id} onChange={(e) => { void enviar(p.id, "foto", e.target.files?.[0]); e.target.value = ""; }} />
                      </label>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-muted">
                    {p.carteira ? (
                      <span className="inline-flex items-center gap-2">
                        <a href={p.carteira.url} target="_blank" rel="noopener noreferrer" className="font-medium text-forest underline">Carteira de vacina enviada</a>
                        <button type="button" onClick={() => tirarImagem(p.id, p.carteira!.caminho)} aria-label={`Remover carteira de vacina de ${p.nome}`} className="rounded p-1 hover:bg-sage-50"><X className="h-3 w-3" /></button>
                      </span>
                    ) : (
                      <label className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-sage-200 px-3 font-medium text-ink hover:bg-sage-50">
                        {enviando === p.id ? "Enviando…" : "Enviar foto da carteira de vacina"}
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={`Enviar carteira de vacina de ${p.nome}`} disabled={enviando === p.id} onChange={(e) => { void enviar(p.id, "carteira", e.target.files?.[0]); e.target.value = ""; }} />
                      </label>
                    )}
                  </div>
                </div>
                <button type="button" onClick={() => tirar(p.id)} aria-label={`Remover ${p.nome}`} className="rounded-lg p-2 text-muted hover:bg-sage-50">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {erro && lista.length >= MAX_PETS && <p role="alert" className="mt-3 text-sm text-red-700">{erro}</p>}
        {lista.length < MAX_PETS && (
          <form onSubmit={salvar} className="mt-4 grid gap-3 sm:grid-cols-2" data-testid="pets-form">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink">Nome</span>
              <input className={CAMPO} value={f.nome} maxLength={40} required onChange={(e) => setF({ ...f, nome: e.target.value })} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink">Espécie</span>
              <select className={CAMPO} value={f.especie} onChange={(e) => setF({ ...f, especie: e.target.value })}>
                {ESPECIES_PET.map((e) => (
                  <option key={e} value={e}>{ROTULO_ESPECIE[e]}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink">Porte</span>
              <select className={CAMPO} value={f.porte} onChange={(e) => setF({ ...f, porte: e.target.value })}>
                {PORTES_PET.map((p) => (
                  <option key={p} value={p}>{ROTULO_PORTE[p]}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink">Idade (anos)</span>
              <input className={CAMPO} type="number" min={0} max={40} value={f.idadeAnos} onChange={(e) => setF({ ...f, idadeAnos: e.target.value })} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink">Raça (opcional)</span>
              <input className={CAMPO} value={f.raca} maxLength={40} onChange={(e) => setF({ ...f, raca: e.target.value })} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink">Castrado?</span>
              <select className={CAMPO} value={f.castrado} onChange={(e) => setF({ ...f, castrado: e.target.value })}>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink">Vacinas em dia?</span>
              <select className={CAMPO} value={f.vacinasEmDia} onChange={(e) => setF({ ...f, vacinasEmDia: e.target.value })}>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-ink">Observações (opcional)</span>
              <input className={CAMPO} value={f.observacoes} maxLength={200} onChange={(e) => setF({ ...f, observacoes: e.target.value })} />
            </label>
            {erro && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{erro}</p>}
            <div className="sm:col-span-2">
              <Button type="submit" variant="secondary" disabled={salvando}>{salvando ? "Salvando…" : "Adicionar pet"}</Button>
            </div>
          </form>
        )}
      </Panel>
    </section>
  );
}
