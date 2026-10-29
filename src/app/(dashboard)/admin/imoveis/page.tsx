import { NumeroDaFonte } from "@/components/admin/numero-da-fonte";
import Link from "next/link";
import { Home } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { SeloTeste } from "@/components/admin/selo-teste";
import { adminDaPagina, imoveisDoBanco, type ImovelLinhaAdmin } from "@/lib/data/admin-indicadores";
import { apareceParaPublico, periodoDaLista, ROTULO_TIPO_IMOVEL, tipoImovel, type TipoImovel } from "@/lib/admin/indicadores";
import { rotuloPeriodo } from "@/lib/admin/visao-geral";
import { chaveCidade } from "@/lib/cidades";
import { SAMPLE_PROPERTIES } from "@/lib/properties";
import { showDemoProperties } from "@/lib/data/properties";
import { TIER_META, type QualityTier } from "@/lib/listing";
import { dataBRT } from "@/lib/datas-brasilia";
import { PausarImovel } from "./pausar";
import { LinksDeVideoPendentes } from "./links-de-video";
import { listarLinksDeVideoPendentes } from "@/lib/data/video-link-actions";
import { rotuloDoAdmin, tituloDoAdmin } from "@/config/menu-admin";
import { soLeituraNaTela } from "@/lib/qa/observador";
import { SoLeituraQa } from "@/components/admin/so-leitura-qa";

