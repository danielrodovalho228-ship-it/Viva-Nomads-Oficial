"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentoVinculo, type EstadoDocumentoTela } from "@/components/anuncio/documento-vinculo";
import type { InfoMatricula } from "@/components/anuncio/matricula-resultado";
import { OPERACOES, type Operacao } from "@/lib/anuncio/operacao";
import { MSG_FALHA_LEITURA_INICIO, leituraFalhou, perguntaQuemOpera } from "@/lib/documento/matricula-no-inicio";
import { cn } from "@/lib/utils";

/**
 * E149-A — "Tem a matrícula à mão? Comece por ela" (Passo 1, só no cadastro novo). Abre o MESMO documento do Passo 10
 * (DocumentoVinculo: envio, leitura e conferência), sem esperar o endereço — é a matrícula que vai preenchê-lo. Ao
 * terminar: o resumo do que foi preenchido e "Voltar ao tipo do imóvel". Se o titular do documento não é quem está
 * cadastrando, pergunta "Quem opera este imóvel?" ali mesmo. Nome e CPF do titular nunca aparecem aqui.
 */
export function MatriculaNoInicio(p: {
  imovelId: string | null;
  estado: EstadoDocumentoTela;
  motivos: string[];
  onResultado: (estado: EstadoDocumentoTela, motivos: string[]) => void;
  /** Aplica o que a matrícula trouxe no cadastro e devolve o resumo ("Preenchemos: endereço, área, vagas."). */
  onMatricula: (m: InfoMatricula) => string;
  operacao: Operacao;
  onOperacao: (o: Operacao) => void;
  onFechar: () => void;
}) {
  const [resumo, setResumo] = useState<string | null>(null);
  const [perguntar, setPerguntar] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const [respondida, setRespondida] = useState(false);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && p.onFechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [p]);

  const terminou = p.estado !== "nenhum";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="matricula-inicio-titulo" data-testid="matricula-inicio">
      <button type="button" className="absolute inset-0 bg-night/40" aria-label="Fechar" onClick={p.onFechar} tabIndex={-1} />
      <div className="relative max-h-full w-full max-w-xl overflow-y-auto rounded-t-xl bg-surface p-4 sm:rounded-xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id="matricula-inicio-titulo" className="font-title text-xl font-semibold text-ink">
            Comece pela matrícula
          </h2>
          <button type="button" onClick={p.onFechar} className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-sage-50" aria-label="Fechar" data-testid="matricula-inicio-fechar">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <p className="mt-1 text-sm text-muted">Lemos o documento e preenchemos o que ele traz. Tudo continua editável, e nada aqui é obrigatório.</p>

        <div className="mt-4">
          <DocumentoVinculo
            imovelId={p.imovelId}
            endereco={{ cep: "", rua: "", numero: "", bairro: "", cidade: "" }}
            operacao={p.operacao}
            estado={p.estado}
            motivos={p.motivos}
            onResultado={p.onResultado}
            enderecoOpcional
            onMatricula={(m) => {
              setResumo(p.onMatricula(m) || null);
              setPerguntar(perguntaQuemOpera(m.motivo));
              setFalhou(leituraFalhou(m.motivo));
            }}
          />
        </div>

        {falhou && (
          <p className="mt-3 text-sm text-ink" role="status" data-testid="matricula-inicio-falhou">
            {MSG_FALHA_LEITURA_INICIO}
          </p>
        )}
        {resumo && (
          <p className="mt-3 rounded-lg bg-sage-100 px-3 py-2 text-sm font-medium text-forest" role="status" data-testid="matricula-inicio-resumo">
            {resumo}
          </p>
        )}

        {perguntar && (
          <fieldset className="mt-4" data-testid="matricula-inicio-quem-opera">
            <legend className="text-sm font-medium text-ink">Quem opera este imóvel?</legend>
            <div className="mt-2 grid grid-cols-1 gap-2" role="radiogroup" aria-label="Quem opera este imóvel?">
              {OPERACOES.map(({ valor, rotulo }) => (
                <button
                  key={valor}
                  type="button"
                  role="radio"
                  aria-checked={respondida && p.operacao === valor}
                  onClick={() => {
                    p.onOperacao(valor);
                    setRespondida(true);
                  }}
                  data-testid={`matricula-inicio-opera-${valor}`}
                  className={cn(
                    "min-h-11 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors",
                    respondida && p.operacao === valor ? "border-forest bg-forest text-white" : "border-sage-200 text-ink hover:border-sage",
                  )}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {terminou && (
          <div className="mt-6 flex justify-end">
            <Button onClick={p.onFechar} data-testid="matricula-inicio-voltar">
              Voltar ao tipo do imóvel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
