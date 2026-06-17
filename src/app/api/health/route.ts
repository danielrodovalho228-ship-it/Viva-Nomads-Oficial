import { NextResponse } from "next/server";
import { isAsaasConfigured } from "@/lib/payments/asaas";
import { isCafConfigured } from "@/lib/integrations/caf";
import { isZapsignConfigured } from "@/lib/integrations/zapsign";
import { isPlacesConfigured } from "@/lib/integrations/places";
import { isNfseConfigured } from "@/lib/integrations/nfse";
import { isEmailConfigured, isWhatsappConfigured } from "@/lib/notifications";

/** Health-check da API — útil para uptime e para o futuro app validar conexão. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "viva-nomads",
    time: new Date().toISOString(),
    integrations: {
      supabase:
        !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      asaas: isAsaasConfigured(),
      mapbox: !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
      google_places: isPlacesConfigured(),
      caf: isCafConfigured(),
      zapsign: isZapsignConfigured(),
      nfse: isNfseConfigured(),
      email: isEmailConfigured(),
      whatsapp: isWhatsappConfigured(),
    },
  });
}
