"use client";

import { useEffect, useState } from "react";
import { Check, CircleDashed, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Panel } from "@/components/dashboard/primitives";
import { SOMBRA_SO_CELULAR, SOMBRA_SO_COMPUTADOR } from "@/lib/conta/visual-mockup";
import { cn } from "@/lib/utils";
import { BlocoOpcional } from "@/components/ui/bloco-opcional";
import { EspelhoPerfil } from "@/components/account/espelho-perfil";
import { PetsFicha } from "@/components/account/pets-ficha";
import { CategoriaProfissional } from "@/components/account/categoria-profissional";
import { TituloSecaoLateral } from "@/components/account/casca-conta";
import { EnviarFoto, FOTO_ATUALIZADA, PERFIL_ATUALIZADO, avisarFotoAtualizada, useMinhaFoto } from "@/components/account/foto-perfil";
import { getMeuPerfilPublico, getMeusDados, salvarMeuPerfilPublico, salvarMeusDados, setMinhaCategoria, type MeuPerfilPublico } from "@/lib/data/perfil-actions";
import { clearMyAvatar } from "@/lib/data/avatar-actions";
import { BIO_MAX, IDIOMAS, listaEmTexto, medidorPerfil, rotuloCurto, progressoPerfil, validarBio } from "@/lib/perfil/perfil-publico";
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
 * Idiomas) e o medidor "Complete seu perfil" (C1). No celular: título no topo, foto grande, cartão, espelho, blocos e o
 * "Salvar alterações" preso no fim da tela.
 */
export function PerfilTela() {
  const foto = useMinhaFoto();
  const { mode } = useViewMode();
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
              <input id="perfil-cidade" className={`${CAMPO} mt-1`} value={cidade} maxLength={60} onChange={(e) => setCidade(e.target.value)} placeholder="Ex.: Uberlândia (MG)" />
            </label>
          </div>
          <Button type="button" className="mt-6 hidden w-full lg:inline-flex" onClick={salvar} disabled={salvando || !bioCheck.ok} data-testid="perfil-salvar">
            {salvando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Salvar alterações
          </Button>
          {msg && (
            <p role="status" className={msg.ok ? "mt-3 text-sm text-forest" : "mt-3 text-sm text-red-700"} data-testid="perfil-salvar-msg">
              {msg.texto}
            </p>
          )}
        </section>

        <div className="xl:hidden">
          <EspelhoPerfil foto={foto.url} nome={nome} emailConfirmado={p.emailConfirmado} bio={bio} />
        </div>

        <PetsFicha />

        {mode === "tenant" && (
          <Panel>
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

        <Panel data-testid="complete-perfil">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-title text-lg font-semibold text-ink">Complete seu perfil</h2>
            <span className="text-sm font-semibold text-forest" data-testid="perfil-progresso">
              {prog.pct}% completo
            </span>
          </div>
          <p className="mt-2 text-sm text-ink" data-testid="conta-cadastro-completo" data-completo={p.cadastro.completo ? "sim" : "nao"}>
            Cadastro completo: <strong>{p.cadastro.completo ? "sim" : "não"}</strong>
            <span className="text-muted" data-testid="perfil-falta" data-faltam={prog.falta.length}>
              {prog.falta.length ? ` · falta: ${listaEmTexto(prog.falta)}` : " · nada faltando"}
            </span>
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <div className="h-full rounded-full bg-forest transition-all" style={{ width: `${prog.pct}%` }} />
          </div>
          <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {prog.itens.map((i) => (
              <li key={i.chave} className={i.feito ? "flex items-center gap-2 text-forest" : "flex items-center gap-2 text-muted"}>
                {i.feito ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : <CircleDashed className="h-4 w-4 shrink-0" aria-hidden />} {rotuloCurto(i)}
              </li>
            ))}
          </ul>
        </Panel>

        {/* Celular: o "Salvar alterações" preso no fim da tela (desenho perfil-01, versão celular). */}
        <div className="vn-salvar-perfil sticky z-20 -mx-4 bg-areia px-4 py-3 lg:hidden" data-testid="perfil-salvar-celular-faixa">
          <Button type="button" className="w-full" disabled={salvando || !bioCheck.ok} onClick={salvar} data-testid="perfil-salvar-celular">
            {salvando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Salvar alterações
          </Button>
        </div>
      </div>

      <aside className="hidden min-w-0 gap-6 xl:grid" aria-label="Como o proprietário te vê">
        <TituloSecaoLateral ativo="perfil" subtitulo={SUBTITULO_PERFIL} />
        <EspelhoPerfil foto={foto.url} nome={nome} emailConfirmado={p.emailConfirmado} bio={bio} />
      </aside>
    </div>
  );
}

function EsqueletoPerfil() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]" aria-busy="true" data-testid="perfil-carregando">
      <div className="h-96 rounded-xl bg-white" />
      <div className="hidden h-80 rounded-xl bg-white xl:block" />
    </div>
  );
}
