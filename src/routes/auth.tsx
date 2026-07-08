import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Sparkles, KeyRound } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//") ? s.next : undefined,
  }),
  component: AuthPage,
});

const INVITE_KEY = "pending_invite_code";

function AuthPage() {
  const { next } = Route.useSearch();
  const target = next ?? "/session";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      // Consume any pending invite code after OAuth redirect
      const pending = sessionStorage.getItem(INVITE_KEY);
      if (pending) {
        try {
          await supabase.rpc("consume_invite_code", { _code: pending });
        } catch {}
        sessionStorage.removeItem(INVITE_KEY);
      }
      window.location.href = target;
    });
  }, [target]);

  async function requireValidInvite(): Promise<boolean> {
    const code = invite.trim();
    if (!code) {
      toast.error("Įveskite pakvietimo kodą");
      return false;
    }
    const { data, error } = await supabase.rpc("validate_invite_code", { _code: code });
    if (error || !data) {
      toast.error("Neteisingas arba nebegaliojantis pakvietimo kodas");
      return false;
    }
    return true;
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!(await requireValidInvite())) return;
        const code = invite.trim();
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + target },
        });
        if (error) throw error;
        // Consume for the newly-signed-in session (if auto-confirmed) or remember for confirm redirect
        const { data: s } = await supabase.auth.getSession();
        if (s.session) {
          await supabase.rpc("consume_invite_code", { _code: code });
        } else {
          sessionStorage.setItem(INVITE_KEY, code);
        }
        toast.success("Paskyra sukurta.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = target;
      }
    } catch (err: any) {
      toast.error(err.message ?? "Klaida");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      // For both new signups and returning users through Google we require an invite
      // for now (closed beta). Returning users can also just log in via email.
      if (!(await requireValidInvite())) {
        setBusy(false);
        return;
      }
      sessionStorage.setItem(INVITE_KEY, invite.trim());
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + target,
      });
      if (result.error) {
        sessionStorage.removeItem(INVITE_KEY);
        toast.error(result.error.message ?? "Google prisijungimo klaida");
        setBusy(false);
        return;
      }
      if (result.redirected) return;
      // Fallback: session set directly
      const pending = sessionStorage.getItem(INVITE_KEY);
      if (pending) {
        await supabase.rpc("consume_invite_code", { _code: pending });
        sessionStorage.removeItem(INVITE_KEY);
      }
      window.location.href = target;
    } catch (err: any) {
      toast.error(err.message ?? "Klaida");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <Card className="w-full max-w-md border-border/50 shadow-xl">
        <CardHeader className="text-center">
          <Link to="/" className="mx-auto mb-2 flex items-center gap-2 text-primary">
            <Sparkles className="h-6 w-6" />
            <span className="font-semibold">Augimo Kompasas AI</span>
          </Link>
          <CardTitle>{mode === "signin" ? "Prisijungimas" : "Registracija"}</CardTitle>
          <CardDescription>
            {mode === "signin"
              ? "Prisijunkite prie savo augimo kelio"
              : "Reikalingas pakvietimo kodas"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(mode === "signup") && (
            <div className="space-y-1">
              <Label htmlFor="invite" className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" /> Pakvietimo kodas
              </Label>
              <Input
                id="invite"
                value={invite}
                onChange={(e) => setInvite(e.target.value)}
                placeholder="Įveskite gautą kodą"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Registracija šiuo metu ribota. Pakvietimo kodo klauskite administratoriaus.
              </p>
            </div>
          )}

          {mode === "signup" && (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogle}
                disabled={busy}
              >
                Tęsti su Google
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">arba el. paštu</span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleEmail} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="email">El. paštas</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Slaptažodis</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {mode === "signin" ? "Prisijungti" : "Registruotis"}
            </Button>
          </form>

          {mode === "signin" && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={async () => {
                // Google sign-in for existing users — also requires invite for now.
                setMode("signup");
                toast.info("Google prisijungimui reikalingas pakvietimo kodas");
              }}
              disabled={busy}
            >
              Tęsti su Google
            </Button>
          )}

          <button
            type="button"
            className="w-full text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Neturite paskyros? Registruokitės" : "Jau turite paskyrą? Prisijunkite"}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
