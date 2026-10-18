"use client";

import { useState } from "react";
import { HandHelping } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pedirAjudaParaPublicar } from "@/lib/data/ajuda-publicacao-actions";
import {
  AVISO_APROVACAO,
  AVISO_SEM_CUSTO,
  LIMITE_OBSERVACAO,
  LIMITE_TEXTO,
} from "@/lib/ajuda-publicacao/ajuda";

/** Ordem 65e999b2: "Quero ajuda da equipe para publicar" — o dono envia o link/texto do anúncio que já tem. */
export function AjudaPublicar() {
  const [aberto, setAberto] = useState(false);
  const [link, setLink] = useState("");
  const [texto, setTexto] = useState("");
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);

  async function enviar() {
    setEnviando(true);
    setErro("");
    const r = await pedirAjudaParaPublicar({ link, texto, observacao: obs });
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
        Link do seu anúncio (opcional se colar o texto)
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
      {erro && (
        <p className="mt-3 text-sm text-red-700" role="alert" data-testid="ajuda-publicar-erro">
          {erro}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="gold" onClick={enviar} disabled={enviando} data-testid="ajuda-publicar-enviar">
          {enviando ? "Enviando…" : "Enviar pedido"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
