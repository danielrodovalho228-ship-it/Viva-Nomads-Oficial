"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileCheck2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  anexarLaudoConferencia,
  enviarFotoConferencia,
  registrarItemConferencia,
  responderConferencia,
  type ConferenciaView,
  type ConferenciasContrato,
} from "@/lib/data/conferencia-actions";
import {
  ajudaConfirmar,
  ERRO_ANTES_DA_OUTRA_PARTE,
  erroTamanhoLaudo,
  estadoConferencia,
  mesclarItens,
  mesclarLaudo,
  mesclarRespostas,
  podeResponder,
  ROTULO_ESTADO_CONFERENCIA as ROTULO_ESTADO,
  rotuloConfirmar,
  textoPrazoConferencia,
  type ItemTela,
  type LaudoTela,
  type RespostaTela,
  type TipoConferencia,
} from "@/lib/conferencia";
import { dataHoraBRT } from "@/lib/datas-brasilia";
import { MedirInternet } from "@/components/anuncio/medir-internet";
import { SecaoConfortoEntrada } from "@/components/conforto/secao-conforto-entrada";

const ROTULO_TIPO: Record<TipoConferencia, string> = { entrada: "Conferência de entrada", saida: "Conferência de saída" };
const ROTULO_PARTE = { proprietario: "Proprietário", inquilino: "Inquilino" } as const;

/** Data e hora sempre no horário de Brasília, qualquer que seja o fuso do navegador. */
const fmt = (iso: string) => dataHoraBRT(iso, { semEtiqueta: true });

/**
 * Conferência de entrada e de saída, nos dois painéis (ordens 404cd213 e d3c60126).
 * Fotos e itens por cômodo; cada parte confirma ou contesta uma vez; depois disso nada muda.
 * O laudo independente (PDF) prevalece sobre as fotos quando existe.
 */
export function ConferenciaContrato({ contratoId, statusContrato, dados }: { contratoId: string; statusContrato: string; dados: ConferenciasContrato }) {
  const tipos: TipoConferencia[] = statusContrato === "ativo" ? ["entrada", "saida"] : ["saida"];
  return (
    <div className="space-y-4" data-testid="conferencia">
      {tipos.map((t) => (
        <Bloco key={t} contratoId={contratoId} tipo={t} dados={dados} conf={dados.conferencias.find((c) => c.tipo === t) ?? null} />
      ))}
    </div>
  );
}

