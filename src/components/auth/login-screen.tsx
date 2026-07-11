"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { dataProvider } from "@/lib/data";
import type { Business } from "@/lib/data";
import { isAdminCredentials } from "@/lib/auth/admin";
import { useThemeToggle } from "@/hooks/use-theme-toggle";
import { WorldworkFooter } from "@/components/worldwork-footer";

export function LoginScreen({
  onSuccess,
  onAdminSuccess,
}: {
  onSuccess: (business: Business) => void;
  onAdminSuccess: () => void;
}) {
  const [negocio, setNegocio] = useState("");
  const [usuario, setUsuario] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isDark, toggle: toggleTheme, mounted: themeMounted } = useThemeToggle();

  const canSubmit = negocio.trim().length > 0 && usuario.trim().length > 0 && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      if (isAdminCredentials(negocio, usuario)) {
        onAdminSuccess();
        return;
      }
      const businesses = await dataProvider.listBusinesses();
      const match = businesses.find(
        (b) =>
          b.name.trim().toLowerCase() === negocio.trim().toLowerCase() &&
          b.username.trim().toLowerCase() === usuario.trim().toLowerCase()
      );
      if (!match) {
        setError("Negocio o usuario no encontrados");
        return;
      }
      onSuccess(match);
    } catch {
      setError("No se pudo conectar con la hoja de negocios. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex h-dvh w-full flex-col items-center justify-center bg-canvas px-6">
      {themeMounted && (
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
          className="safe-top absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors duration-150 active:bg-accent"
        >
          {isDark ? (
            <Sun className="size-[18px]" strokeWidth={2} />
          ) : (
            <Moon className="size-[18px]" strokeWidth={2} />
          )}
        </button>
      )}

      <div className="w-full max-w-xs">
        <div className="mb-8 text-center">
          <h1 className="text-[22px] font-semibold tracking-tight">Agenda</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Inicia sesión con tu negocio
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="rounded-2xl bg-secondary overflow-hidden divide-y divide-border/60">
            <Input
              value={negocio}
              onChange={(e) => setNegocio(e.target.value)}
              placeholder="Negocio"
              className="h-12 text-[16px] rounded-none bg-transparent border-0 px-4"
              autoComplete="off"
              enterKeyHint="next"
            />
            <Input
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="Usuario"
              className="h-12 text-[16px] rounded-none bg-transparent border-0 px-4"
              autoComplete="off"
              enterKeyHint="done"
            />
          </div>

          {error && <p className="px-1 text-[13px] text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              "mt-2 rounded-2xl text-[16px] font-semibold transition-all duration-150 active:scale-[0.985]",
              canSubmit
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground"
            )}
            style={{ height: 52 }}
          >
            {loading ? "Comprobando…" : "Iniciar sesión"}
          </button>
        </form>
      </div>

      <div className="safe-bottom absolute bottom-0 left-0 right-0">
        <WorldworkFooter />
      </div>
    </div>
  );
}
