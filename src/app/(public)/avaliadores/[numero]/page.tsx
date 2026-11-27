import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FlaskConical, MapPin, ShieldCheck, Star } from "lucide-react";
import { createPublicClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";
import { MUNICIPIOS } from "@/lib/municipios";
import { integracoesSimuladas } from "@/lib/integracoes";
import { credenciadoVisivelEmPublico, fontesDaVitrine, fotoDoCredenciado, identidadeConfirmadaDoCredenciado, perfilLigadoDoCredenciado, seloLigadoDoCredenciado, sobreDoCredenciado } from "@/lib/vistoria/vitrine-servidor";
import { VitrineAvaliadores } from "@/components/vistoria/vitrine-avaliadores";
import { tabelaDaCidade } from "@/lib/vistoria/servidor";
import { VoltarCelular as BotaoVoltar } from "@/components/ui/voltar-celular";
import { TEXTO_IDENTIDADE_VERIFICADA, TEXTO_NOVO_NA_VIVA, TITULO_NOVO_NA_VIVA, TITULO_PERFIL, TITULO_SOBRE, TITULO_QUADRO_PRECO, TITULO_VITRINE, cartoesDaCidade, cidadeDoSlug, ehNumeroDeAvaliador, novoNaViva, quadroDePreco, reaisCurtos, rostoDoAvaliador, seloDoCredenciado, slugDaCidade, ufDaCidade, vistaPublicaDoCredenciado, vitrineAberta } from "@/lib/vistoria/vitrine-avaliadores";
import { VISTORIA_ATIVA } from "@/lib/flags";
import { LINHA_PUBLICA_DESIGNACAO } from "@/lib/vistoria/telas-exibicao";
import { SELO_AVALIADOR_SOCIO, TEXTO_AVALIADOR_DE_TESTE } from "@/lib/vistoria/regras";

export const dynamic = "force-dynamic";

type Publico = { numero_credenciado: string; nome_curto: string; cidade: string; avaliacoes_feitas: number; nota_conduta: number | string | null; teste: boolean };

async function avaliador(numero: string): Promise<Publico | null> {
  if (!/^[A-Z]{3}-\d{3,}$/.test(numero)) return null;
  const sb = createPublicClient();
  if (!sb) return null;
  const { data } = await sb.rpc("avaliadores_publicos");
  return ((data ?? []) as Publico[]).find((a) => a.numero_credenciado === numero) ?? null;
}

/** E1075: o perfil público do avaliador do piloto (registo mínimo da 0349), antes de o credenciamento existir. */
type Perfil = { numero: string; nome_publico: string; cidade: string; selo: string; avaliacoes_feitas: number; nota_conduta: number | string | null };

async function perfilPublico(numero: string): Promise<Perfil | null> {
  if (!/^[A-Z]{3}-\d{3,}$/.test(numero)) return null;
  const sb = createPublicClient();
  if (!sb) return null;
  const { data } = await sb.rpc("avaliador_perfil_publico", { p_numero: numero });
  return ((data ?? []) as Perfil[])[0] ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ numero: string }> }): Promise<Metadata> {
  const { numero } = await params;
  // E1080: /avaliadores/<cidade> — a listagem da cidade (desligada para o público até o Daniel abrir; nunca indexada).
  if (!ehNumeroDeAvaliador(decodeURIComponent(numero))) {
    const c = cidadeDoSlug(MUNICIPIOS, numero);
    return { title: c ? TITULO_VITRINE(c.cidade) : "Avaliadores", robots: { index: false, follow: false } };
  }
  const n = decodeURIComponent(numero).toUpperCase();
  // E1075: o perfil público (sem credenciamento) não se apresenta como credenciado, nem no título.
  const titulo = !(await avaliador(n)) && (await perfilPublico(n)) ? `Avaliador nº ${n}` : `Avaliador credenciado nº ${numero}`;
  // Enquanto a chave estiver desligada, a página existe para a rede (QA, admin) mas não vai para busca nenhuma.
  return { title: titulo, robots: VISTORIA_ATIVA ? undefined : { index: false, follow: false } };
}

/**
 * Página pública do avaliador credenciado (62-B1; E1079/E1094: o MESMO desenho do perfil do piloto para todos): nome
 * curto, número de credenciado, cidade, avaliações feitas, a nota de CONDUTA e o preço da tabela da cidade. Sem botão
 * de contratar: quem escolhe o avaliador é o dono, na tela dele (E648).
 */
