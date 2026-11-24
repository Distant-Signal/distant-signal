/** How long to wait for the service worker's update check before reloading
 * anyway, so a slow or offline check never leaves the button doing nothing. */
const UPDATE_WAIT_MS = 3000;

/** Reloads the page onto the newest build. First asks the service worker to
 * look for a new `sw.js` (`registration.update()`), so the worker's caches
 * move to the new build too. The reload itself is a navigation, which
 * `public/sw.js` always sends to the network, so the page comes from the new
 * build either way; the update check is for the caches, never required. */
export async function reloadForUpdate(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await Promise.race([
          registration.update().catch(() => undefined),
          new Promise<void>((resolve) => setTimeout(resolve, UPDATE_WAIT_MS)),
        ]);
      }
    }
  } catch {
    // Reload regardless.
  }
  window.location.reload();
}
