/*
  E1079, fatia 2 — o painel do avaliador, como no mockup aprovado (avaliador-painel): a saudação, a foto de perfil da
  conta no cabeçalho (ou as iniciais), a faixa das visitas de hoje com "Ver pedidos" e os quatro cartões.
  Só apresentação: os textos e as contas vêm de @/lib/vistoria/painel-avaliador; as cores e medidas do desenho, de
  @/lib/conta/visual-mockup.
*/
import { Banknote, CalendarDays, ClipboardList, MapPin, ShieldCheck, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { CARTOES_DO_PAINEL, faixaVisitasHoje, fraseVisitasHoje, saudacaoDoAvaliador, type CartaoDoPainel, type ResumoDoPainel } from "@/lib/vistoria/painel-avaliador";
import {
  AVATAR_AVALIADORES,
  BOTAO_PAINEL_AVALIADOR,
  CABECALHO_PAINEL_AVALIADOR,
  CARTAO_PAINEL_AVALIADOR,
  DESTAQUE_CARTAO_PAINEL_AVALIADOR,
  FAIXA_PAINEL_AVALIADOR,
  FOTO_PAINEL_AVALIADOR,
  FRASE_PAINEL_AVALIADOR,
  ICONE_PAINEL_AVALIADOR,
  SAUDACAO_PAINEL_AVALIADOR,
  TEXTO_CARTAO_PAINEL_AVALIADOR,
  TEXTO_FAIXA_PAINEL_AVALIADOR,
  TITULO_CARTAO_PAINEL_AVALIADOR,
  VALOR_CARTAO_PAINEL_AVALIADOR,
} from "@/lib/conta/visual-mockup";

const ICONE: Record<CartaoDoPainel["id"], LucideIcon> = { pedidos: ClipboardList, agenda: CalendarDays, recebidos: Banknote, credenciamento: ShieldCheck };

export function PainelAvaliador({ nome, fotoUrl, resumo, estadoCredenciamento }: { nome: string; fotoUrl?: string; resumo: ResumoDoPainel; estadoCredenciamento: string }) {
  const cartoes = CARTOES_DO_PAINEL(resumo, estadoCredenciamento);
  return (
    <section data-testid="painel-avaliador" className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <div className="min-w-0">
        <h1 className={SAUDACAO_PAINEL_AVALIADOR} data-testid="painel-saudacao">{saudacaoDoAvaliador(nome)}</h1>
        <p className={FRASE_PAINEL_AVALIADOR} data-testid="painel-visitas-hoje">{fraseVisitasHoje(resumo.visitasHoje)}</p>
        <div className={`mt-4 ${CABECALHO_PAINEL_AVALIADOR}`} data-testid="painel-cabecalho">
          {/* ORDEM-386: a foto de perfil da conta; sem foto, as iniciais no círculo — nunca um espaço vazio. */}
          <div className={FOTO_PAINEL_AVALIADOR} data-testid="painel-foto" data-foto={fotoUrl ? "sim" : "nao"}>
            {fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- foto de perfil da própria conta, URL assinada
              <img src={fotoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Avatar name={nome} size={96} className={AVATAR_AVALIADORES} />
            )}
          </div>
          <div className={FAIXA_PAINEL_AVALIADOR}>
            <p className={TEXTO_FAIXA_PAINEL_AVALIADOR} data-testid="painel-faixa">
              <MapPin className="h-6 w-6 shrink-0" aria-hidden />
              {faixaVisitasHoje(resumo.visitasHoje)}
            </p>
            <a href="#pedidos" className={BOTAO_PAINEL_AVALIADOR} data-testid="painel-ver-pedidos">
              Ver pedidos
            </a>
          </div>
        </div>
      </div>
      <ul className="grid min-w-0 grid-cols-2 gap-4" data-testid="painel-cartoes">
        {cartoes.map((c) => {
          const Icone = ICONE[c.id];
          return (
            <li key={c.id} className="min-w-0">
              <a href={c.href} className={CARTAO_PAINEL_AVALIADOR} data-testid={`painel-cartao-${c.id}`}>
                <span className={ICONE_PAINEL_AVALIADOR}>
                  <Icone className="h-6 w-6" aria-hidden />
                </span>
                <span className={TITULO_CARTAO_PAINEL_AVALIADOR}>{c.titulo}</span>
                <span className={c.id === "recebidos" ? VALOR_CARTAO_PAINEL_AVALIADOR : c.destaque ? DESTAQUE_CARTAO_PAINEL_AVALIADOR : TEXTO_CARTAO_PAINEL_AVALIADOR}>{c.texto}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
