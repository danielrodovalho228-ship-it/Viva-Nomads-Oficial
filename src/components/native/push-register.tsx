"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { registrarPushToken } from "@/lib/data/push-actions";

/**
 * Registro de push — SÓ no app nativo (Capacitor); no-op na web (imports
 * dinâmicos, fora do bundle do servidor). Montado no layout do dashboard, então
 * só roda logado (token atrelado ao usuário) e a permissão é pedida DEPOIS do
 * login, nunca na abertura do app.
 *
 * Antes da caixa do sistema (Android 13+ POST_NOTIFICATIONS), mostramos uma frase
 * explicando o porquê — pedir "no vazio" derruba a taxa de aceite. O token é
 * guardado em localStorage para ser removido no logout (celular compartilhado).
 * Toque na notificação faz deep-link, mas só para rota INTERNA ("/...").
 */
const TOKEN_KEY = "vn-push-token";

/** Aceita só caminho interno ("/rota"), nunca "//" nem URL externa. */
function rotaInterna(u: unknown): string {
  return typeof u === "string" && u[0] === "/" && u[1] !== "/" && u[1] !== "\\" ? u : "/dashboard";
}

export function PushRegister() {
  const router = useRouter();
  const [precisaPermissao, setPrecisaPermissao] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor?.isNativePlatform?.()) return; // web: ignora

        const { PushNotifications } = await import("@capacitor/push-notifications");
        const perm = await PushNotifications.checkPermissions();
        if (cancelled) return;
        if (perm.receive === "granted") {
          await registrar();
        } else if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
          setPrecisaPermissao(true); // mostra a frase antes da caixa do sistema
        }
        // "denied": respeita a escolha; não insiste.
      } catch {
        /* plugin ausente / erro de bridge: silencioso */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function registrar() {
    const { Capacitor } = await import("@capacitor/core");
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const platform = Capacitor.getPlatform() === "ios" ? "ios" : "android";

    await PushNotifications.addListener("registration", (t) => {
      try {
        localStorage.setItem(TOKEN_KEY, t.value);
      } catch {
        /* localStorage indisponível: segue sem guardar */
      }
      registrarPushToken(t.value, platform).catch(() => {});
    });
    // Toque na notificação → deep-link SÓ para rota interna.
    await PushNotifications.addListener("pushNotificationActionPerformed", (ev) => {
      const url = rotaInterna(ev.notification?.data?.url);
      router.push(url);
    });
    await PushNotifications.register();
  }

  async function ativar() {
    setOcupado(true);
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const perm = await PushNotifications.requestPermissions();
      if (perm.receive === "granted") await registrar();
    } catch {
      /* silencioso */
    } finally {
      setPrecisaPermissao(false);
      setOcupado(false);
    }
  }

  if (!precisaPermissao) return null;

  return (
    <div
      role="dialog"
      aria-label="Ativar avisos"
      className="fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-sage-200 bg-white p-4 shadow-lg"
      style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <p className="text-sm font-semibold text-ink">Ativar avisos?</p>
      <p className="mt-1 text-sm text-muted">
        Receba um aviso quando chegar um novo interessado, uma resposta ou uma mensagem — para não
        perder nada na hora certa.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setPrecisaPermissao(false)}
          className="flex-1 rounded-xl border border-sage-200 px-3 py-2.5 text-sm font-medium text-muted"
        >
          Agora não
        </button>
        <button
          type="button"
          onClick={ativar}
          disabled={ocupado}
          className="flex-1 rounded-xl bg-forest px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          Ativar avisos
        </button>
      </div>
    </div>
  );
}
