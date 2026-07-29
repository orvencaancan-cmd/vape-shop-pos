import type { MetadataRoute } from "next";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  // Reading the session here (via cookies) makes this manifest
  // request-time/dynamic rather than statically cached, which is what
  // lets a logged-in shop's own logo become their "Add to Home Screen"
  // icon instead of everyone getting the same default icon.
  const profile = await getCurrentProfile();

  const name = profile?.shop.name ?? "VapeStock";
  const themeColor = profile?.shop.primaryColor || "#1f5c96";

  const logoType = (() => {
    const ext = profile?.shop.logoUrl?.split("?")[0].split(".").pop()?.toLowerCase();
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "webp") return "image/webp";
    return "image/png";
  })();

  // Chrome's Android installability check requires an actual raster icon
  // (PNG/JPG/WebP) with explicit "192x192" and "512x512" sizes -- an
  // SVG-only icon with sizes="any" doesn't satisfy it, which silently
  // blocks "Add to Home Screen" from producing a real installed app.
  const icons: MetadataRoute.Manifest["icons"] = profile?.shop.logoUrl
    ? [
        { src: profile.shop.logoUrl, sizes: "192x192", type: logoType },
        { src: profile.shop.logoUrl, sizes: "512x512", type: logoType },
      ]
    : [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        {
          src: "/icon-512-maskable.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ];

  return {
    name: `${name} — POS & Inventory`,
    short_name: name,
    description: "Point of sale and inventory management.",
    start_url: profile ? "/sell" : "/",
    display: "standalone",
    background_color: "#f6f8fa",
    theme_color: themeColor,
    icons,
  };
}
