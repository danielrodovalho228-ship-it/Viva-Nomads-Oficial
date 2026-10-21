"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/dashboard/primitives";
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
      <Panel title="Meu local de trabalho" className="mt-6">
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
      </Panel>
    </section>
  );
}
