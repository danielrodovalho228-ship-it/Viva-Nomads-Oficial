import type { Metadata } from "next";
import { headers } from "next/headers";
import crypto from "node:crypto";
import { CheckCircle2, XCircle } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { situacaoLimite, HORA } from "@/lib/limites";
import { CODIGO_RE, ROTULO_TIPO, brl, dataBR, type TipoDocumento } from "@/lib/fiscal/documento";

export const metadata: Metadata = {
  title: "Conferir documento",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/** Até 20 conferências por IP por hora (o código tem 128 bits, mas não damos chute de graça). */
const LIMITE_HORA = 20;

async function ipHashAtual(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim() || "desconhecido";
  return crypto.createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "viva-nomads").update(`ip:${ip}`).digest("hex").slice(0, 32);
}

interface Conferido {
  numero: string;
  tipo: string;
  valor: number;
  emitido_em: string;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  locador: string;
  locatario: string;
}

async function consultar(codigo: string): Promise<{ estado: "ok" | "nao" | "limite" | "indisponivel"; doc: Conferido | null }> {
  const admin = createAdminClient();
  if (!admin) return { estado: "indisponivel", doc: null };
  if ((await situacaoLimite(`conferir:${await ipHashAtual()}`, LIMITE_HORA, HORA)) === "estourou") return { estado: "limite", doc: null };
  if (!CODIGO_RE.test(codigo)) return { estado: "nao", doc: null };
  const { data } = await admin.rpc("conferir_documento", { p_codigo: codigo });
  const linha = (Array.isArray(data) ? data[0] : data) as Conferido | null | undefined;
  return linha ? { estado: "ok", doc: linha } : { estado: "nao", doc: null };
}

/**
 * Conferência PÚBLICA de um documento gerado pela plataforma: mostra só número,
 * tipo, data, valor, período e as INICIAIS das partes. Sem CPF, e-mail,
 * telefone ou endereço (a função do banco nem devolve esses campos).
 */
export default async function ConferirPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const { estado, doc } = await consultar(codigo);

  return (
    <main className="container-page section-y">
      <div className="mx-auto max-w-lg rounded-2xl border border-line bg-white p-6">
        <h1 className="font-title text-2xl font-bold text-ink">Conferir documento</h1>
        {estado === "ok" && doc ? (
          <>
            <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-forest" data-testid="conferir-ok">
              <CheckCircle2 className="h-5 w-5" /> Documento autêntico, gerado pela plataforma Viva Nomads.
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              {[
                ["Documento", ROTULO_TIPO[doc.tipo as TipoDocumento] ?? doc.tipo],
                ["Número", doc.numero],
                ["Emitido em", dataBR(doc.emitido_em)],
                ["Valor", brl(Number(doc.valor))],
                ...(doc.periodo_inicio ? [["Período", `${dataBR(doc.periodo_inicio)} a ${dataBR(doc.periodo_fim)}`]] : []),
                ["Locador", doc.locador],
                ["Locatário", doc.locatario],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-line pb-2">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-muted">Por privacidade, mostramos só as iniciais das partes. Não é nota fiscal: a Viva Nomads não recebe aluguel nem caução.</p>
          </>
        ) : (
          <p className="mt-3 inline-flex items-start gap-2 text-sm text-ink" data-testid="conferir-nao">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            {estado === "limite"
              ? "Muitas conferências em pouco tempo. Tente de novo mais tarde."
              : estado === "indisponivel"
                ? "Conferência indisponível agora."
                : "Nenhum documento com este código. Confira se o link está completo."}
          </p>
        )}
      </div>
    </main>
  );
}
