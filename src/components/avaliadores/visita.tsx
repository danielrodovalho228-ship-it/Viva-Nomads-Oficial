/*
  E1079, fatia 4 — a visita do avaliador, como no mockup aprovado (avaliador-visita): a foto do imóvel, o "Roteiro da
  visita", a grade "Fotos do imóvel" com as vagas "Adicionar foto" e o botão "Continuar".
  Só apresentação: o roteiro e as vagas vêm de @/lib/vistoria/visita-avaliador; as cores e medidas do desenho, de
  @/lib/conta/visual-mockup. "Adicionar foto" leva ao envio de foto que já existe; "Continuar", ao checklist.
*/
import { Camera, Check } from "lucide-react";
import { ROTULO_ADICIONAR_FOTO, ROTULO_CONTINUAR, TITULO_FOTOS_VISITA, TITULO_ROTEIRO, vagasDeFoto, type LinhaRoteiro } from "@/lib/vistoria/visita-avaliador";
import {
  BOTAO_CONTINUAR_VISITA,
  CAIXA_ROTEIRO_VISITA,
  CAPA_VISITA,
  CARTAO_ROTEIRO_SOBRE_A_CAPA,
  CARTAO_ROTEIRO_VISITA,
  LINHA_ROTEIRO_VISITA,
  MINIATURA_VISITA,
  TITULO_FOTOS_DA_VISITA,
  TITULO_ROTEIRO_VISITA,
  VAGA_FOTO_VISITA,
} from "@/lib/conta/visual-mockup";

/**
 * E1178: `soLeitura` é a visita antes do dia marcado — o roteiro e as fotos já enviadas continuam à vista (ORDEM-431),
 * mas as vagas "Adicionar foto" e o "Continuar" saem: levam ao envio, que o servidor recusa antes do dia.
 */
export function VisitaEmAndamento({ capaUrl, roteiro, fotos, soLeitura = false }: { capaUrl?: string; roteiro: LinhaRoteiro[]; fotos: { url: string; comodo: string }[]; soLeitura?: boolean }) {
  const vagas = vagasDeFoto(fotos.length);
  return (
    <section data-testid="visita-em-andamento" className="mb-6 grid gap-6 lg:grid-cols-2 lg:items-start">
      <div className="min-w-0">
        {/* A foto de capa do anúncio; sem ela, o roteiro fica sozinho, sem buraco. */}
        {capaUrl ? (
          <div className={CAPA_VISITA} data-testid="visita-capa">
            {/* eslint-disable-next-line @next/next/no-img-element -- capa pública do anúncio, tamanho da caixa */}
            <img src={capaUrl} alt="" className="h-full w-full object-cover" />
          </div>
        ) : null}
        <div className={`${CARTAO_ROTEIRO_VISITA} ${capaUrl ? CARTAO_ROTEIRO_SOBRE_A_CAPA : ""}`} data-testid="visita-roteiro">
          <h2 className={TITULO_ROTEIRO_VISITA}>{TITULO_ROTEIRO}</h2>
          <ul className="mt-3 grid gap-3">
            {roteiro.map((l) => (
              <li key={l.id} className={LINHA_ROTEIRO_VISITA[l.feito ? "feito" : "porFazer"]} data-roteiro={l.id} data-feito={l.feito ? "sim" : "nao"}>
                {l.feito ? (
                  <span className={CAIXA_ROTEIRO_VISITA.feito} aria-hidden>
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                ) : (
                  <span className={CAIXA_ROTEIRO_VISITA.porFazer} aria-hidden />
                )}
                <span>
                  {l.rotulo}
                  <span className="sr-only">{l.feito ? " (com foto)" : " (sem foto)"}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="min-w-0">
        <h2 className={TITULO_FOTOS_DA_VISITA}>{TITULO_FOTOS_VISITA}</h2>
        <ul className="mt-3 grid grid-cols-3 gap-3" data-testid="visita-fotos">
          {fotos.map((f) => (
            <li key={f.url} className={MINIATURA_VISITA} data-testid="visita-foto">
              {/* eslint-disable-next-line @next/next/no-img-element -- miniatura da foto da visita, URL assinada */}
              <img src={f.url} alt={`Foto: ${f.comodo}`} className="h-full w-full object-cover" />
            </li>
          ))}
          {!soLeitura &&
            Array.from({ length: vagas }, (_, i) => (
              <li key={`vaga-${i}`}>
                <a href="#enviar-foto" className={VAGA_FOTO_VISITA} data-testid="visita-adicionar-foto">
                  <Camera className="h-8 w-8" aria-hidden />
                  {ROTULO_ADICIONAR_FOTO}
                </a>
              </li>
            ))}
        </ul>
        {!soLeitura && (
          <a href="#itens" className={`mt-6 ${BOTAO_CONTINUAR_VISITA}`} data-testid="visita-continuar">
            {ROTULO_CONTINUAR}
          </a>
        )}
      </div>
    </section>
  );
}