function Bloco({ contratoId, tipo, dados, conf }: { contratoId: string; tipo: TipoConferencia; dados: ConferenciasContrato; conf: ConferenciaView | null }) {
  const router = useRouter();
  const [comodo, setComodo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [reparo, setReparo] = useState(false);
  const [foto, setFoto] = useState<File | null>(null);
  // F3: o campo de arquivo não é controlado; trocar a chave depois de adicionar recria o campo vazio.
  const [chaveFoto, setChaveFoto] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [contestando, setContestando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [locais, setLocais] = useState<ItemTela[]>([]);
  const [respostasLocais, setRespostasLocais] = useState<RespostaTela[]>([]);
  const [laudoLocal, setLaudoLocal] = useState<LaudoTela | null>(null);

  const parte = dados.minhaParte;
  const respostas = mesclarRespostas(conf?.respostas ?? [], respostasLocais);
  const respondeu = respostas.some((r) => r.parte === parte);
  // cada parte registra até responder; com as duas respostas tudo congela
  const travada = respondeu || new Set(respostas.map((r) => r.parte)).size >= 2;
  const estado = conf ? estadoConferencia(respostas) : "em_andamento";
  const itens = mesclarItens(conf?.itens ?? [], locais);
  const laudo = mesclarLaudo(conf?.laudo ?? null, laudoLocal);
  const itensPorParte = { proprietario: itens.filter((i) => i.parte === "proprietario").length, inquilino: itens.filter((i) => i.parte === "inquilino").length };
  // F1 (Opção B): responde ao registro da OUTRA parte; os próprios itens são opcionais. Com o prazo (entrada ou saída) encerrado, libera.
  const encerrada = tipo === "entrada" ? dados.janelaEntradaEncerrada : dados.janelaSaidaEncerrada;
  // Prompt 38: na saída, o dono marca o que precisa de reparo (vira o pedido de manutenção quando a conferência fecha).
  const podeReparo = tipo === "saida" && parte === "proprietario";
  const liberado = parte ? podeResponder({ parte, itensPorParte, respostas, janelaEncerrada: encerrada }) : false;

  async function rodar(fn: () => Promise<{ ok: boolean; error?: string; item?: ItemTela; resposta?: RespostaTela; laudo?: LaudoTela }>) {
    setErro(null);
    setOcupado(true);
    try {
      const r = await fn();
      if (!r.ok) return setErro(r.error ?? "Não foi possível concluir.");
      if (r.item) setLocais((l) => [...l, r.item!]);
      if (r.resposta) setRespostasLocais((l) => [...l, r.resposta!]);
      if (r.laudo) setLaudoLocal(r.laudo);
      setComodo("");
      setDescricao("");
      setReparo(false);
      setFoto(null);
      setChaveFoto((k) => k + 1);
      setMotivo("");
      setContestando(false);
      router.refresh();
    } catch {
      setErro("Não foi possível enviar o arquivo. Confira o tamanho e tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  const adicionar = (e: React.FormEvent) => {
    e.preventDefault();
    rodar(async () => {
      let fotoPath: string | null = null;
      if (foto) {
        const fd = new FormData();
        fd.set("contratoId", contratoId);
        fd.set("arquivo", foto);
        const up = await enviarFotoConferencia(fd);
        if (!up.ok) return up;
        fotoPath = up.path ?? null;
      }
      return registrarItemConferencia({ contratoId, tipo, comodo, descricao, fotoPath, precisaReparo: podeReparo && reparo });
    });
  };

  const anexarLaudo = (arquivo: File | undefined) => {
    if (!arquivo) return;
    const grande = erroTamanhoLaudo(arquivo.size);
    if (grande) return setErro(grande);
    rodar(() => {
      const fd = new FormData();
      fd.set("contratoId", contratoId);
      fd.set("tipo", tipo);
      fd.set("arquivo", arquivo);
      return anexarLaudoConferencia(fd);
    });
  };

  return (
    <section className="rounded-xl border border-line p-4" data-testid={`conferencia-${tipo}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-title text-base font-semibold text-ink">{ROTULO_TIPO[tipo]}</h3>
        <span className="rounded-full bg-sage-100 px-3 py-1 text-xs font-medium text-forest" data-testid={`conferencia-${tipo}-estado`}>
          {ROTULO_ESTADO[estado]}
        </span>
      </div>
      {tipo === "entrada" && dados.prazoEntradaEm && (
        <p className="mt-1 text-xs text-muted" data-testid="conferencia-prazo" data-prazo={dados.prazoEntradaEm}>
          Registre fotos e itens por cômodo {textoPrazoConferencia(dados.prazoEntradaEm)} (48 h depois da entrada).
        </p>
      )}
      {/* Prompt 57: o morador pode medir a internet na entrada (nunca público; abaixo de 50% vira aviso ao dono). */}
      {tipo === "entrada" && parte === "inquilino" && !travada && dados.propertyId && (
        <MedirInternet imovelId={dados.propertyId} origem="conferencia_entrada" />
      )}
      {tipo === "saida" && dados.prazoSaidaEm && (
        <p className="mt-1 text-xs text-muted" data-testid="conferencia-prazo-saida" data-prazo={dados.prazoSaidaEm}>
          Registre fotos e itens por cômodo {textoPrazoConferencia(dados.prazoSaidaEm)} (48 h depois da saída).
        </p>
      )}

      {/* Prompt 59: seção "Padrão mínimo" (o morador confere cada item na entrada; entra no hash de fechamento). */}
      {tipo === "entrada" && <SecaoConfortoEntrada contratoId={contratoId} parte={parte} travada={travada} respondidas={conf?.conforto ?? []} />}

      {laudo && (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-sage-50 p-3 text-sm text-ink" data-testid="conferencia-laudo">
          <FileCheck2 className="h-4 w-4 shrink-0 text-forest" />
          <span>
            <strong>Laudo independente</strong> anexado em {fmt(laudo.criadoEm)} — prevalece sobre as fotos.{" "}
            {laudo.url && (
              <a href={laudo.url} target="_blank" rel="noopener noreferrer" className="font-medium text-forest underline">
                Abrir PDF
              </a>
            )}
          </span>
        </p>
      )}

      {itens.length > 0 ? (
        <ul className="mt-3 divide-y divide-line text-sm" data-testid={`conferencia-${tipo}-itens`}>
          {itens.map((i) => (
            <li key={i.id} className="flex items-start gap-3 py-2">
              {i.fotoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.fotoUrl} alt={`Foto: ${i.comodo}`} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
              )}
              <div className="min-w-0">
                <p className="font-medium text-ink">{i.comodo}</p>
                <p className="break-words text-muted">{i.descricao}</p>
                <p className="text-xs text-muted">
                  {ROTULO_PARTE[i.parte]} · {fmt(i.criadoEm)}
                  {i.precisaReparo && (
                    <span className="font-medium text-ink" data-testid="item-precisa-reparo">
                      {" "}
                      · Precisa de reparo
                    </span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">Nenhum item registrado ainda.</p>
      )}

      {conf && respostas.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-ink" data-testid={`conferencia-${tipo}-respostas`}>
          {respostas.map((r) => (
            <li key={r.parte}>
              {ROTULO_PARTE[r.parte]} {r.decisao === "confirmou" ? "confirmou" : "contestou"} em {fmt(r.decididoEm)}
              {r.motivo ? ` — ${r.motivo}` : ""}
            </li>
          ))}
        </ul>
      )}

      {parte && !travada && (
        <form onSubmit={adicionar} className="mt-4 grid grid-cols-1 gap-2" data-testid={`conferencia-${tipo}-form`}>
          <input value={comodo} onChange={(e) => setComodo(e.target.value)} maxLength={60} placeholder="Cômodo (ex.: Sala)" aria-label="Cômodo" className="h-11 rounded-lg border border-line px-3 text-sm" />
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={300} rows={2} placeholder="Itens e estado do cômodo" aria-label="Itens e estado do cômodo" className="rounded-lg border border-line p-3 text-sm" />
          <input type="file" key={chaveFoto} accept="image/jpeg,image/png,image/webp" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} aria-label="Foto do cômodo" className="block w-full min-w-0 max-w-full text-sm" data-testid={`conferencia-${tipo}-foto`} />
          {foto && (
            <p className="break-all text-xs text-muted" data-testid={`conferencia-${tipo}-foto-escolhida`}>
              Foto escolhida: {foto.name}
            </p>
          )}
          {podeReparo && (
            <label className="flex items-start gap-2 text-sm text-ink">
              <input type="checkbox" checked={reparo} onChange={(e) => setReparo(e.target.checked)} className="mt-1" data-testid="conferencia-saida-reparo" />
              <span>Precisa de reparo. Com manutenção fixa no imóvel, o pedido sai quando a conferência fechar.</span>
            </label>
          )}
          <Button type="submit" variant="outline" disabled={ocupado || !comodo.trim() || !descricao.trim()}>
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" />} Adicionar item
          </Button>
        </form>
      )}

      {parte && !laudo && (
        <label className="mt-3 block text-sm text-muted">
          Anexar laudo independente (PDF, até 15 MB)
          <input type="file" accept="application/pdf" disabled={ocupado} onChange={(e) => anexarLaudo(e.target.files?.[0])} className="mt-1 block w-full min-w-0 max-w-full text-sm" data-testid={`conferencia-${tipo}-laudo-input`} />
        </label>
      )}

      {parte && !respondeu && !travada && !liberado && (
        <p className="mt-4 text-xs text-muted" data-testid={`conferencia-${tipo}-aguardando-registro`}>
          {ERRO_ANTES_DA_OUTRA_PARTE}
        </p>
      )}

      {parte && !respondeu && !travada && liberado && (
        <div className="mt-4 space-y-2">
          {contestando ? (
            <>
              <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={1000} rows={3} placeholder="Conte o motivo da contestação" aria-label="Motivo da contestação" className="w-full rounded-lg border border-line p-3 text-sm" />
              <div className="flex gap-2">
                <Button variant="secondary" disabled={ocupado || !motivo.trim()} onClick={() => rodar(() => responderConferencia({ contratoId, tipo, decisao: "contestou", motivo }))}>
                  Enviar contestação
                </Button>
                <Button variant="outline" onClick={() => setContestando(false)}>
                  Voltar
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button disabled={ocupado} onClick={() => rodar(() => responderConferencia({ contratoId, tipo, decisao: "confirmou" }))} data-testid={`conferencia-${tipo}-confirmar`}>
                {rotuloConfirmar(parte)}
              </Button>
              <Button variant="outline" disabled={ocupado} onClick={() => setContestando(true)}>
                Contestar
              </Button>
              <p className="w-full text-xs text-muted" data-testid={`conferencia-${tipo}-ajuda`}>
                {ajudaConfirmar(parte)} Depois de confirmar ou contestar, a conferência não pode mais ser alterada.
              </p>
            </div>
          )}
        </div>
      )}
      {erro && (
        <p role="alert" className="mt-3 text-sm text-red-700" data-testid="conferencia-erro">
          {erro}
        </p>
      )}
    </section>
  );
}
