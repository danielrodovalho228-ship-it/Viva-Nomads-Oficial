"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, CheckCircle2, CircleDashed, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Panel } from "@/components/dashboard/primitives";
import { SOMBRA_SO_CELULAR, SOMBRA_SO_COMPUTADOR } from "@/lib/conta/visual-mockup";
import { cn } from "@/lib/utils";
import { BlocoOpcional } from "@/components/ui/bloco-opcional";
import { EspelhoPorPapel } from "@/components/account/espelho-papel";
import { PetsFicha } from "@/components/account/pets-ficha";
import { CategoriaProfissional } from "@/components/account/categoria-profissional";
import { PorQueNaCidade } from "@/components/account/por-que-na-cidade";
import { TituloSecaoLateral } from "@/components/account/casca-conta";
import { EnviarFoto, FOTO_ATUALIZADA, PERFIL_ATUALIZADO, avisarFotoAtualizada, useMinhaFoto } from "@/components/account/foto-perfil";
import { getMeuPerfilPublico, getMeusDados, salvarMeuPerfilPublico, salvarMeusDados, setMinhaCategoria, type MeuPerfilPublico } from "@/lib/data/perfil-actions";
import { clearMyAvatar } from "@/lib/data/avatar-actions";
import { AvisoFotoRemovida } from "@/components/account/aviso-foto-removida";
import { BIO_MAX, ESTADO_SALVAR, IDIOMAS, LINHA_PERFIL_COMPLETO, destinoDaFalta, medidorPerfil, rotuloCurto, progressoPerfil, validarBio } from "@/lib/perfil/perfil-publico";
import { textosToggle, toggleInicial } from "@/lib/ui/bloco-opcional";
import { CATEGORIA_NAO_INFORMAR } from "@/config/categorias-profissionais";
import { useAuthStore } from "@/lib/store";
import { useViewMode } from "@/lib/roles";

export const SUBTITULO_PERFIL = "Gerencie suas informações pessoais e como os proprietários veem seu perfil.";
const CAMPO = "w-full rounded-lg border border-line bg-white px-4 py-3 text-base text-ink outline-none focus:border-forest";

/**
 * A1 — a tela Perfil da Conta (mockup perfil-01-topo-espelho, aprovado em 23/10):
 * cartão "Foto do perfil" (foto, Trocar foto) com Nome completo, Sobre você e Cidade e o "Salvar alterações"; à direita
 * no computador, o título e O ESPELHO; embaixo, os blocos opcionais no padrão toggle (Meus pets, Perfil profissional,
 * Idiomas) e o medidor "Complete seu perfil" (C1). No celular: título no topo, foto grande, cartão, espelho, blocos, o
 * medidor e o "Salvar alterações" logo depois do conteúdo (E61).
 */
