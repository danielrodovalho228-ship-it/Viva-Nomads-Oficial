"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { ConfirmarNaPagina } from "@/components/ui/confirmar-na-pagina";
import type { OcupanteView } from "@/lib/data/estadia";
import { adicionarOcupante, removerOcupante } from "@/lib/data/estadia-actions";
import { podeAdicionarOcupante, textoTetoOcupantes } from "@/lib/estadia/ocupantes";
import { ListaPortaria } from "../estadia-tela";

const campo = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink";

export function OcupantesTela({
  contratoId,
  ocupantes: doServidor,
  previstos,
  podeEditar,
  motivoBloqueio,
}: {
  contratoId: string;
  ocupantes: OcupanteView[];
  previstos: number;
  podeEditar: boolean;
  motivoBloqueio: string | null;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [relacao, setRelacao] = useState("");
  // A lista é desta tela: o resultado de cada ação já confirmada entra aqui, sem esperar pelo refresh da página
  // (que o roteador pode descartar enquanto o painel dispara ações e prefetches; t256).
  const [ocupantes, setOcupantes] = useState<OcupanteView[]>(doServidor);
  const cabe = podeAdicionarOcupante(ocupantes.length, previstos);

  const salvar = () =>
    iniciar(async () => {
      setErro(null);
      const r = await adicionarOcupante(contratoId, { nome, documento, parentescoOuRelacao: relacao });
      if (!r.ok) setErro(r.erro);
      else {
        setOcupantes((l) => [...l, r.valor]);
        setNome("");
        setDocumento("");
        setRelacao("");
        router.refresh();
      }
    });

  return (
    <>
      <Panel title={`Ocupantes (${ocupantes.length} de ${previstos})`} data-testid="ocupantes-lista">
        {ocupantes.length === 0 ? (
          <p className="text-sm text-muted">Nenhum ocupante preenchido ainda.</p>
        ) : (
          <ul className="divide-y divide-line">
            {ocupantes.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2" data-testid="ocupante">
                <span className="min-w-0 text-sm text-ink">
                  <span className="font-semibold">{o.nome}</span> · {o.documento}
                  {o.relacao ? <span className="text-muted"> · {o.relacao}</span> : null}
                </span>
                {podeEditar && (
                  <ConfirmarNaPagina aviso={`Tirar ${o.nome} da lista?`} confirmar="Tirar" size="sm" onConfirmar={() => iniciar(async () => { const r = await removerOcupante(contratoId, o.id); if (!r.ok) setErro(r.erro); else { setOcupantes((l) => l.filter((x) => x.id !== o.id)); router.refresh(); } })} testid="ocupante-remover">
                    Tirar
                  </ConfirmarNaPagina>
                )}
              </li>
            ))}
          </ul>
        )}
        {ocupantes.length > 0 && (
          <div className="mt-3">
            <ListaPortaria contratoId={contratoId} />
          </div>
        )}
      </Panel>

      {podeEditar ? (
        cabe ? (
          <Panel title="Adicionar ocupante" data-testid="ocupante-form">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold text-ink">
                Nome completo
                <input className={campo} maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} data-testid="ocupante-nome" />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-ink">
                Documento (CPF, RG ou passaporte)
                <input className={campo} maxLength={30} value={documento} onChange={(e) => setDocumento(e.target.value)} data-testid="ocupante-documento" />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-ink sm:col-span-2">
                Parentesco ou relação (opcional)
                <input className={campo} maxLength={60} value={relacao} onChange={(e) => setRelacao(e.target.value)} data-testid="ocupante-relacao" />
              </label>
            </div>
            <Button className="mt-3" variant="primary" size="sm" disabled={pendente || nome.trim().length < 2 || documento.trim().length < 5} onClick={salvar} data-testid="ocupante-salvar">
              Salvar ocupante
            </Button>
          </Panel>
        ) : (
          <p className="text-sm text-muted" data-testid="ocupantes-teto">{textoTetoOcupantes(previstos)}</p>
        )
      ) : (
        motivoBloqueio && <p className="text-sm text-muted" data-testid="ocupantes-bloqueio">{motivoBloqueio}</p>
      )}
      {erro && (
        <p role="alert" className="text-sm font-semibold text-red-700" data-testid="estadia-erro">
          {erro}
        </p>
      )}
    </>
  );
}