export const metadata = { title: tituloDoAdmin("/admin/imoveis"), robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { active: "Ativo", draft: "Rascunho", paused: "Pausado" };
const DOC: Record<string, string> = { none: "Sem documento", pending: "Em revisão", approved: "Aprovado", rejected: "Recusado" };

type Linha = ImovelLinhaAdmin & { tipo: TipoImovel; publico: boolean };

/**
 * Admin → Imóveis (Prompt 29, itens 5 e 13): todos os anúncios — reais, de demonstração (os "Anúncio de exemplo" do
 * código) e de teste — com "Aparece para o público", para a equipe ver exatamente o que o visitante vê. As contagens
 * da home (reais publicados, demonstração, teste) abrem esta lista com o filtro certo.
 */
export default async function AdminImoveisPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const um = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim().slice(0, 80) : "");
  const p = periodoDaLista({ de: um("de"), ate: um("ate") });
  const tipo = (["real", "demonstracao", "teste"].includes(um("tipo")) ? um("tipo") : "") as TipoImovel | "";
  const status = um("status");
  const cidade = um("cidade");
  const bairro = um("bairro").toLowerCase();
  const dono = um("dono").toLowerCase();
  const docRevisao = um("documento") === "revisao";
  const demos = showDemoProperties();

  const admin = await adminDaPagina();
  const [doBanco, linksVideo] = await Promise.all([admin ? imoveisDoBanco(admin) : Promise.resolve([]), listarLinksDeVideoPendentes().catch(() => [])]);
  const exemplos: ImovelLinhaAdmin[] = SAMPLE_PROPERTIES.map((e) => ({
    id: e.id,
    titulo: e.title,
    ownerId: "",
    dono: "Viva Nomads (exemplo)",
    status: "active",
    cidade: e.city,
    bairro: e.neighborhood ?? null,
    criadoEm: "",
    documento: "none",
    qualidade: null,
    donoTeste: false,
  }));
  const todos: Linha[] = [...doBanco, ...exemplos].map((i) => {
    const t = tipoImovel({ id: i.id, titulo: i.titulo, donoTeste: i.donoTeste });
    return { ...i, tipo: t, publico: apareceParaPublico(t, i.status, demos) };
  });
  const ini = p ? new Date(`${p.inicio}T00:00:00-03:00`).getTime() : null;
  const fim = p ? new Date(`${p.fim}T00:00:00-03:00`).getTime() + 86_400_000 : null;
  const lista = todos.filter(
    (i) =>
      (!tipo || i.tipo === tipo) &&
      (!status || i.status === status) &&
      (!cidade || chaveCidade(i.cidade) === chaveCidade(cidade)) &&
      (!bairro || (i.bairro ?? "").toLowerCase().includes(bairro)) &&
      (!dono || i.dono.toLowerCase().includes(dono)) &&
      (!docRevisao || i.documento === "pending") &&
      (ini === null || (i.criadoEm && new Date(i.criadoEm).getTime() >= ini && new Date(i.criadoEm).getTime() < (fim as number)))
  );
  const campo = "rounded-xl border border-line px-3 py-2 text-sm text-ink";

  // Pendência 3 do QA-LOGIN-B v2: anúncio de dono real → o admin observador da QA não vê o "Pausar" (o servidor recusa).
  const pausaveis = lista.filter((i) => i.tipo !== "demonstracao" && i.status === "active");
  const soLeitura = new Set(await soLeituraNaTela(pausaveis.map((i) => ({ id: i.id, alvo: { imoveis: [i.id] } }))));
  return (
    <div data-testid="admin-imoveis">
      <PageTitle
        title={rotuloDoAdmin("/admin/imoveis")}
        subtitle={`${tipo ? ROTULO_TIPO_IMOVEL[tipo] : "Todos os tipos"}${status ? ` · ${STATUS[status] ?? status}` : ""}${p ? ` · criados ${rotuloPeriodo(p.inicio, p.fim)}` : ""} · demonstração ${demos ? "aparece na busca" : "escondida"}`}
        action={
          <Link href="/admin" className="text-sm text-forest underline">
            Voltar à visão geral
          </Link>
        }
      />
      <NumeroDaFonte chave="anuncios" />
      <LinksDeVideoPendentes links={linksVideo} />
      <form action="/admin/imoveis" method="get" className="mb-4 flex flex-wrap items-end gap-2" role="search">
        {p && <input type="hidden" name="de" value={p.inicio} />}
        {p && <input type="hidden" name="ate" value={p.fim} />}
        <label className="grid gap-1 text-sm text-muted">
          Tipo
          <select name="tipo" defaultValue={tipo} className={campo} data-testid="filtro-tipo">
            <option value="">Todos</option>
            <option value="real">Real</option>
            <option value="demonstracao">Demonstração</option>
            <option value="teste">Teste</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm text-muted">
          Situação
          <select name="status" defaultValue={status} className={campo}>
            <option value="">Todas</option>
            <option value="active">Ativo</option>
            <option value="draft">Rascunho</option>
            <option value="paused">Pausado</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm text-muted">
          Cidade
          <input name="cidade" defaultValue={cidade} maxLength={80} className={campo} />
        </label>
        <label className="grid gap-1 text-sm text-muted">
          Bairro
          <input name="bairro" defaultValue={um("bairro")} maxLength={80} className={campo} />
        </label>
        <label className="grid gap-1 text-sm text-muted">
          Proprietário
          <input name="dono" defaultValue={um("dono")} maxLength={80} className={campo} />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="documento" value="revisao" defaultChecked={docRevisao} /> Documento em revisão
        </label>
        <Button type="submit" size="sm">
          Filtrar
        </Button>
      </form>
      <p className="mb-3 text-sm text-ink">
        <strong data-testid="lista-total">{lista.length}</strong> {lista.length === 1 ? "imóvel" : "imóveis"} nesta lista ·{" "}
        {lista.filter((i) => i.publico).length} aparecem para o público.
      </p>
      <Panel title={`Imóveis (${lista.length})`}>
        {lista.length === 0 ? (
          <EmptyState icon={Home} title="Nenhum imóvel nesta lista" text="Tire um filtro para ver outros." action={<ButtonLink href="/admin/imoveis" variant="secondary" size="sm">Ver todos os imóveis</ButtonLink>} />
        ) : (
          <ul className="grid gap-3">
            {lista.map((i) => (
              <li key={i.id} className="rounded-xl border border-line p-3 text-sm" data-testid="imovel-linha" data-tipo={i.tipo} data-publico={i.publico ? "sim" : "nao"}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-ink">
                    {i.titulo}
                    {i.tipo === "teste" && <SeloTeste />}
                  </span>
                  <span className="text-xs text-muted">
                    Tipo: <strong data-testid="imovel-tipo">{ROTULO_TIPO_IMOVEL[i.tipo]}</strong> · Aparece para o público:{" "}
                    <strong data-testid="imovel-publico">{i.publico ? "sim" : "não"}</strong>
                  </span>
                </div>
                <p className="mt-1 text-muted">
                  {i.dono} · {STATUS[i.status] ?? i.status} · documento: {DOC[i.documento] ?? i.documento} · qualidade:{" "}
                  {i.qualidade && i.qualidade in TIER_META ? TIER_META[i.qualidade as QualityTier].label : "—"}
                  {i.cidade ? ` · ${i.cidade}` : ""}
                  {i.bairro ? ` · ${i.bairro}` : ""}
                  {i.criadoEm ? ` · criado em ${dataBRT(i.criadoEm)}` : ""}
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  <Link href={`/imoveis/${i.id}`} className="font-semibold text-forest underline">
                    Ver como o público vê
                  </Link>
                  {i.tipo !== "demonstracao" && (
                    <Link href="/admin/documentos" className="font-semibold text-forest underline">
                      Documento
                    </Link>
                  )}
                  {i.cidade && (
                    <Link href={`/admin/pedidos?cidade=${encodeURIComponent(i.cidade)}`} className="font-semibold text-forest underline">
                      Pedidos compatíveis
                    </Link>
                  )}
                  {i.tipo !== "demonstracao" && i.status === "active" && (soLeitura.has(i.id) ? <SoLeituraQa /> : <PausarImovel id={i.id} />)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
