"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleDashed, Loader2 } from "lucide-react";
import { Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { getMeuPerfilPublico, salvarMeuPerfilPublico, type MeuPerfilPublico } from "@/lib/data/perfil-actions";
import { getMinhaIntencao } from "@/lib/data/intencao-actions";
import { BIO_MAX, IDIOMAS, listaEmTexto, medidorPerfil, progressoPerfil, validarBio } from "@/lib/perfil/perfil-publico";
import type { Intencao } from "@/lib/auth/entrada";
import { EspelhoPerfil } from "@/components/account/espelho-perfil";
import { FOTO_ATUALIZADA, PERFIL_ATUALIZADO, useMinhaFoto } from "@/components/account/foto-perfil";

/**
 * "Complete seu perfil" (prompt 6): barra de progresso — nunca obrigatória — e os campos públicos
 * (frase sobre você, idiomas, cidade). Foto: no bloco "Foto de perfil" logo abaixo.
 * Celular verificado (prompt 7) entra como item opcional quando a verificação por SMS está disponível.
 */
export function PerfilPublicoForm() {
  const router = useRouter();
  const foto = useMinhaFoto();
  const [p, setP] = useState<MeuPerfilPublico | null | undefined>(undefined);
  const [intencoes, setIntencoes] = useState<Intencao[]>([]);
  const [bio, setBio] = useState("");
  const [idiomas, setIdiomas] = useState<string[]>([]);
  const [cidade, setCidade] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    getMeuPerfilPublico()
      .then((d) => {
        if (!vivo) return;
        setP(d);
        if (d) {
          setBio(d.bio);
          setIdiomas(d.idiomas);
          setCidade(d.cidade);
        }
      })
      .catch(() => vivo && setP(null));
    getMinhaIntencao()
      .then((i) => vivo && setIntencoes(i ?? []))
      .catch(() => {});
    // CONTA-A, item 5: o progresso anda — nome salvo em Dados, foto nova ou intenção mudam o que já foi feito.
    const reler = () =>
      getMeuPerfilPublico()
        .then((d) => vivo && d && setP((atual) => (atual ? { ...atual, temFoto: d.temFoto, nome: d.nome, telefone: d.telefone, profissao: d.profissao, cadastro: d.cadastro, emailConfirmado: d.emailConfirmado } : d)))
        .catch(() => {});
    window.addEventListener(PERFIL_ATUALIZADO, reler);
    window.addEventListener(FOTO_ATUALIZADA, reler);
    return () => {
      vivo = false;
      window.removeEventListener(PERFIL_ATUALIZADO, reler);
      window.removeEventListener(FOTO_ATUALIZADA, reler);
    };
  }, []);

  if (p === undefined || p === null) return null;

  const temFoto = p.temFoto || !!foto.url;
  const barra = progressoPerfil(
    { foto: temFoto, bio: bio.trim() || null, idiomas, cidade: cidade.trim() || null, profissao: p.profissao, motivo: null },
    { anuncia: p.anuncia, telefone: p.telefone },
  ).itens;
  // C1: o medidor conta o cadastro (nome, e-mail, documento) e a barra; a linha de faltas lista tudo o que falta.
  const prog = medidorPerfil(barra, p.cadastro.itens.map((i) => (i.chave === "foto" ? { ...i, feito: temFoto } : i)));
  const bioCheck = validarBio(bio);

  async function salvar(): Promise<boolean> {
    setSalvando(true);
    setMsg(null);
    const r = await salvarMeuPerfilPublico({ bio, idiomas, cidade });
    setSalvando(false);
    setMsg(r.ok ? { ok: true, texto: "Perfil salvo." } : { ok: false, texto: r.error ?? "Não foi possível salvar." });
    if (r.ok) window.dispatchEvent(new Event(PERFIL_ATUALIZADO));
    return r.ok;
  }

  return (
    <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Panel data-testid="complete-perfil">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-title text-lg font-semibold text-ink">Complete seu perfil</h2>
          <span className="text-sm font-semibold text-forest" data-testid="perfil-progresso">{prog.pct}% completo</span>
        </div>
        <p className="mt-1 text-sm text-muted">Opcional. Perfis completos passam mais confiança a quem vai alugar com você ou para você.</p>
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
              {i.feito ? <Check className="h-4 w-4" aria-hidden /> : <CircleDashed className="h-4 w-4" aria-hidden />} {i.rotulo}
            </li>
          ))}
        </ul>

        <div className="mt-4 grid gap-4">
          <div>
            <label htmlFor="perfil-bio" className="mb-2 block text-sm font-medium text-ink">
              Uma frase sobre você
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
              className="w-full rounded-xl border border-sage-200 px-4 py-3 text-sm outline-none focus:border-sage"
            />
            <p id="perfil-bio-ajuda" className="mt-1 flex justify-between text-xs text-muted">
              <span className={bioCheck.ok ? "" : "text-red-700"}>{bioCheck.ok ? "Sem telefone, e-mail, @ ou link: o contato fica protegido." : bioCheck.erro}</span>
              <span>{bio.length}/{BIO_MAX}</span>
            </p>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-ink">Idiomas que fala</legend>
            <div className="flex flex-wrap gap-2">
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
                        ? "min-h-10 rounded-full border border-forest bg-forest px-4 text-sm font-medium text-white"
                        : "min-h-10 rounded-full border border-sage-200 bg-white px-4 text-sm text-ink hover:border-sage"
                    }
                  >
                    {i}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="perfil-cidade" className="mb-2 block text-sm font-medium text-ink">
              Cidade onde você mora
            </label>
            <input
              id="perfil-cidade"
              value={cidade}
              maxLength={60}
              aria-describedby="perfil-cidade-ajuda"
              onChange={(e) => setCidade(e.target.value)}
              placeholder="Ex.: Uberlândia (MG)"
              className="w-full rounded-xl border border-sage-200 px-4 py-3 text-sm outline-none focus:border-sage"
            />
            <p id="perfil-cidade-ajuda" className="mt-1 text-xs text-muted">Só a cidade. O endereço nunca aparece no perfil.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* No computador, "Salvar perfil" aqui; no celular, o botão preso no fim da tela (abaixo do espelho). */}
          <Button type="button" variant="primary" onClick={salvar} disabled={salvando || !bioCheck.ok} className="hidden lg:inline-flex" data-testid="perfil-salvar">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Salvar perfil
          </Button>
          {msg && (
            <p role="status" className={msg.ok ? "text-sm text-forest" : "text-sm text-red-700"} data-testid="perfil-salvar-msg">
              {msg.texto}
            </p>
          )}
        </div>
      </Panel>
      <EspelhoPerfil
        foto={foto.url}
        nome={p.nome}
        intencoes={intencoes}
        cidade={cidade}
        emailConfirmado={p.emailConfirmado}
        bio={bio}
      />
      <div className="vn-salvar-perfil sticky z-20 -mx-4 bg-white px-4 py-3 lg:hidden" data-testid="perfil-salvar-celular-faixa">
        <Button
          type="button"
          variant="primary"
          className="w-full"
          disabled={salvando || !bioCheck.ok}
          onClick={async () => {
            if (await salvar()) router.push("/buscar");
          }}
          data-testid="perfil-salvar-celular"
        >
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Salvar e ver imóveis
        </Button>
      </div>
    </div>
  );
}
