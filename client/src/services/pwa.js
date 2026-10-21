// Register only production builds on secure origins; never cache private CRM data.
export function registerPwa(onUpdate) {
  if (
    process.env.NODE_ENV !== "production" ||
    !window.isSecureContext ||
    !("serviceWorker" in navigator)
  )
    return () => {};
  let disposed = false;
  let registration;
  let installing;
  const ready = () => {
    if (!disposed && registration.waiting && navigator.serviceWorker.controller)
      onUpdate(registration.waiting);
  };
  const stateChange = () => {
    if (installing?.state === "installed") ready();
  };
  const updateFound = () => {
    installing?.removeEventListener("statechange", stateChange);
    installing = registration.installing;
    installing?.addEventListener("statechange", stateChange);
  };
  const check = () => {
    if (document.visibilityState === "visible" && navigator.onLine !== false)
      registration?.update().catch(() => {});
  };
  const register = async () => {
    try {
      registration = await navigator.serviceWorker.register(
        "/service-worker.js",
        { updateViaCache: "none" },
      );
      if (disposed) return;
      ready();
      updateFound();
      registration.addEventListener("updatefound", updateFound);
      document.addEventListener("visibilitychange", check);
      window.addEventListener("online", check);
    } catch {
      // A failed installation must not prevent normal browser use.
    }
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
  return () => {
    disposed = true;
    window.removeEventListener("load", register);
    window.removeEventListener("online", check);
    document.removeEventListener("visibilitychange", check);
    registration?.removeEventListener("updatefound", updateFound);
    installing?.removeEventListener("statechange", stateChange);
  };
}
