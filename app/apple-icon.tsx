import { ImageResponse } from "next/og";

// Raster app icon (PNG). Next renders this at build/runtime — no local
// rasterizer needed. Served at /apple-icon; also a clean square logo to upload
// as the GitHub OAuth App logo (raster required there).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d7a5a",
          color: "#ffffff",
          fontSize: 120,
          fontWeight: 700,
          fontFamily: "sans-serif",
          borderRadius: 40,
        }}
      >
        A
      </div>
    ),
    size,
  );
}
