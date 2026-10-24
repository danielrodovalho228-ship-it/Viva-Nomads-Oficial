"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/dashboard/primitives";
import { BlocoOpcional } from "@/components/ui/bloco-opcional";
import { textosToggle, toggleInicial } from "@/lib/ui/bloco-opcional";
import {
  CampoDestino,
  type DestinoChip,
} from "@/components/busca/campo-destino";
import { salvarLocalTrabalho } from "@/lib/data/local-trabalho-actions";
import type { EstadoDestino } from "@/lib/busca/destino-busca";
import type { ModoRota } from "@/lib/rotas/tempo";

const VAZIO: EstadoDestino = { destino: null, modo: "carro", ate: 0 };

/**
 * "Meu local de trabalho" (prompt 37): privado — só você vê. Vira o destino padrão da busca, do alerta e do pedido de
 * moradia. O endereço digitado fica guardado sem número de casa.
 */
export function MeuLocalTrabalho() {
  const [estado, setEstado] = useState<EstadoDestino>(VAZIO);
  const [salvo, setSalvo] = useState<string | null>(null);
  const [destinos, setDestinos] = useState<DestinoChip[]>([]);
  const [modos, setModos] = useState<ModoRota[]>([
    "carro",
    "a_pe",
    "bicicleta",
  ]);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  // C9/E56: atrás do toggle; com local salvo nasce ligado.
  const [ligado, setLigado] = useState(false);

  useEffect(() => {
    fetch("/api/conta/local-trabalho")
      .then((r) => (r.status === 200 ? r.json() : null))
      .then(
        (
          j: {
            estado: EstadoDestino | null;
            rotulo: string | null;
            destinos: DestinoChip[];
            modos: ModoRota[];
          } | null,
        ) => {
          if (!j) return;
          setDestinos(j.destinos ?? []);
          if (j.modos?.length) setModos(j.modos);
          if (j.estado) setEstado(j.estado);
          setSalvo(j.rotulo);
          setLigado(toggleInicial(!!j.rotulo));
        },
      )
      .catch(() => undefined);
  }, []);

  const salvar = (e: EstadoDestino | null) =>
    iniciar(async () => {
      const d = e?.destino;
      const r = await salvarLocalTrabalho(
        !e || !d
          ? null
          : "slug" in d
            ? { destinoSlug: d.slug, modo: e.modo, ate: e.ate }
            : {
                lat: d.lat,
                lng: d.lng,
                rotulo: d.rot,
                modo: e.modo,
                ate: e.ate,
              },
      );
      if (r.ok) {
        setSalvo(r.rotulo);
        if (!e) setEstado(VAZIO);
        setMsg({
          ok: true,
          texto: r.rotulo
            ? "Local de trabalho salvo."
            : "Local de trabalho removido.",
        });
      } else setMsg({ ok: false, texto: r.erro });
    });

  return (
    <section id="local-trabalho" className="scroll-mt-24">
      <Panel className="mt-6">
        <BlocoOpcional
          titulo="Meu local de trabalho"
          pergunta={textosToggle("local-trabalho").pergunta}
          ligado={ligado}
          onLigado={setLigado}
          temDados={!!salvo}
          textoConfirmar={textosToggle("local-trabalho").confirmar}
          onLimpar={async () => {
            const r = await salvarLocalTrabalho(null);
            if (r.ok) {
              setSalvo(null);
              setEstado(VAZIO);
              setMsg(null);
            }
            return r.ok;
          }}
          testId="local-toggle-bloco"
        >
        <div className="space-y-3" data-testid="meu-local-trabalho">
          <p className="text-sm text-muted">
            Só você vê. Usamos para mostrar o tempo até o trabalho na busca, nos
            alertas e no pedido de moradia.
          </p>
          <p className="text-sm text-ink" data-testid="local-salvo">
            {salvo ? (
              <>
                Salvo: <strong>{salvo}</strong>
              </>
            ) : (
              "Nenhum local salvo."
            )}
          </p>
          <CampoDestino
            destinos={destinos}
            modos={modos}
            valor={estado}
            onChange={setEstado}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => salvar(estado)}
              disabled={pendente || !estado.destino}
              data-testid="salvar-local-trabalho"
            >
              {pendente ? "Salvando…" : "Salvar local de trabalho"}
            </Button>
            {salvo && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => salvar(null)}
                disabled={pendente}
                data-testid="remover-local-trabalho"
              >
                Remover
              </Button>
            )}
            {msg && (
              <p
                role="status"
                className={
                  msg.ok ? "text-sm text-forest" : "text-sm text-red-700"
                }
              >
                {msg.texto}
              </p>
            )}
          </div>
        </div>
        </BlocoOpcional>
      </Panel>
    </section>
  );
}
