"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SugestoesDasFotos } from "@/components/niveis/sugestoes-fotos";
import { gravarComodidadeConfirmada } from "@/lib/data/comodidade-sugerida-actions";

/**
 * E101: as sugestões das fotos (DETECTA-B) na página do nível, acima dos itens de prova. Item de nível segue o
 * FOTO-NA-HORA ("fotografe agora para comprovar" + a câmera do item, nunca a foto da galeria); comodidade confirmada é
 * gravada na hora (aqui não há o "Salvar" do anúncio). Chave desligada: o componente não desenha nada.
 */
export function SugestoesNoNivel({ propertyId, comodidades }: { propertyId: string; comodidades: string[] }) {
  const router = useRouter();
  const [marcadas, setMarcadas] = useState(comodidades);
  return (
    <SugestoesDasFotos
      propertyId={propertyId}
      comodidadesMarcadas={marcadas}
      onComodidade={(chave) => {
        const jaTinha = marcadas.includes(chave);
        setMarcadas((m) => (m.includes(chave) ? m : [...m, chave]));
        // Achado 127: não gravou (falha de leitura ou de gravação) → a marca sai: a tela não mostra como salva a
        // comodidade que não está no anúncio (o dono marca no editor do anúncio).
        void gravarComodidadeConfirmada(propertyId, chave).then((r) => {
          if (!r.ok && !jaTinha) setMarcadas((m) => m.filter((k) => k !== chave));
        });
      }}
      onNivelMudou={() => router.refresh()}
    />
  );
}