export default async function AvaliadorPage({ params, searchParams }: { params: Promise<{ numero: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { numero } = await params;
  if (!ehNumeroDeAvaliador(decodeURIComponent(numero))) return <PaginaDaCidade slug={numero} busca={(await searchParams).cidade} />;
  const n = decodeURIComponent(numero).toUpperCase();
  const a = await avaliador(n);
  // E1075: sem credenciado com este número, o perfil público do piloto; sem nenhum dos dois, 404.
  const perfil = a ? null : await perfilPublico(n);
  if (!a && !perfil) notFound();
  if (!a) return <PerfilPublico perfil={perfil!} />;
  const nota = a.nota_conduta == null ? null : Number(a.nota_conduta);
  // E1099 (ORDEM-DUET-458): a caixa "Novo na Viva", com a regra do cartão de escolha (sem avaliações concluídas).
  const novo = novoNaViva(a.avaliacoes_feitas, nota);
  // E1079 (ORDEM-DUET-385/386/397): o perfil do credenciado no desenho do mockup aprovado — a foto de perfil da conta (só a
  // conta de teste a mostra, sem o Daniel), senão as iniciais; a cidade com a UF; o preço da TABELA DA CIDADE por porte.
  const admin = createAdminClient();
  // E1222 (ORDEM-DUET-1075): a pessoa real ainda em teste, sem linha curada publicada, não tem página pública.
  if (!admin || !(await credenciadoVisivelEmPublico(admin, a.numero_credenciado, a.teste))) notFound();
  const foto = admin ? await fotoDoCredenciado(admin, a.numero_credenciado, a.teste) : null;
  // E1097: "Avaliador credenciado" para todos; o sócio só pela linha ligada do Rogério.
  const seloLigado = admin ? await seloLigadoDoCredenciado(admin, a.numero_credenciado) : null;
  // E1208 (ORDEM-DUET-989): a linha curada ligada manda no nome público e na cidade (e, pela cidade, nos preços).
  const ligado = admin ? await perfilLigadoDoCredenciado(admin, a.numero_credenciado) : null;
  const vista = vistaPublicaDoCredenciado(a, ligado);
  const identidadeOk = admin ? await identidadeConfirmadaDoCredenciado(admin, a.numero_credenciado) : false;
  // E1099 parte 2: o "Sobre" escrito pelo avaliador; sem texto, a secção não aparece.
  const sobre = admin ? await sobreDoCredenciado(admin, a.numero_credenciado) : null;
  const rosto = rostoDoAvaliador(vista.nome, foto, a.teste);
  const quadro = admin ? quadroDePreco(await tabelaDaCidade(admin, vista.cidade), vista.cidade, new Date()) : [];
  const uf = ufDaCidade(MUNICIPIOS, vista.cidade);
  return (
    <div className="mx-auto max-w-2xl pb-12" data-testid="avaliador-publico">
      <div className="flex items-center gap-2 px-4 py-3">
        <BotaoVoltar padrao="/" rotulo="o início" testId="avaliador-voltar" className="lg:inline-flex" />
        <p className="font-title text-2xl font-semibold text-ink" data-testid="avaliador-titulo">{TITULO_PERFIL}</p>
      </div>
      <div className="grid aspect-[16/10] w-full place-items-center bg-sage-100" data-testid="avaliador-foto">
        {rosto.tipo === "foto" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={rosto.url} alt={`Foto de ${vista.nome}`} className="h-full w-full object-cover" />
        ) : (
          <span className="inline-grid h-32 w-32 place-items-center rounded-full bg-forest font-title text-2xl font-semibold text-white" data-testid="avaliador-iniciais" data-recurso-sem-foto="" aria-hidden>
            {rosto.texto}
          </span>
        )}
      </div>
      <div className="px-4">
        {a.teste && (
          <p className="mt-6 inline-flex items-start gap-2 rounded-lg bg-sage-100 px-3 py-2 text-sm font-semibold text-ink" data-testid="avaliador-teste">
            <FlaskConical className="mt-1 h-4 w-4 shrink-0" aria-hidden /> {TEXTO_AVALIADOR_DE_TESTE}
          </p>
        )}
        <h1 className="mt-6 font-title text-2xl font-semibold text-ink" data-testid="avaliador-nome">{vista.nome}</h1>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-champagne px-4 py-1 text-sm font-semibold text-forest-700">
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
          <span data-testid="avaliador-rotulo">{seloDoCredenciado(a.teste, seloLigado)}</span>
        </p>
        <p className="mt-3 inline-flex items-center gap-2 text-base text-muted">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden />
          <span data-testid="avaliador-cidade">{vista.cidade}</span>
          {uf && <span data-testid="avaliador-uf">• {uf}</span>}
        </p>
        <p className="mt-4 text-sm text-ink" data-testid="avaliador-linha-designacao">{LINHA_PUBLICA_DESIGNACAO}</p>
        <p className="mt-2 text-sm text-muted">
          Número de credenciado <span className="font-semibold text-ink" data-testid="avaliador-numero">{a.numero_credenciado}</span>
        </p>
        {/* E1099 (ORDEM-460 §2): a mesma área em dois estados — sem avaliações, "Novo na Viva"; com avaliações, a linha delas. */}
        {novo ? (
          <div className="mt-6 flex items-start gap-4 rounded-xl bg-sage-100 p-4" data-testid="avaliador-novo">
            <span className="inline-grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-forest text-forest" aria-hidden>
              <Star className="h-6 w-6" />
            </span>
            <div>
              <p className="font-title text-lg font-semibold text-forest-700">{TITULO_NOVO_NA_VIVA}</p>
              <p className="mt-1 text-sm text-ink">{TEXTO_NOVO_NA_VIVA}</p>
            </div>
          </div>
        ) : (
          <div className="mt-6" data-testid="avaliador-avaliacoes">
            <dl className="grid gap-4 rounded-xl border border-line bg-white p-4 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">Avaliações feitas</dt><dd className="mt-1 text-ink" data-testid="avaliador-feitas">{a.avaliacoes_feitas}</dd></div>
              <div><dt className="text-muted">Nota de conduta</dt><dd className="mt-1 text-ink" data-testid="avaliador-nota">{nota == null ? "Ainda sem avaliações de conduta" : `${nota.toLocaleString("pt-BR")} de 5`}</dd></div>
            </dl>
            <p className="mt-2 text-xs text-muted">A nota mede só a conduta na visita (pontualidade, cordialidade e cuidado com o imóvel), nunca o resultado da avaliação.</p>
          </div>
        )}
        {sobre && (
          <section className="mt-6" data-testid="avaliador-sobre">
            <h2 className="font-title text-xl font-semibold text-ink">{TITULO_SOBRE}</h2>
            <p className="mt-2 whitespace-pre-line text-base text-ink">{sobre}</p>
          </section>
        )}
        {quadro.length > 0 && (
          <section className="mt-6 rounded-xl border border-line bg-white p-4" data-testid="avaliador-preco">
            <h2 className="font-title text-xl font-semibold text-ink">{TITULO_QUADRO_PRECO}</h2>
            <ul className="mt-2 divide-y divide-line">
              {quadro.map((l) => (
                <li key={l.porte} className="flex items-center justify-between py-3 text-base text-ink" data-testid="avaliador-preco-linha" data-porte={l.porte}>
                  <span>{l.rotulo}</span>
                  <span>{reaisCurtos(l.valor)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {/* E1099 (ORDEM-460 §3): só com a identidade da conta CONFIRMADA (o mesmo fato da área do avaliador). */}
        {identidadeOk && (
          <p className="mt-6 inline-flex items-center gap-2 text-base font-semibold text-forest-700" data-testid="avaliador-identidade">
            <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden />
            {TEXTO_IDENTIDADE_VERIFICADA}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * E1075 → E1079 (ORDEM-DUET-385/397): o perfil público do avaliador do piloto no desenho do mockup aprovado
 * (docs/mockups-avaliadores/avaliador-perfil-publico-mobile.webp): voltar + "Perfil do Avaliador", a faixa da foto (sem foto
 * da conta, as iniciais no círculo — ORDEM-386), nome, o selo "Avaliador sócio da Viva", a cidade com a UF, o cartão
 * "Novo na Viva" (estado vazio honesto), e o "Preço da avaliação" da TABELA DA CIDADE (ORDEM-397). "Sobre" e "Identidade
 * verificada" só aparecem com o dado real (texto do avaliador; identidade verificada da conta) — o perfil sem conta não tem.
 * Sem telefone nem e-mail, sem botão de contratar (a escolha é na tela do dono).
 */
async function PerfilPublico({ perfil }: { perfil: Perfil }) {
  const nota = perfil.nota_conduta == null ? null : Number(perfil.nota_conduta);
  const admin = createAdminClient();
  const quadro = admin ? quadroDePreco(await tabelaDaCidade(admin, perfil.cidade), perfil.cidade, new Date()) : [];
  const rosto = rostoDoAvaliador(perfil.nome_publico, null, false);
  const novo = novoNaViva(perfil.avaliacoes_feitas, nota);
  return (
    <div className="mx-auto max-w-2xl pb-12">
      <div className="flex items-center gap-2 px-4 py-3">
        <BotaoVoltar padrao="/" rotulo="o início" testId="avaliador-voltar" className="lg:inline-flex" />
        <p className="font-title text-2xl font-semibold text-ink" data-testid="avaliador-titulo">{TITULO_PERFIL}</p>
      </div>
      <div data-testid="avaliador-perfil-publico">
      <div className="grid aspect-[16/10] w-full place-items-center bg-sage-100" data-testid="avaliador-foto">
        {rosto.tipo === "foto" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={rosto.url} alt={`Foto de ${perfil.nome_publico}`} className="h-full w-full object-cover" />
        ) : (
          <span className="inline-grid h-32 w-32 place-items-center rounded-full bg-forest font-title text-2xl font-semibold text-white" data-testid="avaliador-iniciais" data-recurso-sem-foto="" aria-hidden>
            {rosto.texto}
          </span>
        )}
      </div>
      <div className="px-4">
        <h1 className="mt-6 font-title text-2xl font-semibold text-ink" data-testid="avaliador-nome">{perfil.nome_publico}</h1>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-champagne px-4 py-1 text-sm font-semibold text-forest-700" data-testid="avaliador-selo">
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
          {SELO_AVALIADOR_SOCIO}
        </p>
        <p className="mt-3 inline-flex items-center gap-2 text-base text-muted">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden />
          <span data-testid="avaliador-cidade">{perfil.cidade}</span>
          {ufDaCidade(MUNICIPIOS, perfil.cidade) && <span data-testid="avaliador-uf">• {ufDaCidade(MUNICIPIOS, perfil.cidade)}</span>}
        </p>
        <p className="sr-only">Número de avaliador <span data-testid="avaliador-numero">{perfil.numero}</span></p>
        {novo ? (
          <div className="mt-6 flex items-start gap-4 rounded-xl bg-sage-100 p-4" data-testid="avaliador-novo">
            <span className="inline-grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-forest text-forest" aria-hidden>
              <Star className="h-6 w-6" />
            </span>
            <div>
              <p className="font-title text-lg font-semibold text-forest-700">{TITULO_NOVO_NA_VIVA}</p>
              <p className="mt-1 text-sm text-ink">{TEXTO_NOVO_NA_VIVA}</p>
            </div>
          </div>
        ) : (
          <p className="mt-6 inline-flex items-center gap-2 text-base text-ink" data-testid="avaliador-avaliacoes">
            <Star className="h-4 w-4 shrink-0" aria-hidden />
            <span data-testid="avaliador-feitas">{perfil.avaliacoes_feitas}</span> avaliações
            {nota != null && <span data-testid="avaliador-nota">· {nota.toLocaleString("pt-BR")} de 5</span>}
          </p>
        )}
        {quadro.length > 0 && (
          <section className="mt-6 rounded-xl border border-line bg-white p-4" data-testid="avaliador-preco">
            <h2 className="font-title text-xl font-semibold text-ink">{TITULO_QUADRO_PRECO}</h2>
            <ul className="mt-2 divide-y divide-line">
              {quadro.map((l) => (
                <li key={l.porte} className="flex items-center justify-between py-3 text-base text-ink" data-testid="avaliador-preco-linha" data-porte={l.porte}>
                  <span>{l.rotulo}</span>
                  <span>{reaisCurtos(l.valor)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      </div>
    </div>
  );
}

/**
 * E1080 (ORDEM-DUET-385): /avaliadores/<cidade>. DESLIGADA para o público até o Daniel abrir ("só piloto"): fora do
 * laboratório, 404. A busca por cidade (/avaliadores/busca?cidade=…) leva ao caminho da cidade.
 */
async function PaginaDaCidade({ slug, busca }: { slug: string; busca: string | string[] | undefined }) {
  if (!vitrineAberta(integracoesSimuladas())) notFound();
  if (slug === "busca") {
    const c = cidadeDoSlug(MUNICIPIOS, slugDaCidade(String(Array.isArray(busca) ? busca[0] : busca ?? "")));
    if (!c) notFound();
    redirect(`/avaliadores/${slugDaCidade(c.cidade)}`);
  }
  const c = cidadeDoSlug(MUNICIPIOS, slug);
  if (!c) notFound();
  const admin = createAdminClient();
  if (!admin) notFound();
  const cartoes = cartoesDaCidade(await fontesDaVitrine(admin), c.cidade);
  return <VitrineAvaliadores cidade={c.cidade} uf={c.uf} cartoes={cartoes} />;
}
