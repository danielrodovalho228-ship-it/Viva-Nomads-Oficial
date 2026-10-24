"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Clock, Eye, KeyRound, Briefcase, Mail, ShieldCheck, Smartphone, UserCheck } from "lucide-react";
import { Panel } from "@/components/dashboard/primitives";
import { useViewMode } from "@/lib/roles";
import { useProperties } from "@/lib/use-properties";
import { useDisplayUser } from "@/lib/demo/demo-mode";
import { createClient } from "@/lib/supabase/client";
import { desconectarLinkedin, meuLinkedin, type MeuLinkedin } from "@/lib/linkedin/actions";
import { MSG_FALHA, MSG_JA_CONECTADO, MSG_LIMITE, MSG_NOME_DIVERGENTE } from "@/lib/linkedin/regras";
import { getTelefoneEstado } from "@/lib/data/telefone-actions";
import { CategoriaProfissional } from "./categoria-profissional";
import { cn } from "@/lib/utils";
import { useEstadoIdentidade } from "@/lib/identidade/use-estado-identidade";

/**
 * Conta em 4 blocos (prompt 18): 1. Perfil público · 2. Dados da conta · 3. Confiança e segurança · 4. Preferências.
 * Cada assunto aparece UMA vez; o que já tem tela própria (senha e duas etapas) vira uma linha com link.
 */
export function BlocoConta({ id, titulo, subtitulo, semTitulo, children }: { id: string; titulo: string; subtitulo: string; semTitulo?: boolean; children: React.ReactNode }) {
  // CONTA-A: sem números nos títulos. `semTitulo`: o conteúdo já traz o próprio título (ex.: "Papéis e intenção"), e o
  // bloco não repete — o nome fica só para o leitor de tela.
  return (
    <section id={id} className="mt-12 scroll-mt-24 first:mt-6" data-testid={`bloco-${id}`} aria-labelledby={`${id}-titulo`}>
      <div className={semTitulo ? "sr-only" : "border-b border-sage-200 pb-2"}>
        <h2 id={`${id}-titulo`} className="font-title text-xl font-semibold text-ink">
          {titulo}
        </h2>
        <p className="text-sm text-muted">{subtitulo}</p>
      </div>
      {children}
    </section>
  );
}

/** Inquilino: profissão (sinal que o proprietário vê no cartão do candidato). */
export function PerfilProfissional() {
  const { mode } = useViewMode();
  if (mode !== "tenant") return null;
  return (
    <Panel title="Profissão" className="mt-6">
      <p className="text-sm text-muted">Ajuda o proprietário a conhecer você. Complementa a verificação de identidade, não a substitui.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <CategoriaProfissional />
      </div>
    </Panel>
  );
}

/**
 * A página pública do proprietário só existe para quem já anunciou (sem imóvel, dá 404). Por isso o link
 * só aparece com ao menos um imóvel; antes disso, nada de link quebrado.
 */
function LinkPerfilPublico({ id }: { id: string }) {
  const { properties } = useProperties("/api/properties/mine");
  if (properties.length === 0) return null;
  return (
    <Link
      href={`/proprietario/${id}`}
      target="_blank"
      className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-forest underline underline-offset-2"
      data-testid="ver-como-outros-veem"
    >
      <Eye className="h-4 w-4" aria-hidden /> Ver como os outros veem
    </Link>
  );
}

/** "Ver como os outros veem": proprietário abre a página pública; inquilino vê o cartão de candidato. */
export function VerComoOutrosVeem() {
  const user = useDisplayUser();
  const { mode } = useViewMode();
  const [aberto, setAberto] = useState(false);
  if (!user) return null;
  if (mode !== "tenant") return <LinkPerfilPublico id={user.id} />;
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="inline-flex items-center gap-2 text-sm font-medium text-forest underline underline-offset-2"
        data-testid="ver-como-outros-veem"
      >
        <Eye className="h-4 w-4" aria-hidden /> Ver como os outros veem
      </button>
      {aberto && (
        <div className="mt-3 rounded-xl border border-sage-200 bg-surface-2 p-4 text-sm text-ink" data-testid="previa-candidato">
          <p>
            <strong>Antes do aceite</strong>, o proprietário vê &quot;Candidato(a)&quot;, sem nome nem foto: só a sua profissão, o motivo da
            estadia e os selos de confiança.
          </p>
          <p className="mt-2">
            <strong>Depois do aceite</strong>, ele vê o seu primeiro nome, a inicial do sobrenome e a foto. Telefone e e-mail nunca aparecem.
          </p>
        </div>
      )}
    </div>
  );
}

