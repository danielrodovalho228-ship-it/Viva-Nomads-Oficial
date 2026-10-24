"use client";

import { Briefcase, X } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { ATE_OPCOES, ROTULO_MODO, type ModoRota } from "@/lib/rotas/tempo";
import type { DestinoBusca, EstadoDestino } from "@/lib/busca/destino-busca";
import { MSG_NAO_ACHAMOS, ROTULO_NAO_ACHEI } from "@/lib/destinos/pessoal";
import { apagarLocal, buscarOutroLocal, meusLocais, pedirLocalNaoAchado, usarLocal, type LocalPessoal } from "@/lib/destinos/pessoal-actions";
import { useEffect, useState } from "react";

export interface DestinoChip {
  slug: string;
  nome: string;
  cidade: string;
  /** E79: ponto público da âncora e o artigo, para a linha reta no cartão (opcionais). */
  artigo?: "o" | "a" | "";
  lat?: number | null;
  lng?: number | null;
}

/**
 * "Onde você vai trabalhar ou estudar?" (prompt 37): chips dos destinos cadastrados da cidade, meio e "até N min".
 * Ônibus só aparece com a chave ligada (meio sem dado não aparece).
 * DESTINO-PESSOAL-B: "Outro local" — o servidor acha o endereço (OSM; Mapbox com token). Logada, a pessoa vê os locais
 * que já usou ("Seus locais", só dela); sem login, o local vai só na URL. Não achou: "Não achamos este endereço." e
 * "Não achei meu local" (nome do lugar + cidade) para a equipe cadastrar.
 */
