import { Sparkles } from "lucide-react";
import { resumoIaCadastro } from "@/lib/ai/registro-ia";
import { MENSAGEM_FALHA_IA } from "@/lib/ai/falha-ia";
import { cn } from "@/lib/utils";

const ROTA: Record<string, string> = { fotos: "fotos", documento: "documento", matricula: "matrícula" };
const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * "IA do cadastro: ligada/desligada" (prompt 22): o que falta ligar (nome da variável, nunca o valor), a última
 * chamada que deu certo e o último erro (status, tipo e motivo), das últimas linhas de ia_chamadas (0163). Sem dado
 * pessoal: a tabela não guarda pessoa, nome, CPF, endereço nem conteúdo.
 */
export async function PainelIaCadastro() {
  const r = await resumoIaCadastro().catch(() => null);
  if (!r) return null;
  const ligadaFotos = r.ligada.fotos;
  return (
    <section className="rounded-2xl border border-sage-200 bg-white p-5" data-testid="painel-ia-cadastro" data-ligada={ligadaFotos ? "1" : "0"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-title text-lg font-bold text-ink">
          <Sparkles className="h-5 w-5 text-forest" aria-hidden /> IA do cadastro
        </h2>
        <span
          className={cn("rounded-full px-3 py-1 text-xs font-semibold", ligadaFotos ? "bg-green-50 text-green-900" : "bg-red-50 text-red-800")}
          data-testid="painel-ia-estado"
        >
          {ligadaFotos ? "Ligada" : "Desligada"}
        </span>
      </div>
      <ul className="mt-3 space-y-1 text-sm text-ink">
        <li>
          Fotos (sugestões do cadastro): <strong>{ligadaFotos ? "ligada" : "desligada"}</strong>
          {!ligadaFotos && r.faltam.length > 0 && <span className="text-muted"> — falta na Vercel: {r.faltam.join(" e ")}</span>}
        </li>
        <li>
          Leitura de documento e matrícula: <strong>{r.ligada.documento ? "ligada" : "desligada"}</strong>
        </li>
        <li data-testid="painel-ia-ultima-ok">
          Última chamada OK: {r.ultimaOk ? `${quando(r.ultimaOk.em)} (${ROTA[r.ultimaOk.rota] ?? r.ultimaOk.rota})` : "nenhuma registrada"}
        </li>
        <li data-testid="painel-ia-ultimo-erro">
          Último erro:{" "}
          {r.ultimoErro ? (
            <>
              {quando(r.ultimoErro.em)} ({ROTA[r.ultimoErro.rota] ?? r.ultimoErro.rota}) · {r.ultimoErro.status ?? "sem resposta"} ·{" "}
              {r.ultimoErro.tipo ?? "—"}
              {r.ultimoErro.motivo && <span className="text-muted"> — a pessoa viu: “{MENSAGEM_FALHA_IA[r.ultimoErro.motivo]}”</span>}
            </>
          ) : (
            "nenhum registrado"
          )}
        </li>
        <li className="text-muted">
          {r.dia ? `Últimas 24 h: ${r.dia.total} chamada${r.dia.total === 1 ? "" : "s"}, ${r.dia.falhas} com falha.` : "Registro ainda não disponível (migração 0163 pendente)."}
        </li>
      </ul>
    </section>
  );
}
