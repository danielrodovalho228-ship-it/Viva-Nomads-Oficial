import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import crypto from "node:crypto";
import { CheckCircle2, FlaskConical, XCircle } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { situacaoLimite, HORA } from "@/lib/limites";
import { CODIGO_RE } from "@/lib/fiscal/documento";
import { CONFERENCIA_PARTES, CONFERENCIA_VALIDADE, ROTULO_HASH_DO_ARQUIVO, aceitaArquivo, camposDoLaudo, camposExibidos, ehLaudoDeAvaliacao, hashExibido, normalizarCodigo, situacaoDoDocumento, type LaudoConferido, type LinhaConferida } from "@/lib/fiscal/conferir";
import { ROTULO_RESULTADO, type Resultado } from "@/lib/vistoria/laudo";
import { ROTULO_NIVEL_LAUDO, lerNivelDoLaudo } from "@/lib/vistoria/nivel-do-laudo";
import { emitidoEmBrasilia } from "@/lib/fiscal/prefixos";
import { ConferirArquivo } from "./conferir-arquivo";

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

async function consultar(codigo: string): Promise<{ estado: "ok" | "nao" | "limite" | "indisponivel"; doc: LinhaConferida | null; laudo: LaudoConferido | null }> {
  const admin = createAdminClient();
  if (!admin) return { estado: "indisponivel", doc: null, laudo: null };
  if ((await situacaoLimite(`conferir:${await ipHashAtual()}`, LIMITE_HORA, HORA)) === "estourou") return { estado: "limite", doc: null, laudo: null };
  if (!CODIGO_RE.test(codigo)) return { estado: "nao", doc: null, laudo: null };
  const { data } = await admin.rpc("conferir_documento", { p_codigo: codigo });
  const linha = (Array.isArray(data) ? data[0] : data) as LinhaConferida | null | undefined;
  if (!linha) return { estado: "nao", doc: null, laudo: null };
  return { estado: "ok", doc: linha, laudo: await laudoConferido(admin, linha) };
}

/**
 * E1121: o que o laudo de avaliação declara — o nível e o resultado — pelo número e pela versão que a conferência já
 * mostra. Só estas duas colunas saem daqui (nem dono, nem avaliador, nem imóvel). Se a leitura falhar, a página mostra
 * o resto: a conferência do documento não depende dela.
 */
async function laudoConferido(admin: NonNullable<ReturnType<typeof createAdminClient>>, doc: LinhaConferida): Promise<LaudoConferido | null> {
  if (!ehLaudoDeAvaliacao(doc.prefixo)) return null;
  const { data } = await admin.from("vistoria_laudos").select("resultado, nivel_sustentado").eq("numero", doc.numero).eq("versao", doc.versao).maybeSingle();
  if (!data) return null;
  const nivel = lerNivelDoLaudo(data.nivel_sustentado);
  return { nivel: nivel ? ROTULO_NIVEL_LAUDO[nivel] : null, resultado: ROTULO_RESULTADO[data.resultado as Resultado] ?? null };
}

/**
 * Conferência PÚBLICA de um documento da plataforma (Prompt 56, D3), só pelo código de verificação impresso nele:
 * status (válido, anulado com motivo, substituído pela versão N), tipo, número, versão e data. Nenhum valor, nome,
 * CPF, e-mail ou endereço (a função do banco nem devolve). O PDF, quando existe, é conferido no navegador.
 */
export default async function ConferirPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo: bruto } = await params;
  const codigo = normalizarCodigo(decodeURIComponent(bruto));
  const { estado, doc, laudo } = await consultar(codigo);
  const situacao = doc ? situacaoDoDocumento(doc) : null;
  const hash = doc ? hashExibido(doc) : null;

  return (
    <div className="container-page section-y">
      <div className="mx-auto max-w-lg rounded-xl border border-line bg-white p-6">
        <h1 className="font-title text-2xl font-semibold text-ink">Conferir documento</h1>
        {estado === "ok" && doc && situacao ? (
          <>
            {situacao.estado === "valido" ? (
              <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-forest" data-testid="conferir-ok">
                <CheckCircle2 className="h-5 w-5" /> {situacao.texto}
              </p>
            ) : situacao.estado === "teste" ? (
              <p className="mt-3 inline-flex items-start gap-2 text-sm font-semibold text-ink" data-testid="conferir-teste">
                <FlaskConical className="mt-1 h-5 w-5 shrink-0" /> {situacao.texto}
              </p>
            ) : situacao.estado === "anulado" ? (
              <p className="mt-3 inline-flex items-start gap-2 text-sm font-semibold text-red-700" data-testid="conferir-anulado">
                <XCircle className="mt-1 h-5 w-5 shrink-0" /> {situacao.texto}
              </p>
            ) : (
              <p className="mt-3 inline-flex items-start gap-2 text-sm font-semibold text-red-700" data-testid="conferir-substituido">
                <XCircle className="mt-1 h-5 w-5 shrink-0" /> {situacao.texto}
              </p>
            )}
            <dl className="mt-4 space-y-2 text-sm">
              {[...camposExibidos(doc, emitidoEmBrasilia), ...camposDoLaudo(laudo)].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-line pb-2">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-medium text-ink" data-testid={`conferir-${k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "-")}`}>
                    {v}
                  </dd>
                </div>
              ))}
              {/* E1121: o hash do laudo, por extenso (64 letras e números): em linha própria, quebrando no celular. */}
              {hash && (
                <div className="border-b border-line pb-2">
                  <dt className="text-muted">{ROTULO_HASH_DO_ARQUIVO}</dt>
                  <dd className="mt-1 break-all font-mono text-xs font-medium text-ink" data-testid="conferir-hash">
                    {hash}
                  </dd>
                </div>
              )}
            </dl>
            {doc.hash_sha256 && aceitaArquivo(doc.prefixo) && <ConferirArquivo hash={doc.hash_sha256} />}
            {/* E887: as partes (por que não aparecem) e a validade real do documento, da mesma fonte da página /conferir. */}
            <p className="mt-4 text-xs text-muted">
              {CONFERENCIA_PARTES} A Viva Nomads não recebe o valor mensal nem a Caução.
            </p>
            <p className="mt-2 text-xs text-muted" data-testid="conferir-validade">
              {CONFERENCIA_VALIDADE}
            </p>
          </>
        ) : (
          <p className="mt-3 inline-flex items-start gap-2 text-sm text-ink" data-testid="conferir-nao">
            <XCircle className="mt-1 h-5 w-5 shrink-0 text-red-600" />
            {estado === "limite"
              ? "Muitas conferências em pouco tempo. Tente de novo mais tarde."
              : estado === "indisponivel"
                ? "Conferência indisponível agora."
                : "Nenhum documento com este código. Confira se o código está completo: são 32 letras e números."}
          </p>
        )}
        <p className="mt-4 text-sm">
          <Link href="/conferir" className="font-semibold text-forest underline">
            Conferir outro documento
          </Link>
        </p>
      </div>
    </div>
  );
}
