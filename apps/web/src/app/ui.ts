// Small shared UI helpers.

let toastTimer: ReturnType<typeof setTimeout> | undefined;
/**
 * A short note at the bottom of the screen. `detail` is a second, quieter line; `action` a button that runs once and
 * closes the toast ("Add its address", "Undo"), which stays up longer so there's time to reach it.
 */
export function showToast(
  msg: string,
  options: { detail?: string; action?: { label: string; run: () => void } } = {}
): void {
  const banner = document.getElementById('toastBanner');
  const message = document.getElementById('toastMessage');
  if (!banner || !message) return;
  message.textContent = msg;
  const detail = document.getElementById('toastDetail');
  if (detail) {
    detail.textContent = options.detail ?? '';
    detail.classList.toggle('hidden', !options.detail);
  }
  const button = document.getElementById('toastAction');
  const hide = () => {
    banner.classList.add('hidden');
    banner.classList.remove('flex');
  };
  if (button) {
    button.textContent = options.action?.label ?? '';
    button.classList.toggle('hidden', !options.action);
    button.onclick = options.action
      ? () => {
          hide();
          options.action?.run();
        }
      : null;
  }
  banner.classList.remove('hidden');
  banner.classList.add('flex');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hide, options.action ? 7000 : 3000);
}

export function haptic(pattern: number | number[] = 12): void {
  if ('vibrate' in navigator) navigator.vibrate(pattern); // Android; iOS Safari has no vibrate()
}
