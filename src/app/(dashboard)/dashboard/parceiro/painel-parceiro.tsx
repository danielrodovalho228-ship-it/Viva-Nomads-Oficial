"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { Panel } from "@/components/dashboard/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmarNaPagina } from "@/components/ui/confirmar-na-pagina";
import { EnviarImagemParceiro } from "@/components/parceiros/enviar-imagem";
import { CIDADES_MAX, GALERIA_MAX, PAGAMENTO_EM_BREVE, REDES, rotuloCategoria, textoPreco, UNIDADES_SERVICO, type ChaveRede } from "@/lib/parceiros/regras";
import {
  adicionarAgenda,
  legendarFotoGaleria,
  moverFotoGaleria,
  pausarPagina,
  publicarPagina,
  removerAgenda,
  removerFotoGaleria,
  meuPainelParceiro,
  removerServico,
  salvarAtendimento,
  salvarPagina,
  salvarRecebimento,
  salvarServico,
  type PainelParceiro,
} from "@/lib/parceiros/painel-actions";

const ABAS = [
  { id: "pagina", rotulo: "Página" },
  { id: "servicos", rotulo: "Serviços" },
  { id: "atendimento", rotulo: "Atendimento" },
  { id: "dados", rotulo: "Dados" },
] as const;
type Aba = (typeof ABAS)[number]["id"];

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const STATUS: Record<string, string> = { rascunho: "Rascunho (fora do ar)", publicado: "Publicada", pausado: "Pausada (fora do ar)", suspenso: "Suspensa pela Viva" };
const campo = "mt-1 w-full rounded-lg border border-sage-200 bg-white px-3 py-2 text-base text-ink";

type Res = { ok: true } | { ok: false; erro: string };

