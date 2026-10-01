"use client";

import { useEffect } from "react";
import { registrarPushToken } from "@/lib/data/push-actions";

/**
 * Registra o dispositivo para notificações push — SÓ no app nativo (Capacitor).
 * Na web é um no-op. Os imports do Capacitor são dinâmicos para não entrarem no
 * bundle do servidor nem quebrarem o build web. Montado no layout do dashboard,
 * então só roda para usuários logados (o token fica atrelado ao usuário).
 */
export function PushRegister() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor?.isNativePlatform?.()) return; // web: ignora

        const { PushNotifications } = await import("@capacitor/push-notifications");
        const platform = Capacitor.getPlatform() === "ios" ? "ios" : "android";

        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
          perm = await PushNotifications.requestPermissions();
        }
        if (perm.receive !== "granted") return; // usuário recusou

        await PushNotifications.addListener("registration", (t) => {
          if (!cancelled) registrarPushToken(t.value, platform).catch(() => {});
        });
        await PushNotifications.register();
      } catch {
        // Plugin ausente (web) ou erro de bridge: silencioso, não afeta a UI.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
