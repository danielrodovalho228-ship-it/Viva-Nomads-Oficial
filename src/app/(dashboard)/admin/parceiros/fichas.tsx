"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Panel } from "@/components/dashboard/primitives";
import { SeloTeste } from "@/components/admin/selo-teste";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ConfirmarNaPagina } from "@/components/ui/confirmar-na-pagina";
import { checklistCompleto, ITENS_CHECKLIST, MOTIVOS_RECUSA_PARCERIA, rotuloCategoria, type ParceiroGeral } from "@/lib/parceiros/regras";
import { formatarDocumento } from "@/lib/documento-pessoa";
import { dataHoraBRT } from "@/lib/datas-brasilia";
import {
  algumSalvando,
  comecarSalvar,
  terminarSalvar,
  valorExibido,
  TEXTO_SALVANDO,
  TEXTO_SALVO,
  TEXTO_TENTAR_DE_NOVO,
  type EstadoItem,
  type EstadosChecklist,
} from "@/lib/parceiros/checklist-estado";
import {
  aprovarSolicitacao,
  criarSolicitacaoSuporte,
  definirParceiroGeral,
  recusarSolicitacao,
  reenviarAtivacao,
  salvarChecklistParceria,
  suspenderParceiro,
} from "@/lib/parceiros/admin-actions";

export interface Ficha {
  id: string;
  nome: string;
  email: string | null;
  tipoPessoa: string | null;
  documento: string | null;
  telefone: string | null;
  categorias: string[];
  cidades: string[];
  portfolioUrl: string | null;
  descricao: string | null;
  dadosCategoria: Record<string, string>;
  status: string;
  motivoRecusa: string | null;
  checklist: Record<string, unknown>;
  origem: string;
  criadoEm: string;
  tokenExpiraEm: string | null;
  novoLinkPedidoEm: string | null;
  /** O link de ativação já venceu (calculado no servidor). */
  linkVencido: boolean;
  identidade: { estado: string; texto: string } | null;
  teste: boolean;
}

const ORIGEM: Record<string, string> = { site: "Site", conta: "Conta", suporte: "Suporte" };
const CONSULTA = {
  pf: "https://servicos.receita.fazenda.gov.br/servicos/cpf/consultasituacao/consultapublica.asp",
  pj: "https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp",
};
const dataHora = (iso: string | null | undefined) => (iso ? dataHoraBRT(iso) : "—");

type Res = { ok: true; valor?: unknown } | { ok: false; erro: string };

function useAcao() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const rodar = (f: () => Promise<Res>, ok: string, depois?: (r: Res) => void) => {
    setMsg(null);
    iniciar(async () => {
      const r = await f().catch(() => ({ ok: false as const, erro: "Sem conexão. Tente de novo." }));
      setMsg(r.ok ? { ok: true, texto: ok } : { ok: false, texto: r.erro });
      depois?.(r);
      if (r.ok) router.refresh();
    });
  };
  const aviso = msg && (
    <p className={`mt-2 text-sm ${msg.ok ? "text-forest" : "text-red-700"}`} role={msg.ok ? "status" : "alert"} data-testid="admin-parceria-msg">
      {msg.texto}
    </p>
  );
  return { rodar, pendente, aviso };
}