export function PainelParceiroCliente({ inicial, pagamentoAtivo }: { inicial: PainelParceiro; pagamentoAtivo: boolean }) {
  // Os dados do painel ficam aqui e são relidos do servidor depois de cada ação (sem revalidar a rota inteira, que
  // trocava a tela pelo "carregando" e prendia o formulário).
  const [p, setP] = useState(inicial);
  const [aba, setAba] = useState<Aba>("pagina");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  function rodar(f: () => Promise<Res | { ok: true; valor: unknown }>, ok = "Salvo.") {
    setMsg(null);
    iniciar(async () => {
      const r = await f().catch(() => ({ ok: false as const, erro: "Sem conexão. Tente de novo." }));
      setMsg(r.ok ? { ok: true, texto: ok } : { ok: false, texto: (r as { erro: string }).erro });
      if (r.ok) await recarregar();
    });
  }

  async function recarregar() {
    const novo = await meuPainelParceiro().catch(() => null);
    if (novo) setP(novo);
  }

  const suspenso = p.status === "suspenso";

  return (
    <div className="space-y-4" data-testid="painel-parceiro" data-status={p.status}>
      <Panel>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-muted">Situação da página</p>
            <p className="font-title text-lg font-bold text-ink" data-testid="parceiro-status">
              {STATUS[p.status] ?? p.status}
            </p>
            {suspenso && p.suspensoMotivo && <p className="text-sm text-ink">Motivo: {p.suspensoMotivo}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {p.status === "publicado" && (
              <>
                <ButtonLink href={`/parceiros/${p.slug}`} variant="secondary" size="sm" target="_blank" data-testid="parceiro-ver-pagina">
                  <ExternalLink className="h-4 w-4" aria-hidden /> Ver a página
                </ButtonLink>
                <ConfirmarNaPagina aviso="Pausar a página? Ela sai do ar e da busca até você publicar de novo." confirmar="Pausar" onConfirmar={() => rodar(pausarPagina, "Página pausada.")} disabled={pendente} size="sm" testid="parceiro-pausar">
                  Pausar
                </ConfirmarNaPagina>
              </>
            )}
            {(p.status === "rascunho" || p.status === "pausado") && (
              <Button size="sm" disabled={pendente || p.falta.length > 0} onClick={() => rodar(publicarPagina, "Página publicada.")} data-testid="parceiro-publicar">
                Publicar
              </Button>
            )}
          </div>
        </div>
        {!suspenso && p.status !== "publicado" && p.falta.length > 0 && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-ink" data-testid="parceiro-falta">
            <p className="font-semibold">Falta para publicar:</p>
            <ul className="mt-1 list-disc pl-5">
              {p.falta.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      <div role="tablist" aria-label="Seções do painel de parceiro" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={aba === a.id}
            onClick={() => setAba(a.id)}
            className={`h-11 rounded-lg border text-sm font-semibold ${aba === a.id ? "border-blue-500 bg-blue-50 text-blue-700" : "border-line bg-white text-ink"}`}
            data-testid={`parceiro-aba-${a.id}`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {msg && (
        <p className={`text-sm ${msg.ok ? "text-forest" : "text-red-700"}`} role={msg.ok ? "status" : "alert"} data-testid="parceiro-msg">
          {msg.texto}
        </p>
      )}

      <fieldset disabled={suspenso} className="min-w-0 space-y-4">
        {aba === "pagina" && <AbaPagina p={p} rodar={rodar} recarregar={recarregar} />}
        {aba === "servicos" && <AbaServicos p={p} rodar={rodar} />}
        {aba === "atendimento" && <AbaAtendimento p={p} rodar={rodar} />}
        {aba === "dados" && <AbaDados p={p} rodar={rodar} pagamentoAtivo={pagamentoAtivo} />}
      </fieldset>
      {pendente && <Loader2 className="h-5 w-5 animate-spin text-muted" aria-label="Salvando" />}
    </div>
  );
}

type Rodar = (f: () => Promise<Res | { ok: true; valor: unknown }>, ok?: string) => void;

function AbaPagina({ p, rodar, recarregar }: { p: PainelParceiro; rodar: Rodar; recarregar: () => Promise<void> }) {
  const [nome, setNome] = useState(p.nomePublico);
  const [descricao, setDescricao] = useState(p.descricao);
  const [curta, setCurta] = useState(p.descricaoCurta);
  const [redes, setRedes] = useState<Record<ChaveRede, string>>(p.redes);
  const [legenda, setLegenda] = useState("");
  // O que acabou de subir aparece na hora; o recarregamento da página confirma depois.
  const [avatarLocal, setAvatarLocal] = useState<string | null>(null);
  const [bannerLocal, setBannerLocal] = useState<string | null>(null);
  const [novas, setNovas] = useState<PainelParceiro["galeria"]>([]);
  const [removidas, setRemovidas] = useState<string[]>([]);
  const avatarUrl = avatarLocal ?? p.avatarUrl;
  const bannerUrl = bannerLocal ?? p.bannerUrl;
  const galeria = [...p.galeria, ...novas.filter((n) => !p.galeria.some((g) => g.id === n.id))].filter((g) => !removidas.includes(g.id));
  return (
    <>
      <Panel title="Foto e capa">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-ink">Foto de perfil (quadrada)</p>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- prévia da imagem enviada
              <img src={avatarUrl} alt="Sua foto de perfil" className="my-2 h-24 w-24 rounded-full object-cover" data-testid="parceiro-avatar-previa" />
            ) : (
              <p className="my-2 text-sm text-muted">Sem foto ainda.</p>
            )}
            <EnviarImagemParceiro
              tipo="avatar"
              rotulo={avatarUrl ? "Trocar foto" : "Enviar foto"}
              onEnviado={(r) => {
                setAvatarLocal(r.url);
                void recarregar();
              }}
              testid="parceiro-enviar-avatar"
            />
          </div>
          <div>
            <p className="text-sm font-medium text-ink">Capa (faixa larga)</p>
            {bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- prévia da imagem enviada
              <img src={bannerUrl} alt="Sua capa" className="my-2 aspect-[3/1] w-full rounded-xl object-cover" data-testid="parceiro-banner-previa" />
            ) : (
              <p className="my-2 text-sm text-muted">Sem capa ainda (opcional).</p>
            )}
            <EnviarImagemParceiro
              tipo="banner"
              rotulo={bannerUrl ? "Trocar capa" : "Enviar capa"}
              onEnviado={(r) => {
                setBannerLocal(r.url);
                void recarregar();
              }}
              testid="parceiro-enviar-banner"
            />
          </div>
        </div>
      </Panel>

      <Panel title="Apresentação e redes">
        <div className="space-y-3">
          <div>
            <label htmlFor="pp-nome" className="block text-sm font-medium text-ink">Nome na página</label>
            <input id="pp-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} className={campo} />
          </div>
          <div>
            <label htmlFor="pp-curta" className="block text-sm font-medium text-ink">Descrição curta (aparece na busca)</label>
            <input id="pp-curta" value={curta} onChange={(e) => setCurta(e.target.value)} maxLength={160} className={campo} />
          </div>
          <div>
            <label htmlFor="pp-descricao" className="block text-sm font-medium text-ink">Descrição profissional</label>
            <textarea id="pp-descricao" rows={6} value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={2000} className={campo} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {REDES.map((r) => (
              <div key={r.chave}>
                <label htmlFor={`pp-${r.chave}`} className="block text-sm font-medium text-ink">{r.rotulo}</label>
                <input
                  id={`pp-${r.chave}`}
                  type="url"
                  inputMode="url"
                  value={redes[r.chave]}
                  onChange={(e) => setRedes((x) => ({ ...x, [r.chave]: e.target.value }))}
                  placeholder={r.dominios[0] ? `https://${r.dominios[0]}/…` : "https://"}
                  className={campo}
                />
              </div>
            ))}
          </div>
          <Button onClick={() => rodar(() => salvarPagina({ nomePublico: nome, descricao, descricaoCurta: curta, redes }))} data-testid="parceiro-salvar-pagina">
            Salvar apresentação
          </Button>
        </div>
      </Panel>

      <Panel title={`Galeria (${galeria.length} de ${GALERIA_MAX})`}>
        {p.categorias.includes("fotografia") && <p className="mb-2 text-sm text-muted">Fotografia: publique com pelo menos 3 fotos na galeria.</p>}
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="parceiro-galeria-lista">
          {galeria.map((g, i) => (
            <FotoGaleria key={g.id} g={g} primeira={i === 0} ultima={i === galeria.length - 1} rodar={rodar} aoRemover={() => setRemovidas((x) => [...x, g.id])} />
          ))}
        </ul>
        {galeria.length < GALERIA_MAX && (
          <div className="mt-4 grid gap-2 sm:max-w-md">
            <label htmlFor="pp-legenda" className="block text-sm font-medium text-ink">Legenda da próxima foto (opcional)</label>
            <input id="pp-legenda" value={legenda} onChange={(e) => setLegenda(e.target.value)} maxLength={120} className={campo} />
            <EnviarImagemParceiro
              tipo="galeria"
              rotulo="Adicionar foto à galeria"
              legenda={legenda}
              onEnviado={(r) => {
                if (r.id) setNovas((x) => [...x, { id: r.id!, url: r.url, legenda: r.legenda, ordem: x.length + p.galeria.length }]);
                setLegenda("");
                void recarregar();
              }}
              testid="parceiro-enviar-galeria"
            />
          </div>
        )}
      </Panel>
    </>
  );
}

function FotoGaleria({ g, primeira, ultima, rodar, aoRemover }: { g: PainelParceiro["galeria"][number]; primeira: boolean; ultima: boolean; rodar: Rodar; aoRemover: () => void }) {
  const [legenda, setLegenda] = useState(g.legenda ?? "");
  return (
    <li className="min-w-0 rounded-xl border border-line p-2" data-testid="parceiro-foto-galeria">
      {/* eslint-disable-next-line @next/next/no-img-element -- prévia da imagem enviada */}
      <img src={g.url} alt={g.legenda ?? "Foto da galeria"} className="aspect-[4/3] w-full rounded-lg object-cover" />
      <input
        aria-label="Legenda"
        value={legenda}
        onChange={(e) => setLegenda(e.target.value)}
        onBlur={() => legenda !== (g.legenda ?? "") && rodar(() => legendarFotoGaleria(g.id, legenda), "Legenda salva.")}
        maxLength={120}
        placeholder="Legenda"
        className="mt-2 w-full rounded-md border border-sage-200 px-2 py-1 text-sm"
      />
      <div className="mt-2 flex items-center justify-between gap-1">
        <div className="flex gap-1">
          <button type="button" aria-label="Mover para antes" disabled={primeira} onClick={() => rodar(() => moverFotoGaleria(g.id, "antes"), "Ordem salva.")} className="grid h-9 w-9 place-items-center rounded-md border border-line disabled:opacity-40">
            <ArrowUp className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" aria-label="Mover para depois" disabled={ultima} onClick={() => rodar(() => moverFotoGaleria(g.id, "depois"), "Ordem salva.")} className="grid h-9 w-9 place-items-center rounded-md border border-line disabled:opacity-40">
            <ArrowDown className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <ConfirmarNaPagina aviso="Remover esta foto da galeria?" confirmar="Remover" onConfirmar={() => {
            aoRemover();
            rodar(() => removerFotoGaleria(g.id), "Foto removida.");
          }} variant="ghost" size="sm" ariaLabel="Remover foto">
          <Trash2 className="h-4 w-4" aria-hidden />
        </ConfirmarNaPagina>
      </div>
    </li>
  );
}

function AbaServicos({ p, rodar }: { p: PainelParceiro; rodar: Rodar }) {
  const vazio = { id: "", categoria: p.categorias[0] ?? "outro", titulo: "", descricao: "", precoBase: "", unidade: "por serviço", prazoDias: "" };
  const [f, setF] = useState(vazio);
  const set = (k: keyof typeof vazio, v: string) => setF((x) => ({ ...x, [k]: v }));
  return (
    <>
      <Panel title="Seus serviços">
        {p.servicos.length === 0 ? (
          <p className="text-sm text-muted">Nenhum serviço ainda. Cadastre pelo menos 1 para publicar.</p>
        ) : (
          <ul className="divide-y divide-line" data-testid="parceiro-servicos-lista">
            {p.servicos.map((s) => (
              <li key={s.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{s.titulo}</p>
                  <p className="text-sm text-muted">
                    {rotuloCategoria(s.categoria)} · {textoPreco(s.precoBase, s.unidade)}
                    {s.prazoDias != null ? ` · prazo ${s.prazoDias} ${s.prazoDias === 1 ? "dia" : "dias"}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setF({ id: s.id, categoria: s.categoria, titulo: s.titulo, descricao: s.descricao ?? "", precoBase: s.precoBase == null ? "" : String(s.precoBase), unidade: s.unidade ?? "por serviço", prazoDias: s.prazoDias == null ? "" : String(s.prazoDias) })}>
                    Editar
                  </Button>
                  <ConfirmarNaPagina aviso="Remover este serviço?" confirmar="Remover" onConfirmar={() => rodar(() => removerServico(s.id), "Serviço removido.")} variant="ghost" size="sm">
                    Remover
                  </ConfirmarNaPagina>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title={f.id ? "Editar serviço" : "Novo serviço"}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="sv-categoria" className="block text-sm font-medium text-ink">Categoria</label>
            <select id="sv-categoria" value={f.categoria} onChange={(e) => set("categoria", e.target.value)} className={campo}>
              {p.categorias.map((c) => (
                <option key={c} value={c}>
                  {rotuloCategoria(c)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sv-titulo" className="block text-sm font-medium text-ink">Nome do serviço</label>
            <input id="sv-titulo" value={f.titulo} onChange={(e) => set("titulo", e.target.value)} maxLength={80} placeholder="Ensaio do imóvel (20 fotos)" className={campo} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="sv-descricao" className="block text-sm font-medium text-ink">O que está incluído</label>
            <textarea id="sv-descricao" rows={3} value={f.descricao} onChange={(e) => set("descricao", e.target.value)} maxLength={500} className={campo} />
          </div>
          <div>
            <label htmlFor="sv-preco" className="block text-sm font-medium text-ink">Preço base (R$) — em branco = sob consulta</label>
            <input id="sv-preco" inputMode="decimal" value={f.precoBase} onChange={(e) => set("precoBase", e.target.value)} className={campo} />
          </div>
          <div>
            <label htmlFor="sv-unidade" className="block text-sm font-medium text-ink">Unidade</label>
            <select id="sv-unidade" value={f.unidade} onChange={(e) => set("unidade", e.target.value)} className={campo}>
              {UNIDADES_SERVICO.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sv-prazo" className="block text-sm font-medium text-ink">Prazo (dias)</label>
            <input id="sv-prazo" inputMode="numeric" value={f.prazoDias} onChange={(e) => set("prazoDias", e.target.value)} className={campo} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={() => {
              rodar(() => salvarServico({ ...f, id: f.id || null }), "Serviço salvo.");
              setF(vazio);
            }}
            data-testid="parceiro-salvar-servico"
          >
            {f.id ? "Salvar serviço" : "Adicionar serviço"}
          </Button>
          {f.id && (
            <Button variant="secondary" onClick={() => setF(vazio)}>
              Cancelar edição
            </Button>
          )}
        </div>
      </Panel>
    </>
  );
}

function AbaAtendimento({ p, rodar }: { p: PainelParceiro; rodar: Rodar }) {
  const [cidades, setCidades] = useState(p.cidades.join(", "));
  const [cep, setCep] = useState(p.cepBase);
  const [raio, setRaio] = useState(p.raioKm == null ? "" : String(p.raioKm));
  const [dia, setDia] = useState(1);
  const [inicio, setInicio] = useState("08:00");
  const [fim, setFim] = useState("18:00");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const janelas = p.agenda.filter((a) => a.tipo === "janela");
  const bloqueios = p.agenda.filter((a) => a.tipo === "bloqueio");
  return (
    <>
      <Panel title="Onde você atende">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label htmlFor="at-cidades" className="block text-sm font-medium text-ink">Cidades (separe por vírgula, até {CIDADES_MAX})</label>
            <input id="at-cidades" value={cidades} onChange={(e) => setCidades(e.target.value)} className={campo} />
          </div>
          <div>
            <label htmlFor="at-cep" className="block text-sm font-medium text-ink">CEP base (não aparece em público)</label>
            <input id="at-cep" inputMode="numeric" value={cep} onChange={(e) => setCep(e.target.value)} placeholder="00000-000" className={campo} />
          </div>
          <div>
            <label htmlFor="at-raio" className="block text-sm font-medium text-ink">Raio (km)</label>
            <input id="at-raio" inputMode="numeric" value={raio} onChange={(e) => setRaio(e.target.value)} className={campo} />
          </div>
        </div>
        <Button className="mt-4" onClick={() => rodar(() => salvarAtendimento({ cidades: cidades.split(/[,;\n]/).map((c) => c.trim()).filter(Boolean), cepBase: cep, raioKm: raio }))} data-testid="parceiro-salvar-atendimento">
          Salvar atendimento
        </Button>
      </Panel>

      <Panel title="Agenda">
        <p className="text-sm font-medium text-ink">Janelas da semana</p>
        <ul className="mt-2 space-y-1 text-sm" data-testid="parceiro-janelas">
          {janelas.length === 0 && <li className="text-muted">Nenhuma janela ainda.</li>}
          {janelas.map((j) => (
            <li key={j.id} className="flex items-center justify-between gap-2">
              <span>
                {DIAS[j.diaSemana ?? 0]}: {j.inicio}–{j.fim}
              </span>
              <Button variant="ghost" size="sm" onClick={() => rodar(() => removerAgenda(j.id), "Removido.")}>
                Remover
              </Button>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:items-end">
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="ag-dia" className="block text-sm font-medium text-ink">Dia</label>
            <select id="ag-dia" value={dia} onChange={(e) => setDia(Number(e.target.value))} className={campo}>
              {DIAS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ag-inicio" className="block text-sm font-medium text-ink">Início</label>
            <input id="ag-inicio" type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} className={campo} />
          </div>
          <div>
            <label htmlFor="ag-fim" className="block text-sm font-medium text-ink">Fim</label>
            <input id="ag-fim" type="time" value={fim} onChange={(e) => setFim(e.target.value)} className={campo} />
          </div>
          <Button variant="secondary" className="col-span-2 sm:col-span-1" onClick={() => rodar(() => adicionarAgenda({ tipo: "janela", diaSemana: dia, inicio, fim }), "Janela adicionada.")}>
            Adicionar janela
          </Button>
        </div>

        <p className="mt-6 text-sm font-medium text-ink">Bloqueios (férias, datas sem atender)</p>
        <ul className="mt-2 space-y-1 text-sm">
          {bloqueios.length === 0 && <li className="text-muted">Nenhum bloqueio.</li>}
          {bloqueios.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2">
              <span>
                {b.dataInicio?.split("-").reverse().join("/")} a {b.dataFim?.split("-").reverse().join("/")}
              </span>
              <Button variant="ghost" size="sm" onClick={() => rodar(() => removerAgenda(b.id), "Removido.")}>
                Remover
              </Button>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:items-end">
          <div>
            <label htmlFor="bl-de" className="block text-sm font-medium text-ink">De</label>
            <input id="bl-de" type="date" value={de} onChange={(e) => setDe(e.target.value)} className={campo} />
          </div>
          <div>
            <label htmlFor="bl-ate" className="block text-sm font-medium text-ink">Até</label>
            <input id="bl-ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={campo} />
          </div>
          <Button variant="secondary" className="col-span-2 sm:col-span-1" onClick={() => rodar(() => adicionarAgenda({ tipo: "bloqueio", dataInicio: de, dataFim: ate }), "Bloqueio adicionado.")}>
            Adicionar bloqueio
          </Button>
        </div>
      </Panel>
    </>
  );
}

function AbaDados({ p, rodar, pagamentoAtivo }: { p: PainelParceiro; rodar: Rodar; pagamentoAtivo: boolean }) {
  const [pix, setPix] = useState("");
  return (
    <>
      <Panel title="Dados da parceria">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Tipo</dt>
            <dd className="font-semibold text-ink">{p.tipoPessoa === "pj" ? "Empresa ou MEI (CNPJ)" : "Pessoa física (CPF)"}</dd>
          </div>
          <div>
            <dt className="text-muted">{p.tipoPessoa === "pj" ? "CNPJ" : "CPF"}</dt>
            <dd className="font-semibold text-ink" data-testid="parceiro-documento">
              {p.documentoMascarado}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Categorias</dt>
            <dd className="font-semibold text-ink">{p.categorias.map(rotuloCategoria).join(", ")}</dd>
          </div>
          <div>
            <dt className="text-muted">Endereço da página</dt>
            <dd className="font-semibold text-ink">/parceiros/{p.slug}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted">Tipo e documento não mudam por aqui. Para corrigir, fale com a Viva pela Central de Ajuda.</p>
      </Panel>
      <Panel title="Recebimento">
        {!pagamentoAtivo && (
          <p className="mb-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink" data-testid="recebimento-em-breve">
            {PAGAMENTO_EM_BREVE} Até lá, nada é cobrado nem pago pela Viva. Quando estiver ativo, o valor é dividido na origem: 90% vai direto para você e 10% para a Viva.
          </p>
        )}
        {p.recebimentoFinal && (
          <p className="text-sm text-ink" data-testid="recebimento-final">
            Chave Pix cadastrada: {p.recebimentoFinal}
          </p>
        )}
        <div className="mt-2 grid gap-2 sm:max-w-md">
          <label htmlFor="rc-pix" className="block text-sm font-medium text-ink">{p.recebimentoFinal ? "Trocar a chave Pix" : "Chave Pix para receber"}</label>
          <input id="rc-pix" autoComplete="off" value={pix} onChange={(e) => setPix(e.target.value)} className={campo} />
          <Button variant="secondary" onClick={() => rodar(() => salvarRecebimento(pix), "Chave salva.")} data-testid="recebimento-salvar">
            Salvar chave
          </Button>
          <p className="text-xs text-muted">Só você e a equipe veem. Na tela aparecem apenas os 4 últimos caracteres.</p>
        </div>
      </Panel>
    </>
  );
}