type Situacao = "ok" | "falta" | "em_breve";
interface ItemConfianca {
  chave: string;
  icone: React.ComponentType<{ className?: string }>;
  rotulo: string;
  situacao: Situacao;
  detalhe: string;
  acao?: { texto: string; href: string; externo?: boolean };
  /** Ação que roda aqui mesmo (ex.: Desconectar o LinkedIn). */
  botao?: { texto: string; onClick: () => void; ocupado?: boolean };
}

/** 63-B: a volta do LinkedIn chega com ?linkedin=<resultado>; a frase certa aparece na lista. */
const AVISO_LINKEDIN: Record<string, { texto: string; ok: boolean }> = {
  conectado: { texto: "LinkedIn conectado. O selo já aparece para quem você conversa.", ok: true },
  nome: { texto: MSG_NOME_DIVERGENTE, ok: false },
  outra: { texto: MSG_JA_CONECTADO, ok: false },
  limite: { texto: MSG_LIMITE, ok: false },
  falha: { texto: MSG_FALHA, ok: false },
  cancelado: { texto: "Você cancelou a conexão com o LinkedIn. Nada foi gravado.", ok: false },
  indisponivel: { texto: "Conectar o LinkedIn não está disponível agora.", ok: false },
};
const assinarBusca = (avisar: () => void) => {
  window.addEventListener("popstate", avisar);
  return () => window.removeEventListener("popstate", avisar);
};

/**
 * Lista ÚNICA de confiança e segurança (prompt 18): e-mail, celular, identidade, LinkedIn, duas etapas e senha —
 * cada item uma vez. O item "Verificação" do menu aponta para cá (#confianca).
 */