export function CampoDestino({
  destinos,
  modos,
  valor,
  onChange,
  cidade,
  uf = "MG",
}: {
  destinos: DestinoChip[];
  modos: ModoRota[];
  valor: EstadoDestino;
  onChange: (e: EstadoDestino) => void;
  /** Cidade da busca (para achar o endereço no lugar certo); sem ela, a dos destinos ou Uberlândia. */
  cidade?: string | null;
  uf?: string;
}) {
  const { destino, modo, ate } = valor;
  const [locais, setLocais] = useState<LocalPessoal[]>([]);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    meusLocais()
      .then((l) => vivo && setLocais(l))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  const cidadeBusca = cidade || destinos[0]?.cidade || "Uberlândia";
  const slug = destino && "slug" in destino ? destino.slug : null;
  const digitado = destino && !("slug" in destino) ? destino : null;
  const escolher = (d: DestinoBusca | null) => onChange({ destino: d, modo, ate: d ? ate : 0 });

  return (
    <section className="rounded-xl border border-line bg-white p-4" data-testid="campo-destino" aria-labelledby="titulo-destino">
      <h2 id="titulo-destino" className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Briefcase className="h-4 w-4" aria-hidden /> Onde você vai trabalhar ou estudar?
      </h2>
      {destinos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2" data-testid="destinos-chips">
          {destinos.map((d) => (
            <Chip key={d.slug} ativo={slug === d.slug} data-testid={`destino-${d.slug}`} onClick={() => escolher(slug === d.slug ? null : { slug: d.slug })}>
              {d.nome}
            </Chip>
          ))}
        </div>
      )}
      {locais.length > 0 && (
        <div className="mt-3" data-testid="destinos-pessoais">
          <p className="text-xs font-semibold text-muted">Seus locais</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {locais.map((l) => {
              const ativo = !!digitado && digitado.lat.toFixed(2) === l.lat.toFixed(2) && digitado.lng.toFixed(2) === l.lng.toFixed(2);
              return (
                <span key={l.id} className="inline-flex items-center gap-1" data-testid="destino-pessoal-item">
                  <Chip
                    ativo={ativo}
                    data-testid="destino-pessoal"
                    onClick={() => {
                      if (ativo) return escolher(null);
                      void usarLocal(l.id).catch(() => undefined);
                      escolher({ lat: l.lat, lng: l.lng, rot: l.rotulo });
                    }}
                  >
                    {l.rotulo}
                  </Chip>
                  {/* E81: apagar o local guardado vale na hora; se era o destino ativo, a busca volta para qualquer lugar. */}
                  <button
                    type="button"
                    aria-label={`Apagar o local ${l.rotulo}`}
                    title="Apagar este local"
                    data-testid="destino-pessoal-apagar"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-red-700"
                    onClick={async () => {
                      setErroLocal(null);
                      const antes = locais;
                      setLocais((ls) => ls.filter((x) => x.id !== l.id));
                      if (ativo) escolher(null);
                      const r = await apagarLocal(l.id).catch(() => ({ ok: false }));
                      if (!r.ok) {
                        setLocais(antes);
                        setErroLocal("Não foi possível apagar o local agora. Tente de novo.");
                      }
                    }}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </span>
              );
            })}
          </div>
          {erroLocal && (
            <p role="alert" className="mt-1 text-sm text-red-700" data-testid="destino-pessoal-erro">
              {erroLocal}
            </p>
          )}
        </div>
      )}
      <div className="mt-3 min-w-0">
        {digitado ? (
          <p className="inline-flex max-w-full items-center gap-2 rounded-full border border-line px-3 py-2 text-sm text-ink" data-testid="destino-digitado">
            <span className="truncate">{digitado.rot || "Endereço informado"}</span>
            <button type="button" aria-label="Tirar o endereço" onClick={() => escolher(null)} className="shrink-0 text-muted hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </p>
        ) : (
          <OutroLocal
            cidade={cidadeBusca}
            uf={uf}
            onAchou={(r) => {
              escolher({ lat: r.ponto.lat, lng: r.ponto.lng, rot: r.rotulo });
              if (r.guardado) meusLocais().then(setLocais).catch(() => undefined);
            }}
          />
        )}
      </div>
      {destino && (
        <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="destino-opcoes">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Como você vai">
            {modos.map((m) => (
              <Chip key={m} ativo={modo === m} data-testid={`modo-${m}`} onClick={() => onChange({ destino, modo: m, ate })}>
                {ROTULO_MODO[m]}
              </Chip>
            ))}
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-ink">
            até
            <select
              value={String(ate)}
              onChange={(e) => onChange({ destino, modo, ate: Number(e.target.value) })}
              aria-label="Tempo máximo até o trabalho"
              data-testid="destino-ate"
              className="h-10 rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-ink"
            >
              <option value="0">qualquer tempo</option>
              {ATE_OPCOES.map((n) => (
                <option key={n} value={n}>
                  {n} min
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </section>
  );
}

/** "Outro local": o servidor acha o endereço; não achou, oferece o pedido "Não achei meu local". */
function OutroLocal({ cidade, uf, onAchou }: { cidade: string; uf: string; onAchou: (r: { ponto: { lat: number; lng: number }; rotulo: string; guardado: boolean }) => void }) {
  const [texto, setTexto] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [naoAchou, setNaoAchou] = useState(false);
  const [pedido, setPedido] = useState<{ aberto: boolean; nome: string; cidade: string; msg: { ok: boolean; t: string } | null; enviando: boolean }>({ aberto: false, nome: "", cidade, msg: null, enviando: false });

  async function buscar() {
    setBuscando(true);
    setErro(null);
    setNaoAchou(false);
    try {
      const r = await buscarOutroLocal(texto, cidade, uf);
      if (r.ok) {
        setTexto("");
        onAchou(r);
      } else {
        setErro(r.naoAchou ? MSG_NAO_ACHAMOS : r.erro);
        setNaoAchou(r.naoAchou === true);
        if (r.naoAchou) setPedido((p) => ({ ...p, nome: texto.trim().slice(0, 80) }));
      }
    } catch {
      setErro("A busca não respondeu agora. Tente de novo.");
    } finally {
      setBuscando(false);
    }
  }

  async function enviarPedido() {
    setPedido((p) => ({ ...p, enviando: true, msg: null }));
    try {
      const r = await pedirLocalNaoAchado(pedido.nome, pedido.cidade);
      setPedido((p) => ({ ...p, enviando: false, aberto: !r.ok, msg: r.ok ? { ok: true, t: r.mensagem } : { ok: false, t: r.erro } }));
    } catch {
      setPedido((p) => ({ ...p, enviando: false, msg: { ok: false, t: "Não foi possível enviar agora." } }));
    }
  }

  return (
    <div data-testid="outro-local">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!buscando) void buscar();
        }}
      >
        <label htmlFor="outro-local-texto" className="sr-only">
          Outro local: nome do lugar ou endereço
        </label>
        <input
          id="outro-local-texto"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Outro local: nome do lugar ou endereço"
          maxLength={150}
          className="h-12 w-full min-w-0 rounded-lg border border-line bg-white px-3 text-base text-ink outline-none focus:border-ink sm:w-auto sm:flex-1"
          data-testid="outro-local-texto"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={buscando || texto.trim().length < 3} data-testid="outro-local-buscar">
          {buscando ? "Buscando…" : "Buscar"}
        </Button>
      </form>
      {erro && (
        <p role="alert" className="mt-2 text-sm text-red-700" data-testid="outro-local-erro">
          {erro}
        </p>
      )}
      {naoAchou && !pedido.aberto && !pedido.msg?.ok && (
        <button
          type="button"
          className="mt-1 text-sm font-semibold text-forest underline underline-offset-2"
          onClick={() => setPedido((p) => ({ ...p, aberto: true, msg: null }))}
          data-testid="nao-achei-abrir"
        >
          {ROTULO_NAO_ACHEI}
        </button>
      )}
      {pedido.aberto && (
        <form
          className="mt-2 grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
          data-testid="nao-achei-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!pedido.enviando) void enviarPedido();
          }}
        >
          <label className="block text-sm text-ink">
            Nome do lugar
            <input
              value={pedido.nome}
              onChange={(e) => setPedido((p) => ({ ...p, nome: e.target.value }))}
              maxLength={80}
              placeholder="Ex.: Clínica Bem Estar"
              className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-3 text-base outline-none focus:border-ink"
              data-testid="nao-achei-nome"
            />
          </label>
          <label className="block text-sm text-ink">
            Cidade
            <input
              value={pedido.cidade}
              onChange={(e) => setPedido((p) => ({ ...p, cidade: e.target.value }))}
              maxLength={80}
              className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-3 text-base outline-none focus:border-ink"
              data-testid="nao-achei-cidade"
            />
          </label>
          <Button type="submit" size="sm" disabled={pedido.enviando} data-testid="nao-achei-enviar">
            {pedido.enviando ? "Enviando…" : "Pedir o local"}
          </Button>
        </form>
      )}
      {pedido.msg && (
        <p role={pedido.msg.ok ? "status" : "alert"} className={pedido.msg.ok ? "mt-2 text-sm text-ink" : "mt-2 text-sm text-red-700"} data-testid="nao-achei-msg">
          {pedido.msg.t}
        </p>
      )}
    </div>
  );
}