export function FichaSolicitacao({ f }: { f: Ficha }) {
  const { rodar, pendente, aviso } = useAcao();
  const [check, setCheck] = useState<Record<string, unknown>>(f.checklist);
  const [motivo, setMotivo] = useState("");
  const completo = checklistCompleto(check);
  const aguardando = f.status === "aguardando_email";
  // Prompt 36, item 4: cada item mostra "Salvando…", "Salvo" ou o erro com "Tentar de novo".
  const router = useRouter();
  const [, iniciarRefresh] = useTransition();
  const [estados, setEstados] = useState<EstadosChecklist>({});
  const salvandoChecklist = algumSalvando(estados);
  const marcar = async (chave: string, valor: boolean) => {
    setEstados((e) => comecarSalvar(e, chave, valor));
    const r: Res = await salvarChecklistParceria(f.id, { [chave]: valor }).catch(() => ({ ok: false as const, erro: "Sem conexão. Tente de novo." }));
    setEstados((e) => terminarSalvar(e, chave, r));
    if (r.ok) {
      if (r.valor) setCheck(r.valor as Record<string, unknown>);
      iniciarRefresh(() => router.refresh());
    }
  };
  const marcado = (chave: string) => valorExibido(estados, chave, check[chave] === true);

  return (
    <Panel data-testid="ficha-parceria" data-email={f.email ?? ""}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-title text-lg font-bold text-ink">
            {f.nome} {f.teste && <SeloTeste />}
          </h3>
          <p className="text-sm text-muted break-all">
            {f.email ?? "sem e-mail"} · origem {ORIGEM[f.origem] ?? f.origem} · {dataHora(f.criadoEm)}
          </p>
        </div>
        {aguardando && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Aguardando a pessoa confirmar</span>}
      </div>

      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">Categorias</dt>
          <dd className="text-ink">{f.categorias.map(rotuloCategoria).join(", ") || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Cidades</dt>
          <dd className="text-ink">{f.cidades.join(", ") || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">{f.tipoPessoa === "pj" ? "CNPJ" : "CPF"}</dt>
          <dd className="font-mono text-ink" data-testid="ficha-documento">
            {f.documento ? formatarDocumento(f.documento) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Telefone (só equipe)</dt>
          <dd className="text-ink">{f.telefone ?? "—"}</dd>
        </div>
        {f.portfolioUrl && (
          <div>
            <dt className="text-muted">Portfólio</dt>
            <dd>
              <a href={f.portfolioUrl} target="_blank" rel="noopener nofollow noreferrer" className="inline-flex items-center gap-1 break-all text-blue-700 underline">
                {f.portfolioUrl} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </dd>
          </div>
        )}
        {(f.dadosCategoria.empresa || f.dadosCategoria.veiculo) && (
          <div>
            <dt className="text-muted">Mudança</dt>
            <dd className="text-ink">
              {f.dadosCategoria.empresa} · {f.dadosCategoria.veiculo}
            </dd>
          </div>
        )}
        {f.descricao && (
          <div className="sm:col-span-2">
            <dt className="text-muted">Descrição</dt>
            <dd className="whitespace-pre-line text-ink">{f.descricao}</dd>
          </div>
        )}
      </dl>

      {!aguardando && (
        <fieldset disabled={pendente || salvandoChecklist} className="mt-4 rounded-xl border border-line p-3" data-testid="ficha-checklist">
          <legend className="px-1 text-sm font-semibold text-ink">Checklist</legend>
          <p className="mb-2 text-sm text-ink" data-testid="ficha-identidade">
            Identidade: <strong>{f.identidade?.texto ?? "Sem conta ligada"}</strong>
            {f.identidade?.estado !== "confirmada" && " — sem CAF válida, registre a conferência manual."}
          </p>
          <ul className="space-y-2">
            {ITENS_CHECKLIST.map((i) => (
              <li key={i.chave}>
                <label className="flex items-start gap-2 text-sm text-ink">
                  <input type="checkbox" className="mt-1" checked={marcado(i.chave)} onChange={(e) => void marcar(i.chave, e.target.checked)} data-testid={`check-${i.chave}`} />
                  <span>
                    {i.rotulo}
                    {i.chave === "documento" && (
                      <>
                        {" "}
                        <a href={CONSULTA[f.tipoPessoa === "pj" ? "pj" : "pf"]} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 underline">
                          Abrir consulta
                        </a>
                        {typeof check.documento_conferido_em === "string" && <span className="text-muted"> · conferido em {dataHora(check.documento_conferido_em)}</span>}
                      </>
                    )}
                  </span>
                </label>
                <EstadoDoItem chave={i.chave} estado={estados[i.chave]} aoTentar={(v) => void marcar(i.chave, v)} />
              </li>
            ))}
            {f.identidade?.estado !== "confirmada" && (
              <li>
                <label className="flex items-start gap-2 text-sm text-ink">
                  <input type="checkbox" className="mt-1" checked={marcado("identidade_manual")} onChange={(e) => void marcar("identidade_manual", e.target.checked)} data-testid="check-identidade_manual" />
                  <span>Conferência manual da identidade feita (documento com foto)</span>
                </label>
                <EstadoDoItem chave="identidade_manual" estado={estados.identidade_manual} aoTentar={(v) => void marcar("identidade_manual", v)} />
              </li>
            )}
          </ul>
        </fieldset>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
        {!aguardando && (
          <ConfirmarNaPagina
            aviso="Aprovar a parceria? A pessoa recebe o e-mail com o link de ativação (7 dias, uso único)."
            confirmar="Aprovar"
            onConfirmar={() => rodar(() => aprovarSolicitacao(f.id), "Aprovada. O e-mail de ativação foi enviado.")}
            disabled={pendente || !completo}
            variant="primary"
            testid="ficha-aprovar"
          >
            Aprovar
          </ConfirmarNaPagina>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <label htmlFor={`motivo-${f.id}`} className="block text-sm font-medium text-ink">Motivo da recusa (obrigatório)</label>
          <select aria-label="Modelos de motivo" className="w-full rounded-lg border border-sage-200 bg-white px-3 py-2 text-sm" value="" onChange={(e) => e.target.value && setMotivo(e.target.value)} data-testid="ficha-modelo-recusa">
            <option value="">Escolher um modelo…</option>
            {MOTIVOS_RECUSA_PARCERIA.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <textarea id={`motivo-${f.id}`} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full rounded-lg border border-sage-200 px-3 py-2 text-sm" data-testid="ficha-motivo" />
          <ConfirmarNaPagina
            aviso="Recusar o pedido? A pessoa recebe o motivo por e-mail e continua com a conta normal."
            confirmar="Recusar"
            onConfirmar={() => rodar(() => recusarSolicitacao(f.id, motivo), "Pedido recusado. O e-mail foi enviado.")}
            disabled={pendente || motivo.trim().length < 10}
            variant="secondary"
            testid="ficha-recusar"
          >
            Recusar
          </ConfirmarNaPagina>
        </div>
      </div>
      {!completo && !aguardando && <p className="mt-2 text-xs text-muted">Aprovar fica disponível com o checklist completo.</p>}
      {aviso}
    </Panel>
  );
}

export function LinhaAprovada({ f }: { f: Ficha }) {
  const { rodar, pendente, aviso } = useAcao();
  const vencido = f.linkVencido;
  return (
    <li className="py-3" data-testid="linha-aprovada" data-email={f.email ?? ""}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 text-sm">
          <p className="font-semibold text-ink">
            {f.nome} {f.teste && <SeloTeste />}
          </p>
          <p className="text-muted">
            {f.categorias.map(rotuloCategoria).join(", ")} · link {vencido ? "vencido" : `vale até ${dataHora(f.tokenExpiraEm)}`}
            {f.novoLinkPedidoEm && <span className="font-semibold text-amber-800"> · pediu novo link em {dataHora(f.novoLinkPedidoEm)}</span>}
          </p>
        </div>
        <ConfirmarNaPagina aviso="Mandar um novo link? O link anterior deixa de valer." confirmar="Reenviar" onConfirmar={() => rodar(() => reenviarAtivacao(f.id), "Novo link enviado.")} disabled={pendente} size="sm" testid="reenviar-ativacao">
          Reenviar ativação
        </ConfirmarNaPagina>
      </div>
      {aviso}
    </li>
  );
}

export function LinhaAtiva({ p }: { p: { id: string; slug: string; nome: string; categorias: string[]; cidades: string[]; status: string; teste: boolean; identidade: string | null } }) {
  const { rodar, pendente, aviso } = useAcao();
  const [motivo, setMotivo] = useState("");
  return (
    <li className="py-3" data-testid="linha-ativa" data-slug={p.slug}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="min-w-0">
          <a href={`/parceiros/${p.slug}`} className="font-semibold text-ink underline-offset-2 hover:underline">
            {p.nome}
          </a>{" "}
          {p.teste && <SeloTeste />}
          <p className="text-muted">
            {p.categorias.join(", ")} · {p.cidades.join(", ")} · {p.status}
            {p.teste && " · fora da busca pública (conta de teste)"}
          </p>
          {p.identidade && <p className="text-xs text-muted">Identidade: {p.identidade}</p>}
        </div>
        {p.status !== "suspenso" && (
          <div className="flex flex-wrap items-center gap-2">
            <input aria-label="Motivo da suspensão" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo" className="h-10 rounded-lg border border-sage-200 px-3 text-sm" />
            <ConfirmarNaPagina aviso="Suspender o parceiro? A página sai do ar e da busca." confirmar="Suspender" onConfirmar={() => rodar(() => suspenderParceiro(p.id, motivo), "Parceiro suspenso.")} disabled={pendente || motivo.trim().length < 5} size="sm" variant="secondary">
              Suspender parceiro
            </ConfirmarNaPagina>
          </div>
        )}
      </div>
      {aviso}
    </li>
  );
}

export function SuporteForm() {
  const { rodar, pendente, aviso } = useAcao();
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">A pessoa recebe um convite por e-mail, entra com esta conta, completa os dados e confirma o envio.</p>
      <input aria-label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" className="w-full rounded-lg border border-sage-200 px-3 py-2 text-base" />
      <input aria-label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" className="w-full rounded-lg border border-sage-200 px-3 py-2 text-base" />
      <Button size="sm" disabled={pendente} onClick={() => rodar(() => criarSolicitacaoSuporte({ email, nome }), "Convite enviado.", (r) => r.ok && (setEmail(""), setNome("")))}>
        Abrir pedido e enviar convite
      </Button>
      {aviso}
    </div>
  );
}

export function ParceiroGeralForm({ inicial }: { inicial: ParceiroGeral }) {
  const { rodar, pendente, aviso } = useAcao();
  const [g, setG] = useState(inicial);
  return (
    <div className="space-y-2" data-testid="parceiro-geral-admin">
      <p className="text-sm text-muted">Aparece só quando a busca não acha ninguém. Sem logo de terceiros. Desligado por padrão.</p>
      <input aria-label="Nome" value={g.nome} onChange={(e) => setG({ ...g, nome: e.target.value })} placeholder="Nome do parceiro geral" className="w-full rounded-lg border border-sage-200 px-3 py-2 text-base" />
      <input aria-label="Cidade" value={g.cidade} onChange={(e) => setG({ ...g, cidade: e.target.value })} placeholder="Cidade" className="w-full rounded-lg border border-sage-200 px-3 py-2 text-base" />
      <textarea aria-label="Descrição" rows={2} value={g.descricao} onChange={(e) => setG({ ...g, descricao: e.target.value })} placeholder="Descrição" className="w-full rounded-lg border border-sage-200 px-3 py-2 text-base" />
      <label className="flex items-center gap-3 text-sm text-ink">
        <Switch checked={g.ligado} onChange={(v) => setG({ ...g, ligado: v })} label="Mostrar o cartão na busca vazia" />
        Mostrar o cartão na busca vazia
      </label>
      <Button size="sm" variant="secondary" disabled={pendente} onClick={() => rodar(() => definirParceiroGeral({ ligada: g.ligado, nome: g.nome, cidade: g.cidade, descricao: g.descricao }), "Salvo.")} data-testid="parceiro-geral-salvar">
        Salvar cartão
      </Button>
      {aviso}
    </div>
  );
}

/** Prompt 36, item 4: "Salvando…" (com indicador), "Salvo" ou o erro com "Tentar de novo", ao lado do item. */
function EstadoDoItem({ chave, estado, aoTentar }: { chave: string; estado: EstadoItem | undefined; aoTentar: (valor: boolean) => void }) {
  if (!estado) return null;
  if (estado.fase === "salvando")
    return (
      <span className="ml-6 inline-flex items-center gap-1.5 text-xs text-muted" role="status" data-testid={`check-estado-${chave}`} data-fase="salvando">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-sage-300 border-t-forest" aria-hidden />
        {TEXTO_SALVANDO}
      </span>
    );
  if (estado.fase === "salvo")
    return (
      <span className="ml-6 text-xs font-medium text-forest" role="status" data-testid={`check-estado-${chave}`} data-fase="salvo">
        {TEXTO_SALVO}
      </span>
    );
  return (
    <span className="ml-6 inline-flex flex-wrap items-center gap-2 text-xs text-red-700" role="alert" data-testid={`check-estado-${chave}`} data-fase="erro">
      {estado.erro}
      <button type="button" className="font-semibold underline" onClick={() => aoTentar(estado.valor)} data-testid={`check-tentar-${chave}`}>
        {TEXTO_TENTAR_DE_NOVO}
      </button>
    </span>
  );
}
