import { Space_Grotesk } from "next/font/google";

// Matches the brand site (PROYECTO IA/WORLDWORK/WEB WORLDWORK/index.html):
// font-family 'Space Grotesk', font-weight 700, letter-spacing -2px, accent
// #2D5BFF with the same two-layer glow used on its "WORLDWORK" wordmark.
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: "700" });

export function WorldworkFooter() {
  return (
    <div className="shrink-0 py-2.5 text-center text-[11px] text-muted-foreground">
      Made by{" "}
      <span
        className={spaceGrotesk.className}
        style={{
          color: "#2D5BFF",
          letterSpacing: "-0.5px",
          textShadow: "0 0 14px rgba(45,91,255,0.55), 0 0 30px rgba(45,91,255,0.3)",
        }}
      >
        WORLDWORK
      </span>
    </div>
  );
}
