export type ToastLevel = "error" | "success" | "info";

let lastToastMessage = "";
let lastToastAt = 0;

export function showToast(message: string, level: ToastLevel = "info"): void {
  const text = message?.trim();
  if (!text) return;

  const now = Date.now();
  if (text === lastToastMessage && now - lastToastAt < 800) return;

  lastToastMessage = text;
  lastToastAt = now;

  window.dispatchEvent(
    new CustomEvent("hermes-toast", {
      detail: { message: text, level },
    }),
  );
}

export function toastAction(action: string, target?: string, level: ToastLevel = "success"): void {
  const a = action?.trim();
  const t = target?.trim();
  if (!a) return;
  showToast(t ? `${a} • ${t}` : a, level);
}
