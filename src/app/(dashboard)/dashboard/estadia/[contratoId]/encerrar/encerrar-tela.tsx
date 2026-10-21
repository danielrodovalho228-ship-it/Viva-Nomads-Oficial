"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { ConfirmarNaPagina } from "@/components/ui/confirmar-na-pagina";
import { pedirEncerramento } from "@/lib/data/estadia-actions";
import { HREF_ESTADIA } from "@/lib/estadia/estadia";
import { MOTIVOS_ENCERRAMENTO, TEXTO_REGRAS_DESLIGADAS, type MotivoEncerramento } from "@/lib/estadia/encerramento";

const campo = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink";

/** Motivo → consequências → confirmar na página (nunca um diálogo do navegador). */
export function EncerrarTela({ contratoId }: { contratoId: string }) {
  const router = useRouter();
  const [passo, setPasso] = useState<"motivo" | "consequencias">("motivo");
  const [motivo, setMotivo] = useState<MotivoEncerramento | "">("");
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const motivoOk = motivo !== "" && (motivo !== "outro" || texto.trim().length >= 5);

  return (
    <Panel data-testid="encerrar-form" data-passo={passo}>
      {passo === "motivo" ? (
        <fieldset className="grid gap-3">
          <legend className="mb-2 font-title text-lg font-bold text-ink">Por que encerrar?</legend>
          {MOTIVOS_ENCERRAMENTO.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" name="motivo" value={m.id} checked={motivo === m.id} onChange={() => setMotivo(m.id)} data-testid={`encerrar-motivo-${m.id}`} />
              {m.rotulo}
            </label>
          ))}
          {motivo === "outro" && (
            <textarea className={campo} rows={3} maxLength={1000} placeholder="Conte em poucas palavras" value={texto} onChange={(e) => setTexto(e.target.value)} data-testid="encerrar-texto" />
          )}
          <div>
            <Button variant="primary" size="sm" disabled={!motivoOk} onClick={() => setPasso("consequencias")} data-testid="encerrar-continuar">
              Continuar
            </Button>
          </div>
        </fieldset>
      ) : (
        <div className="grid gap-3">
          <h2 className="font-title text-lg font-bold text-ink">O que acontece</h2>
          {/* ENCERRAMENTO_REGRAS_ATIVO desligada: nenhum valor de multa ou devolução aparece (consequenciasDoEncerramento
              não tem regras até o parecer). Quando as regras existirem, o resultado delas entra aqui. */}
          <p className="text-sm text-ink" data-testid="encerrar-consequencias">
            {TEXTO_REGRAS_DESLIGADAS}
          </p>
          <div className="flex flex-wrap gap-3">
            <ConfirmarNaPagina
              aviso="Confirmar o pedido de encerramento? A outra parte e a Viva são avisadas."
              confirmar="Confirmar pedido"
              variant="primary"
              onConfirmar={() =>
                iniciar(async () => {
                  setErro(null);
                  const r = await pedirEncerramento(contratoId, motivo, texto);
                  if (!r.ok) setErro(r.erro);
                  else router.push(HREF_ESTADIA(contratoId));
                })
              }
              disabled={pendente}
              testid="encerrar-confirmar"
            >
              Pedir encerramento
            </ConfirmarNaPagina>
            <Button variant="tertiary" size="sm" onClick={() => setPasso("motivo")}>
              Voltar
            </Button>
          </div>
        </div>
      )}
      {erro && (
        <p role="alert" className="mt-2 text-sm font-semibold text-red-700" data-testid="estadia-erro">
          {erro}
        </p>
      )}
    </Panel>
  );
}
