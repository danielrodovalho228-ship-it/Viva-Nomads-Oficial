"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ITENS_CONFORTO, itemConforto, ehChaveConforto } from "@/config/conforto-minimo";
import { TEXTO_NAO_CONFERE_MAX } from "@/lib/conforto/regras";
import { enviarFotoConferencia, responderConfortoEntrada, type ConferenciaView } from "@/lib/data/conferencia-actions";

type Resposta = { confere: boolean | null; texto: string; foto: File | null };

/**
 * Prompt 59 — seção "Padrão mínimo" da conferência de ENTRADA. O morador marca cada item: confere / não confere (com texto
 * curto e foto opcional). Cada "não confere" vira pendência do dono (72 h). Entra no mesmo hash de fechamento.
 */
export function SecaoConfortoEntrada({
  contratoId,
  parte,
  travada,
  respondidas,
}: {
  contratoId: string;
  parte: "inquilino" | "proprietario" | null;
  travada: boolean;
  respondidas: ConferenciaView["conforto"];
}) {
  const router = useRouter();
  const [r, setR] = useState<Record<string, Resposta>>(() => Object.fromEntries(ITENS_CONFORTO.map((i) => [i.chave, { confere: null, texto: "", foto: null }])));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // O que o morador acabou de enviar aparece na hora (como os itens da conferência), sem esperar o servidor reler a tela.
  const [enviadas, setEnviadas] = useState<ConferenciaView["conforto"] | null>(null);
  const muda = (chave: string, v: Partial<Resposta>) => setR((a) => ({ ...a, [chave]: { ...a[chave], ...v } }));

  const lista = respondidas.length > 0 ? respondidas : (enviadas ?? []);
  if (lista.length > 0) {
    return (
      <div className="mt-3 rounded-lg border border-line p-3" data-testid="conforto-entrada-respondida">
        <p className="text-sm font-semibold text-ink">Padrão mínimo (morador)</p>
        <ul className="mt-2 space-y-1 text-sm">
          {lista.map((x) => (
            <li key={x.chave} data-testid={`conforto-entrada-${x.chave}`} data-confere={x.confere ? "1" : "0"} className="flex items-start gap-2">
              <span className={x.confere ? "text-forest" : "text-red-700"}>{x.confere ? "Confere" : "Não confere"}</span>
              <span className="min-w-0 text-ink">
                {ehChaveConforto(x.chave) ? itemConforto(x.chave).rotulo : x.chave}
                {!x.confere && x.texto ? <span className="block break-words text-xs text-muted">{x.texto}</span> : null}
                {x.fotoUrl && (
                  <a href={x.fotoUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-forest underline">
                    Ver foto
                  </a>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (parte !== "inquilino" || travada) return null;

  const respondidosTodos = ITENS_CONFORTO.every((i) => r[i.chave].confere !== null);
  const enviar = async () => {
    setErro(null);
    setOcupado(true);
    try {
      const respostas = [];
      for (const i of ITENS_CONFORTO) {
        const x = r[i.chave];
        let foto: string | undefined;
        if (x.confere === false && x.foto) {
          const fd = new FormData();
          fd.set("contratoId", contratoId);
          fd.set("arquivo", x.foto);
          const up = await enviarFotoConferencia(fd);
          if (!up.ok) return setErro(up.error);
          foto = up.path;
        }
        respostas.push({ chave: i.chave, confere: x.confere === true, ...(x.confere === false ? { texto: x.texto, ...(foto ? { foto } : {}) } : {}) });
      }
      const res = await responderConfortoEntrada({ contratoId, respostas });
      if (!res.ok) return setErro(res.error);
      const agora = new Date().toISOString();
      setEnviadas(respostas.map((x) => ({ chave: x.chave, confere: x.confere, texto: x.confere ? null : (x.texto ?? null), fotoUrl: null, respondidoEm: agora })));
      router.refresh();
    } catch {
      setErro("Não foi possível enviar agora. Confira as fotos e tente de novo.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-line p-3" data-testid="conforto-entrada-form">
      <p className="text-sm font-semibold text-ink">Padrão mínimo</p>
      <p className="mt-1 text-xs text-muted">Confira cada item. O que não confere vira pendência do proprietário, com prazo de 72 horas.</p>
      <ul className="mt-3 space-y-3">
        {ITENS_CONFORTO.map((i) => {
          const x = r[i.chave];
          return (
            <li key={i.chave} data-testid={`conforto-entrada-item-${i.chave}`}>
              <p className="text-sm font-semibold text-ink">{i.rotulo}</p>
              <p className="text-xs text-muted">{i.criterio}</p>
              <div className="mt-1 flex flex-wrap gap-4 text-sm text-ink" role="radiogroup" aria-label={i.rotulo}>
                <label className="flex min-h-11 items-center gap-2">
                  <input type="radio" name={`conforto-${i.chave}`} checked={x.confere === true} onChange={() => muda(i.chave, { confere: true })} data-testid={`conforto-confere-${i.chave}`} />
                  Confere
                </label>
                <label className="flex min-h-11 items-center gap-2">
                  <input type="radio" name={`conforto-${i.chave}`} checked={x.confere === false} onChange={() => muda(i.chave, { confere: false })} data-testid={`conforto-nao-confere-${i.chave}`} />
                  Não confere
                </label>
              </div>
              {x.confere === false && (
                <div className="mt-1 grid gap-2">
                  <textarea
                    value={x.texto}
                    onChange={(e) => muda(i.chave, { texto: e.target.value })}
                    maxLength={TEXTO_NAO_CONFERE_MAX}
                    rows={2}
                    placeholder="O que não confere"
                    aria-label={`O que não confere em ${i.rotulo}`}
                    className="rounded-lg border border-line p-3 text-sm"
                    data-testid={`conforto-texto-${i.chave}`}
                  />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => muda(i.chave, { foto: e.target.files?.[0] ?? null })}
                    aria-label={`Foto de ${i.rotulo} (opcional)`}
                    data-testid={`conforto-foto-${i.chave}`}
                    className="block w-full min-w-0 max-w-full text-sm"
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <Button className="mt-3" disabled={ocupado || !respondidosTodos} onClick={enviar} data-testid="conforto-entrada-enviar">
        {ocupado && <Loader2 className="h-4 w-4 animate-spin" />} Enviar padrão mínimo
      </Button>
      {erro && (
        <p role="alert" className="mt-2 text-sm text-red-700" data-testid="conforto-entrada-erro">
          {erro}
        </p>
      )}
    </div>
  );
}
