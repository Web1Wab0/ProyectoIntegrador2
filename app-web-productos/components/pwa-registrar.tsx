"use client";

import { useEffect } from "react";

export default function PwaRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("No se pudo registrar el service worker.", error);
    });
  }, []);

  return null;
}
