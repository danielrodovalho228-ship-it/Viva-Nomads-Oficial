import { NextResponse } from "next/server";
import { isAsaasConfigured } from "@/lib/payments/asaas";
import { isCafConfigured } from "@/lib/integrations/caf";
import { isZapsignConfigured } from "@/lib/integrations/zapsign";
import { isPlacesConfigured } from "@/lib/integrations/places";
import { isNfseConfigured } from "@/lib/integrations/nfse";
import { isEmailConfigured, isWhatsappConfigured } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/data/admin-guard";

/**
 * Health-check da API — útil para uptime e para o app validar conexão.
 * Público: só "ok". A lista de integrações ligadas/desligadas é mapa para quem
 * quer atacar — aparece só para ADMIN logado.
 */
export async function GET() {
  const base = { ok: true, service: "viva-nomads", time: new Date().toISOString() };
  if (!(await souAdmin())) return NextResponse.json(base);
  return NextResponse.json({
    ...base,
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
      // Exclusão pública de conta (assina o HMAC do link + apaga/anonimiza):
      // depende do SERVICE ROLE. Falso aqui = fluxo público indisponível.
      account_deletion:
        !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  });
}

async function souAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient();
    if (!supabase) return false;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return !!user && (await ehAdmin(supabase, user.id));
  } catch {
    return false;
  }
}
