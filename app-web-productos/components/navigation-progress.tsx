"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function NavigationProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setActive(false), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const element = event.target as HTMLElement | null;
      const link = element?.closest("a");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) {
        return;
      }

      const destination = new URL(link.href, window.location.href);
      if (
        destination.origin === window.location.origin &&
        destination.href !== window.location.href
      ) {
        setActive(true);
      }
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 top-0 z-[11000] h-0.5 overflow-hidden transition-opacity ${
        active ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      aria-hidden="true"
    >
      <div className="navigation-progress h-full w-2/5 bg-[var(--primary)]" />
    </div>
  );
}
