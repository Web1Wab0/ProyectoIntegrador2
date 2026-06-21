import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AhorraPe",
    short_name: "AhorraPe",
    description: "Encuentra tiendas, compara productos y reserva para recoger.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f6f7",
    theme_color: "#7900f3",
    lang: "es-PE",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
