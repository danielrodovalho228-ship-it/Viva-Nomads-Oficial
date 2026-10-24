"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, ExternalLink, Loader2, Upload } from "lucide-react";
import { linkMeuVinculo, meuVinculo, type MeuVinculo } from "@/lib/data/triagem-actions";
import { TIPOS_VINCULO, podeEnviar, type TipoVinculo } from "@/lib/triagem/vinculo";
import { abrirLinkEmNovaAba } from "@/lib/abrir-aba";
import { validarArquivoDoc } from "@/lib/upload-limits";

const dataBR = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "");

/**
 * Prompt 52 — o comprovante de vínculo do morador, no degrau da transação (candidatura aceita, antes do contrato).
 * Só aparece com a chave TRIAGEM_VINCULO_ATIVA (a página confere; as ações também). O dono nunca vê o arquivo.
 */
export function VinculoMorador() {
  const [v, setV] = useState<MeuVinculo | null | undefined>(undefined);
  const [tipo, setTipo] = useState<TipoVinculo>("carta_empregador");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => {
    meuVinculo()
      .then(setV)
      .catch(() => setV(null));
  }, []);
  useEffect(recarregar, [recarregar]);

  async function enviar(file: File | undefined) {
    if (!file) return;
    setErro(null);
    const invalido = validarArquivoDoc({ type: file.type, size: file.size });
    if (invalido) return setErro(invalido);
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append("tipo", tipo);
      fd.append("file", file);
      const res = await fetch("/api/upload/triagem-vinculo", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setErro(data.error ?? "Não foi possível enviar agora.");
      recarregar();
    } catch {
      setErro("Não foi possível enviar agora. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }
  async function abrir() {
    setErro(null);
    let motivo = "Não foi possível abrir agora.";
    const ok = await abrirLinkEmNovaAba(
      () => window.open("about:blank", "_blank"),
      async () => {
        const r = await linkMeuVinculo();
        if (r.ok && r.url) return r.url;
        if (r.error) motivo = r.error;
        return null;
      },
    );
    if (!ok) setErro(motivo);
  }

  if (!v || !v.noDegrau) return null;
  const titulo = TIPOS_VINCULO.find((t) => t.tipo === v.tipo)?.titulo;
  return (
    <section className="mb-6 rounded-xl border border-line bg-white p-4" data-testid="triagem-vinculo" data-estado={v.estado}>
      <h2 className="font-title text-base font-semibold text-ink">Comprovante de vínculo</h2>
      <p className="mt-1 text-sm text-muted">
        Um documento que mostra o que traz você à cidade. Com a identidade confirmada, o proprietário vê o selo <strong>Morador verificado</strong>, válido por 12
        meses. Ele não vê o arquivo nem nenhum valor; só a equipe da Viva confere.
      </p>
      {v.estado === "aprovado" && (
        <p className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-forest" data-testid="triagem-aprovado">
          <BadgeCheck className="h-4 w-4" aria-hidden /> Vínculo confirmado ({titulo}) · válido até {dataBR(v.validoAte)}
        </p>
      )}
      {v.estado === "pendente" && (
        <p className="mt-3 text-sm text-ink" data-testid="triagem-pendente">
          Recebido em {dataBR(v.enviadoEm)} ({titulo}). A equipe confere em até 2 dias úteis.
        </p>
      )}
      {v.estado === "recusado" && (
        <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="triagem-recusado">
          {v.motivo} Envie de novo abaixo.
        </p>
      )}
      {v.estado === "vencido" && <p className="mt-3 text-sm text-ink">A confirmação do vínculo venceu. Envie um comprovante atual.</p>}
      {v.enviadoEm && (
        <button type="button" onClick={abrir} className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-forest underline">
          <ExternalLink className="h-4 w-4" aria-hidden /> Ver o que enviei (link de 10 min)
        </button>
      )}
      {podeEnviar(v.estado) && (
        <div className="mt-3 space-y-2">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink">Qual documento?</legend>
            {TIPOS_VINCULO.map((t) => (
              <label key={t.tipo} className="flex items-start gap-2 rounded-lg border border-sage-200 px-3 py-2 text-sm">
                <input type="radio" name="tipo-vinculo" value={t.tipo} checked={tipo === t.tipo} onChange={() => setTipo(t.tipo)} className="mt-1" data-testid={`triagem-tipo-${t.tipo}`} />
                <span>
                  <span className="block font-medium text-ink">{t.titulo}</span>
                  <span className="block text-muted">{t.ajuda}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-white">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {enviando ? "Enviando…" : v.estado === "pendente" ? "Trocar arquivo" : "Enviar comprovante"}
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="sr-only"
              aria-label="Enviar comprovante de vínculo"
              disabled={enviando}
              data-testid="triagem-arquivo"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                void enviar(f);
              }}
            />
          </label>
          <p className="text-xs text-muted">PDF, JPG ou PNG, até 10 MB. Fica em armazenamento privado.</p>
        </div>
      )}
      {erro && (
        <p role="alert" className="mt-2 text-sm text-red-600" data-testid="triagem-erro">
          {erro}
        </p>
      )}
    </section>
  );
}
