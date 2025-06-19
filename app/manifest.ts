import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "T3 Chat",
    short_name: "T3 Chat",
    description: "Modern AI chat interface with all models.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f1fe",
    theme_color: "#4c0fd0",
    icons: [
      {
        src: "/icon512_rounded.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon512_maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
