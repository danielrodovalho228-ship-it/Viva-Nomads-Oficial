import type { Metadata } from "next";
import { FavoritosLista } from "@/components/favoritos-lista";

// Lista pessoal (guardada no navegador): não entra no Google.
export const metadata: Metadata = {
  title: "Favoritos",
  robots: { index: false, follow: true },
};

export default function FavoritosPage() {
  return <FavoritosLista />;
}
