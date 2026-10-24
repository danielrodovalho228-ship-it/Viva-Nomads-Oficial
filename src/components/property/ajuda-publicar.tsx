"use client";
import { enviarFotoDoAnuncio } from "@/lib/fotos/enviar-foto-cliente";

import { useState } from "react";
import { HandHelping, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pedirAjudaParaPublicar } from "@/lib/data/ajuda-publicacao-actions";
import {
  AVISO_APROVACAO,
  AVISO_SEM_CUSTO,
  LIMITE_OBSERVACAO,
  LIMITE_TEXTO,
  MAX_FOTOS_AJUDA,
} from "@/lib/ajuda-publicacao/ajuda";

/** Ordem 65e999b2: "Quero ajuda da equipe para publicar" — o dono envia o link/texto do anúncio que já tem. */
export function AjudaPublicar({ abertoInicial = false }: { /** Prompt 20: aberto pela linha de atalhos do passo 1 (sem a caixa tracejada). */ abertoInicial?: boolean } = {}) {
  const [aberto, setAberto] = useState(abertoInicial);
  const [link, setLink] = useState("");
  const [texto, setTexto] = useState("");
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [fotos, setFotos] = useState<{ path: string; url: string }[]>([]);
  const [subindo, setSubindo] = useState(false);

  async function anexar(lista: FileList | null) {
    if (!lista?.length) return;
    setErro("");
    setSubindo(true);
    const novas: { path: string; url: string }[] = [];
    for (const arq of Array.from(lista).slice(0, MAX_FOTOS_AJUDA - fotos.length)) {
      // E47-A-CORRECAO: o mesmo envio que nunca lança (tamanho conferido antes; rede caindo vira mensagem).
      const up = await enviarFotoDoAnuncio(arq);
      if (!up.ok) {
        setErro(up.erro);
        break;
      }
      novas.push({ path: up.path, url: up.url ?? "" });
    }
    setFotos((f) => [...f, ...novas]);
    setSubindo(false);
  }

  async function enviar() {
    setEnviando(true);
    setErro("");
    const r = await pedirAjudaParaPublicar({ link, texto, observacao: obs, fotos: fotos.map((f) => f.path) });
    setEnviando(false);
    if (!r.ok) return setErro(r.error ?? "Não foi possível enviar agora.");
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="rounded-xl border border-sage-200 bg-sage-50 p-4 text-sm text-forest" role="status" data-testid="ajuda-publicar-enviado">
        Pedido recebido. Acompanhe o andamento em <strong>Meus imóveis</strong>. {AVISO_APROVACAO}
      </div>
    );
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-dashed border-sage-300 px-4 py-3 text-left text-sm text-forest hover:bg-sage-50"
        data-testid="ajuda-publicar-abrir"
      >
        <HandHelping className="h-4 w-4 shrink-0" />
        Quero ajuda da equipe para publicar
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-sage-200 p-4" data-testid="ajuda-publicar">
      <p className="text-sm font-medium text-ink">Publicamos para você</p>
      <p className="mt-1 text-xs text-muted">{AVISO_SEM_CUSTO} {AVISO_APROVACAO}</p>
      <label className="mt-3 block text-sm text-ink">
        Link do seu anúncio (opcional se enviar texto ou fotos)
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          inputMode="url"
          maxLength={500}
          placeholder="https://"
          className="input mt-1 w-full"
          data-testid="ajuda-publicar-link"
        />
      </label>
      <label className="mt-3 block text-sm text-ink">
        Texto do anúncio
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={LIMITE_TEXTO}
          rows={5}
          placeholder="Cole aqui o texto do anúncio que você mesmo escreveu"
          className="input mt-1 w-full"
          data-testid="ajuda-publicar-texto"
        />
      </label>
      <label className="mt-3 block text-sm text-ink">
        Recado para a equipe (opcional)
        <input
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          maxLength={LIMITE_OBSERVACAO}
          placeholder="Ex.: as fotos estão no link"
          className="input mt-1 w-full"
          data-testid="ajuda-publicar-obs"
        />
      </label>
      <div className="mt-3">
        <p className="text-sm text-ink">Fotos do imóvel (opcional, até {MAX_FOTOS_AJUDA})</p>
        {fotos.length > 0 && (
          <ul className="mt-2 grid grid-cols-4 gap-2" data-testid="ajuda-publicar-fotos">
            {fotos.map((f) => (
              <li key={f.path} className="relative aspect-square overflow-hidden rounded-lg border border-sage-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt="Foto enviada" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setFotos((l) => l.filter((x) => x.path !== f.path))}
                  aria-label="Remover foto"
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {fotos.length < MAX_FOTOS_AJUDA && (
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={subindo}
            onChange={(e) => {
              void anexar(e.target.files);
              e.target.value = "";
            }}
            aria-label="Enviar fotos do imóvel"
            className="mt-2 block w-full text-sm"
            data-testid="ajuda-publicar-foto-input"
          />
        )}
        {subindo && <p className="mt-1 text-xs text-muted">Enviando…</p>}
      </div>
      {erro && (
        <p className="mt-3 text-sm text-red-700" role="alert" data-testid="ajuda-publicar-erro">
          {erro}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="gold" onClick={enviar} disabled={enviando || subindo} data-testid="ajuda-publicar-enviar">
          {enviando ? "Enviando…" : "Enviar pedido"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