export function ConfiancaLista() {
  const [emailOk, setEmailOk] = useState<boolean | null>(null);
  const [celular, setCelular] = useState<{ disponivel: boolean; verificado: boolean } | null>(null);
  // 63-B: o selo "LinkedIn conectado" (a URL do perfil saiu daqui: fica em Dados pessoais, só a Viva vê).
  const [linkedin, setLinkedin] = useState<MeuLinkedin | null>(null);
  const [desconectando, setDesconectando] = useState(false);
  const busca = useSyncExternalStore(assinarBusca, () => window.location.search, () => "");
  const avisoLinkedin = AVISO_LINKEDIN[new URLSearchParams(busca).get("linkedin") ?? ""] ?? null;
  const [duasEtapas, setDuasEtapas] = useState<boolean | null>(null);
  // C6: nenhum estado aparece antes de chegar — sem "Não verificado + Verificar" que vira "Em breve" um instante depois.
  const [pronto, setPronto] = useState(false);
  // Identidade: o estado ÚNICO (complemento do prompt 23) — nenhum texto próprio aqui.
  const identidade = useEstadoIdentidade().situacao?.identidade ?? null;

  useEffect(() => {
    let vivo = true;
    const sb = createClient();
    const leituras: Promise<unknown>[] = [];
    if (sb) {
      leituras.push(sb.auth.getUser().then(({ data }) => vivo && setEmailOk(Boolean(data.user?.email_confirmed_at))));
      leituras.push(
        sb.auth.mfa
          .listFactors()
          .then(({ data }) => vivo && setDuasEtapas(Boolean(data?.totp?.some((f) => f.status === "verified"))))
          .catch(() => {}),
      );
    }
    leituras.push(
      getTelefoneEstado()
        // Sem resposta, o celular fica como "Em breve" (o mesmo estado de quando o SMS não está disponível), nunca alternando.
        .then((e) => vivo && setCelular(e ? { disponivel: e.disponivel, verificado: e.verificado } : { disponivel: false, verificado: false }))
        .catch(() => vivo && setCelular({ disponivel: false, verificado: false })),
    );
    leituras.push(
      meuLinkedin()
        .then((l) => vivo && setLinkedin(l))
        .catch(() => {}),
    );
    void Promise.allSettled(leituras).then(() => vivo && setPronto(true));
    return () => {
      vivo = false;
    };
  }, []);

  const itens: ItemConfianca[] = [
    {
      chave: "email",
      icone: Mail,
      rotulo: "E-mail",
      situacao: emailOk ? "ok" : "falta",
      detalhe: emailOk ? "Confirmado" : "Confirme pelo link que enviamos",
    },
    {
      chave: "celular",
      icone: Smartphone,
      rotulo: "Celular",
      situacao: celular?.verificado ? "ok" : celular && !celular.disponivel ? "em_breve" : "falta",
      detalhe: celular?.verificado ? "Verificado por SMS" : celular && !celular.disponivel ? "Em breve" : "Não verificado (opcional)",
      acao: celular?.verificado || (celular && !celular.disponivel) ? undefined : { texto: "Verificar", href: "#celular" },
    },
    {
      chave: "identidade",
      icone: UserCheck,
      rotulo: "Identidade",
      situacao: !identidade ? "falta" : identidade.estado === "confirmada" ? "ok" : identidade.estado === "em_breve" ? "em_breve" : "falta",
      detalhe: identidade?.texto ?? "",
      // O texto do estado fica no detalhe; o botão é curto (o rótulo longo do estado estourava a 390 px).
      acao:
        identidade?.estado === "confirmada"
          ? undefined
          : identidade?.estado === "vencida"
            ? { texto: "Confirmar de novo", href: "/dashboard/verificacao" }
            : identidade?.estado === "simulavel"
              ? { texto: "Verificar", href: "/dashboard/verificacao" }
              : { texto: "Saber mais", href: "/dashboard/verificacao" },
    },
    // 63-B: só com a chave LINKEDIN_CONECTAR_ATIVO (e a configuração); nos três papéis.
    ...(linkedin?.ativo
      ? [
          {
            chave: "linkedin",
            icone: Briefcase,
            rotulo: "LinkedIn",
            situacao: (linkedin.conectado ? "ok" : "falta") as Situacao,
            detalhe: linkedin.conectado ? (linkedin.texto ?? "Conectado") : "Opcional",
            acao: linkedin.conectado ? undefined : { texto: "Conectar", href: "/api/conta/linkedin/conectar", externo: true },
            botao: linkedin.conectado
              ? {
                  texto: "Desconectar",
                  ocupado: desconectando,
                  onClick: () => {
                    setDesconectando(true);
                    void desconectarLinkedin()
                      .then((r) => r.ok && setLinkedin({ ...linkedin, conectado: false, texto: null }))
                      .finally(() => setDesconectando(false));
                  },
                }
              : undefined,
          },
        ]
      : []),
    {
      chave: "duas-etapas",
      icone: ShieldCheck,
      rotulo: "Verificação em duas etapas",
      situacao: duasEtapas ? "ok" : "falta",
      detalhe: duasEtapas ? "Ativa" : "Desativada",
      acao: { texto: duasEtapas ? "Gerenciar" : "Ativar", href: "/dashboard/conta/seguranca" },
    },
    {
      chave: "senha",
      icone: KeyRound,
      rotulo: "Senha",
      situacao: "ok",
      detalhe: "Troque quando quiser",
      acao: { texto: "Alterar senha", href: "/dashboard/conta/seguranca" },
    },
  ];

  const carregando = (chave: string) => !pronto || (chave === "identidade" && !identidade);

  return (
    <Panel className="mt-6" data-testid="confianca-lista" aria-busy={!pronto}>
      {avisoLinkedin && linkedin?.ativo && (
        <p role="status" className={cn("mb-2 text-sm", avisoLinkedin.ok ? "text-forest" : "text-red-700")} data-testid="linkedin-aviso">
          {avisoLinkedin.texto}
        </p>
      )}
      <ul className="divide-y divide-sage-200">
        {itens.map((i) => (
          <li key={i.chave} className="flex min-h-[4.25rem] items-center gap-3 py-3" data-testid={`confianca-${i.chave}`} data-situacao={carregando(i.chave) ? "carregando" : i.situacao}>
            <i.icone className="h-5 w-5 shrink-0 text-sage" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{i.rotulo}</p>
              {carregando(i.chave) ? (
                <span className="mt-1 block h-3 w-28 rounded bg-surface-2" aria-hidden />
              ) : (
              <p className={cn("flex items-center gap-1 text-xs", i.situacao === "ok" ? "text-forest" : "text-muted")}>
                {i.situacao === "ok" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                ) : i.situacao === "em_breve" ? (
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Circle className="h-3.5 w-3.5" aria-hidden />
                )}
                {i.detalhe}
              </p>
              )}
            </div>
            {!carregando(i.chave) && i.acao &&
              (i.acao.externo ? (
                // Rota do servidor que redireciona para o LinkedIn: navegação de verdade, sem prefetch.
                <a href={i.acao.href} className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-forest underline underline-offset-2" data-testid={`confianca-${i.chave}-acao`}>
                  {i.acao.texto}
                </a>
              ) : (
                <Link href={i.acao.href} className="shrink-0 text-sm font-medium text-forest underline underline-offset-2">
                  {i.acao.texto}
                </Link>
              ))}
            {!carregando(i.chave) && i.botao && (
              <button
                type="button"
                onClick={i.botao.onClick}
                disabled={i.botao.ocupado}
                className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-forest underline underline-offset-2 disabled:opacity-60"
                data-testid={`confianca-${i.chave}-botao`}
              >
                {i.botao.texto}
              </button>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
