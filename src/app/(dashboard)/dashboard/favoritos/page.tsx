import { PageTitle } from "@/components/dashboard/primitives";
import { PropertyCard } from "@/components/property-card";
import { SAMPLE_PROPERTIES } from "@/lib/properties";

export default function FavoritesPage() {
  const favorites = SAMPLE_PROPERTIES.slice(0, 2);

  return (
    <>
      <PageTitle
        title="Favoritos"
        subtitle="Imóveis que você salvou para comparar depois."
      />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {favorites.map((p) => (
          <PropertyCard key={p.id} property={p} />
        ))}
      </div>
    </>
  );
}