export function PerfilTela() {
  const foto = useMinhaFoto();
  const { mode } = useViewMode();
  // E192 (reteste 26/10): o painel do morador (Perfil profissional + "Por que estou na cidade") vale para quem tem
  // cadastro de morador, EM QUALQUER MODO. Antes ele só existia no modo morador: a conta morador que também anuncia
  // (modo proprietário salvo) nunca via o cartão do #1413. O dono só LÊ esses campos depois do aceite (#1407).
  const cadastroMorador = useAuthStore((s) => s.user?.role === "tenant");
  const mostraPainelMorador = mode === "tenant" || cadastroMorador;
  // E55: o espelho segue o papel em uso (a mesma fonte da barra: o modo da conta).
  const papelEspelho = mode === "owner" ? "proprietario" : "morador";
  const [p, setP] = useState<MeuPerfilPublico | null | undefined>(undefined);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [bio, setBio] = useState("");
  const [cidade, setCidade] = useState("");
  const [idiomas, setIdiomas] = useState<string[]>([]);
  const [idiomasLigado, setIdiomasLigado] = useState(false);
  const [profLigado, setProfLigado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  // Extra do E62: o retrato do que está gravado, para o botão mostrar "há alterações" × "tudo salvo".
  const [salvo, setSalvo] = useState<string | null>(null);
  // O aviso "Alterações salvas." fica junto do botão que a pessoa tocou: no cartão (computador) ou no fim (celular).
  const [largo, setLargo] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    const ver = () => setLargo(m.matches);
    ver();
    m.addEventListener("change", ver);
    return () => m.removeEventListener("change", ver);
  }, []);

  useEffect(() => {
    let vivo = true;
    Promise.all([getMeuPerfilPublico(), getMeusDados()])
      .then(([d, dados]) => {
        if (!vivo) return;
        setP(d);
        if (d) {
          setBio(d.bio);
          setCidade(d.cidade);
          setIdiomas(d.idiomas);
          setIdiomasLigado(toggleInicial(d.idiomas.length > 0));
          setProfLigado(toggleInicial(!!d.profissao && d.profissao !== CATEGORIA_NAO_INFORMAR));
        }
        setNome(dados?.fullName ?? d?.nome ?? "");
        setTelefone(dados?.phone ?? "");
        setSalvo(retrato(dados?.fullName ?? d?.nome ?? "", d?.bio ?? "", d?.cidade ?? "", d && d.idiomas.length > 0 ? d.idiomas : []));
      })
      .catch(() => vivo && setP(null));
    // O medidor e o espelho andam: foto nova, profissão ou documento salvos em outra tela releem na hora.
    const reler = () =>
      getMeuPerfilPublico()
        .then((d) => vivo && d && setP((a) => (a ? { ...a, temFoto: d.temFoto, telefone: d.telefone, profissao: d.profissao, cadastro: d.cadastro, emailConfirmado: d.emailConfirmado } : d)))
        .catch(() => {});
    window.addEventListener(PERFIL_ATUALIZADO, reler);
    window.addEventListener(FOTO_ATUALIZADA, reler);
    return () => {
      vivo = false;
      window.removeEventListener(PERFIL_ATUALIZADO, reler);
      window.removeEventListener(FOTO_ATUALIZADA, reler);
    };
  }, []);

  if (p === undefined) return <EsqueletoPerfil />;
  if (p === null) return null;

  const temFoto = !!foto.url;
  const alterado = salvo !== null && salvo !== retrato(nome, bio, cidade, idiomasLigado ? idiomas : []);
  const bioCheck = validarBio(bio);
  const barra = progressoPerfil(
    { foto: temFoto || p.temFoto, bio: bio.trim() || null, idiomas, cidade: cidade.trim() || null, profissao: p.profissao, motivo: null },
    { anuncia: p.anuncia, telefone: p.telefone },
  ).itens;
  const prog = medidorPerfil(
    barra,
    p.cadastro.itens.map((i) => (i.chave === "foto" ? { ...i, feito: temFoto || p.temFoto } : i.chave === "nome" ? { ...i, feito: !!nome.trim() } : i)),
  );

  async function salvar(): Promise<boolean> {
    setSalvando(true);
    setMsg(null);
    const [rDados, rPerfil] = await Promise.all([
      salvarMeusDados({ fullName: nome, phone: telefone }).catch(() => ({ ok: false as const, error: "Sem conexão. Tente de novo.", dados: undefined })),
      salvarMeuPerfilPublico({ bio, idiomas: idiomasLigado ? idiomas : [], cidade }).catch(() => ({ ok: false as const, error: "Sem conexão. Tente de novo." })),
    ]);
    setSalvando(false);
    if (!rDados.ok || !rPerfil.ok) {
      setMsg({ ok: false, texto: (!rDados.ok ? rDados.error : rPerfil.error) ?? "Não foi possível salvar." });
      return false;
    }
    if (rDados.dados) {
      const atual = useAuthStore.getState().user;
      if (atual) useAuthStore.getState().setUser({ ...atual, name: rDados.dados.fullName, fullName: rDados.dados.fullName });
    }
    setMsg({ ok: true, texto: "Alterações salvas." });
    setSalvo(retrato(nome, bio, cidade, idiomasLigado ? idiomas : []));
    window.dispatchEvent(new Event(PERFIL_ATUALIZADO));
    return true;
  }

  async function removerFoto() {
    setRemovendo(true);
    try {
      await clearMyAvatar();
      avisarFotoAtualizada(null);
    } finally {
      setRemovendo(false);
    }
  }

  const tIdiomas = textosToggle("idiomas");
  const tProf = textosToggle("profissao");

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]" data-testid="perfil-tela">
      <div className="grid min-w-0 gap-6">
        <AvisoFotoRemovida />
        {/* Mockup perfil-01: no computador um cartão só (foto + campos); no celular a foto e "Trocar foto" ficam sobre o
            fundo e o cartão branco começa nos campos. */}
        <section className={cn("sm:rounded-xl sm:bg-white sm:p-6", SOMBRA_SO_COMPUTADOR)} aria-labelledby="perfil-foto-titulo" data-testid="perfil-cartao">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6" data-testid="topo-conta">
            <Avatar name={nome} size={144} photoUrl={foto.url ?? undefined} />
            <div className="flex flex-col items-center gap-2 sm:items-start">
              <h2 id="perfil-foto-titulo" className="font-title text-xl font-semibold text-ink max-sm:sr-only">
                Foto do perfil
              </h2>
              <EnviarFoto temFoto={temFoto} variante="botao" testId="topo-foto" />
              {temFoto && (
                <button
                  type="button"
                  onClick={removerFoto}
                  disabled={removendo}
                  className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-red-700 underline underline-offset-2 disabled:opacity-60"
                  data-testid="topo-foto-remover"
                >
                  <Trash2 className="h-4 w-4" aria-hidden /> Remover foto
                </button>
              )}
            </div>
          </div>

          <div className={cn("mt-6 grid gap-4 max-sm:rounded-xl max-sm:bg-white max-sm:p-4", SOMBRA_SO_CELULAR)}>
            <label className="block text-sm text-muted">
              Nome completo:
              <input className={`${CAMPO} mt-1`} value={nome} maxLength={80} autoComplete="name" onChange={(e) => setNome(e.target.value)} data-testid="perfil-nome" />
            </label>
            <div>
              <label htmlFor="perfil-bio" className="block text-sm text-muted">
                Sobre você
              </label>
              <textarea
                id="perfil-bio"
                data-testid="perfil-bio"
                value={bio}
                maxLength={BIO_MAX}
                rows={3}
                aria-describedby="perfil-bio-ajuda"
                aria-invalid={!bioCheck.ok}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Ex.: Médica em residência, organizada e tranquila. Gosto de cozinhar."
                className={`${CAMPO} mt-1`}
              />
              <p id="perfil-bio-ajuda" className="mt-1 flex justify-between text-xs text-muted">
                <span className={bioCheck.ok ? "" : "text-red-700"}>{bioCheck.ok ? "Sem telefone, e-mail, @ ou link: o contato fica protegido." : bioCheck.erro}</span>
                <span>
                  {bio.length}/{BIO_MAX}
                </span>
              </p>
            </div>
            <label className="block text-sm text-muted">
              Cidade onde você mora
              <input id="perfil-cidade" data-testid="perfil-cidade" className={`${CAMPO} mt-1`} value={cidade} maxLength={60} onChange={(e) => setCidade(e.target.value)} placeholder="Ex.: Uberlândia (MG)" />
            </label>
          </div>
          <Button type="button" className="mt-6 hidden w-full lg:inline-flex" onClick={salvar} disabled={salvando || !bioCheck.ok} data-testid="perfil-salvar">
            {salvando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Salvar alterações
          </Button>
          {largo && <EstadoSalvar alterado={alterado} />}
          {largo && <MsgSalvar msg={msg} />}
        </section>

        <div className="xl:hidden">
          <EspelhoPorPapel papel={papelEspelho} foto={foto.url} nome={nome} emailConfirmado={p.emailConfirmado} bio={bio} />
        </div>

        <PetsFicha />

        {mostraPainelMorador && (
          <Panel data-testid="perfil-painel-morador">
            <BlocoOpcional
              titulo="Perfil profissional"
              pergunta={tProf.pergunta}
              ligado={profLigado}
              onLigado={setProfLigado}
              temDados={!!p.profissao && p.profissao !== CATEGORIA_NAO_INFORMAR}
              textoConfirmar={tProf.confirmar}
              onLimpar={async () => {
                const r = await setMinhaCategoria(CATEGORIA_NAO_INFORMAR);
                if (r.ok) window.dispatchEvent(new Event(PERFIL_ATUALIZADO));
                return r.ok;
              }}
              testId="profissao-toggle-bloco"
            >
              <CategoriaProfissional />
            </BlocoOpcional>
            <PorQueNaCidade />
          </Panel>
        )}

        <Panel>
          <BlocoOpcional
            titulo="Idiomas que você fala"
            pergunta={tIdiomas.pergunta}
            ligado={idiomasLigado}
            onLigado={setIdiomasLigado}
            temDados={p.idiomas.length > 0}
            textoConfirmar={tIdiomas.confirmar}
            onLimpar={async () => {
              const r = await salvarMeuPerfilPublico({ bio: p.bio, idiomas: [], cidade: p.cidade }).catch(() => ({ ok: false }));
              if (r.ok) {
                setIdiomas([]);
                setP({ ...p, idiomas: [] });
              }
              return r.ok;
            }}
            testId="idiomas-toggle-bloco"
          >
            <div className="flex flex-wrap gap-2" role="group" aria-label="Idiomas">
              {IDIOMAS.map((i) => {
                const on = idiomas.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setIdiomas(on ? idiomas.filter((x) => x !== i) : [...idiomas, i])}
                    className={
                      on
                        ? "inline-flex min-h-10 items-center gap-1 rounded-full bg-forest px-4 text-sm font-semibold text-white"
                        : "inline-flex min-h-10 items-center rounded-full border border-line bg-white px-4 text-sm text-ink hover:border-forest"
                    }
                  >
                    {on && <Check className="h-4 w-4" aria-hidden />} {i}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted">Os idiomas entram no perfil quando você toca em &quot;Salvar alterações&quot;.</p>
          </BlocoOpcional>
        </Panel>

        <MedidorPerfil pct={prog.pct} falta={prog.falta} itens={prog.itens} cadastroCompleto={p.cadastro.completo} />

        {/* E61: no celular o "Salvar alterações" vem logo depois do conteúdo, na ordem da página (sem faixa presa e sem
            vão morto antes ou depois dele). */}
        <div className="lg:hidden" data-testid="perfil-salvar-celular-faixa">
          <Button type="button" className="w-full" disabled={salvando || !bioCheck.ok} onClick={salvar} data-testid="perfil-salvar-celular">
            {salvando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Salvar alterações
          </Button>
          {!largo && <EstadoSalvar alterado={alterado} />}
          {!largo && <MsgSalvar msg={msg} />}
        </div>
      </div>

      <aside className="hidden min-w-0 gap-6 xl:grid" aria-label="Como o proprietário te vê">
        <TituloSecaoLateral ativo="perfil" subtitulo={SUBTITULO_PERFIL} />
        <EspelhoPorPapel papel={papelEspelho} foto={foto.url} nome={nome} emailConfirmado={p.emailConfirmado} bio={bio} />
      </aside>
    </div>
  );
}

function MsgSalvar({ msg }: { msg: { ok: boolean; texto: string } | null }) {
  if (!msg) return null;
  return (
    <p role="status" className={msg.ok ? "mt-3 text-sm text-forest" : "mt-3 text-sm text-red-700"} data-testid="perfil-salvar-msg">
      {msg.texto}
    </p>
  );
}

/**
 * E62 — o medidor lista o que FALTA (desenho aprovado). A 100% vira um estado de sucesso curto: "Perfil completo" e uma
 * linha, sem porcentagem, barra nem a lista do que já foi feito.
 */
function MedidorPerfil(p: { pct: number; falta: string[]; itens: ReturnType<typeof medidorPerfil>["itens"]; cadastroCompleto: boolean }) {
  if (p.pct >= 100 && p.falta.length === 0)
    return (
      <Panel data-testid="complete-perfil" data-completo="sim" data-cadastro-completo={p.cadastroCompleto ? "sim" : "nao"}>
        <p className="flex items-center gap-3" data-testid="perfil-completo">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-forest" aria-hidden />
          <span>
            <span className="block font-title text-lg font-semibold text-ink">Perfil completo</span>
            <span className="block text-sm text-muted">{LINHA_PERFIL_COMPLETO}</span>
          </span>
        </p>
      </Panel>
    );
  const faltam = p.itens.filter((i) => !i.feito);
  return (
    <Panel data-testid="complete-perfil" data-completo="nao" data-cadastro-completo={p.cadastroCompleto ? "sim" : "nao"}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-title text-lg font-semibold text-ink">Complete seu perfil</h2>
        <span className="text-sm font-semibold text-forest" data-testid="perfil-progresso">
          {p.pct}% completo
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className="h-full rounded-full bg-forest transition-all" style={{ width: `${p.pct}%` }} />
      </div>
      <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2" data-testid="perfil-falta" data-faltam={faltam.length}>
        {/* Extra do E62 (aprovado 24/10): cada falta é tocável e leva direto ao campo (ou à tela de Dados). */}
        {faltam.map((i) => {
          const d = destinoDaFalta(i.chave);
          const conteudo = (
            <>
              <CircleDashed className="h-4 w-4 shrink-0 text-muted" aria-hidden /> <span className="underline underline-offset-2">{rotuloCurto(i)}</span>
            </>
          );
          const cls = "flex min-h-11 w-full items-center gap-2 text-left text-ink hover:text-forest";
          return (
            <li key={i.chave}>
              {d.tipo === "rota" ? (
                <Link href={d.href} className={cls} data-testid={`perfil-falta-${i.chave}`}>
                  {conteudo}
                </Link>
              ) : (
                <button type="button" className={cls} onClick={() => irParaCampo(d.alvo)} data-testid={`perfil-falta-${i.chave}`}>
                  {conteudo}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/** Rola até o campo da falta e põe o foco nele (ou no primeiro controle do bloco). */
function irParaCampo(alvo: string) {
  const el = document.querySelector<HTMLElement>(`[data-testid="${alvo}"]`) ?? document.getElementById(alvo);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const foco = el.matches("input, textarea, button, select") ? el : el.querySelector<HTMLElement>("input, textarea, button, select");
  foco?.focus({ preventScroll: true });
}

function EsqueletoPerfil() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]" aria-busy="true" data-testid="perfil-carregando">
      <div className="h-96 rounded-xl bg-white" />
      <div className="hidden h-80 rounded-xl bg-white xl:block" />
    </div>
  );
}

/** Extra do E62: o que o "Salvar alterações" grava, num texto só, para comparar com o que está no banco. */
function retrato(nome: string, bio: string, cidade: string, idiomas: string[]): string {
  return JSON.stringify([nome.trim(), bio.trim(), cidade.trim(), [...idiomas].sort()]);
}

function EstadoSalvar({ alterado }: { alterado: boolean }) {
  return (
    <p className={alterado ? "mt-2 text-sm font-semibold text-amber-800" : "mt-2 text-sm text-forest"} role="status" data-testid="perfil-salvar-estado" data-alterado={alterado ? "1" : "0"}>
      {alterado ? ESTADO_SALVAR.alterado : ESTADO_SALVAR.salvo}
    </p>
  );
}
