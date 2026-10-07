import { jsonSeguro } from "@/lib/seo/estruturados";

/** <script type="application/ld+json"> com o JSON escapado (ver jsonSeguro). */
export function JsonLd({ dados }: { dados: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonSeguro(dados) }} />;
}
