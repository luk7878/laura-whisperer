import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { validateInviteCode, consumeInviteCode } from "@/lib/invite.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { KeyRound, ArrowLeft, Mail, LockKeyhole, Compass, ShieldCheck, BrainCircuit } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    next:
      typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//")
        ? s.next
        : undefined,
    mode: s.mode === "recovery" ? ("recovery" as const) : undefined,
  }),
  component: AuthPage,
});

const INVITE_KEY = "pending_invite_code";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function AuthPage() {
  const { next, mode: requestedMode } = Route.useSearch();
  const target = next ?? "/session";
  const validate = useServerFn(validateInviteCode);
  const consume = useServerFn(consumeInviteCode);
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "recovery">(
    requestedMode === "recovery" ? "recovery" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [invite, setInvite] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const isRecovery =
      requestedMode === "recovery" || window.location.hash.includes("type=recovery");
    if (isRecovery) setMode("recovery");

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("recovery");
    });

    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      if (isRecovery) return;
      // Consume any pending invite code after OAuth redirect
      const pending = sessionStorage.getItem(INVITE_KEY);
      if (pending) {
        try {
          await consume({ data: { code: pending } });
        } catch {
          // Invite consumption can be retried after the next sign-in.
        }
        sessionStorage.removeItem(INVITE_KEY);
      }
      window.location.href = target;
    });
    return () => authListener.subscription.unsubscribe();
  }, [consume, target, requestedMode]);

  async function requireValidInvite(): Promise<boolean> {
    const code = invite.trim();
    if (!code) {
      toast.error("Įveskite pakvietimo kodą");
      return false;
    }
    try {
      const res = await validate({ data: { code } });
      if (!res.valid) {
        toast.error("Neteisingas arba nebegaliojantis pakvietimo kodas");
        return false;
      }
      return true;
    } catch {
      toast.error("Nepavyko patikrinti pakvietimo kodo");
      return false;
    }
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
          await consume({ data: { code } });
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
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Klaida"));
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
        await consume({ data: { code: pending } });
        sessionStorage.removeItem(INVITE_KEY);
      }
      window.location.href = target;
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Klaida"));
      setBusy(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth?mode=recovery`,
      });
      if (error) throw error;
      toast.success("Slaptažodžio atkūrimo nuoroda išsiųsta el. paštu");
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Nepavyko išsiųsti atkūrimo laiško"));
    } finally {
      setBusy(false);
    }
  }

  async function handleNewPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("Slaptažodį turi sudaryti bent 8 simboliai");
    if (password !== passwordConfirm) return toast.error("Slaptažodžiai nesutampa");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Slaptažodis sėkmingai pakeistas");
      window.history.replaceState(null, "", "/auth");
      window.location.href = target;
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Nepavyko pakeisti slaptažodžio"));
    } finally {
      setBusy(false);
    }
  }

  const heading = {
    signin: "Prisijungimas",
    signup: "Registracija",
    forgot: "Atkurti slaptažodį",
    recovery: "Naujas slaptažodis",
  }[mode];

  const description = {
    signin: "Prisijunkite prie savo augimo kelio",
    signup: "Reikalingas pakvietimo kodas",
    forgot: "Įveskite el. paštą ir atsiųsime saugią atkūrimo nuorodą",
    recovery: "Sukurkite naują, saugų paskyros slaptažodį",
  }[mode];

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-background p-4 md:p-8">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -right-36 h-[32rem] w-[32rem] rounded-full bg-map-violet/10 blur-3xl" />
      <div className="relative mx-auto grid min-h-[calc(100dvh-2rem)] w-full max-w-5xl items-stretch overflow-hidden rounded-[2rem] border border-white/80 bg-card/70 shadow-[0_35px_100px_-42px_oklch(0.2_0.1_270_/_0.65)] backdrop-blur-xl md:min-h-[calc(100dvh-4rem)] md:grid-cols-[1.05fr_0.95fr]">
        <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-primary to-map-violet p-10 text-primary-foreground md:flex md:flex-col md:justify-between lg:p-14">
          <div className="absolute -right-32 -top-28 h-96 w-96 rounded-full border border-white/15 bg-white/[0.06]" />
          <div className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full border border-white/10 bg-white/[0.05]" />
          <Link to="/" className="relative flex items-center gap-3 text-white">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur">
              <Compass className="h-5 w-5" />
            </span>
            <span className="font-serif text-2xl">Augimo Kompasas</span>
          </Link>
          <div className="relative max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/65">Tavo asmeninė augimo erdvė</p>
            <h1 className="mt-4 font-serif text-5xl leading-[1.03] tracking-tight lg:text-6xl">Aiškumas prasideda nuo vieno tikro klausimo.</h1>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/72">Sugrįžk prie savo sesijų, įžvalgų ir tikslų. Visa tavo augimo istorija — saugioje, ramioje erdvėje.</p>
          </div>
          <div className="relative grid gap-3 text-sm text-white/80">
            <div className="flex items-center gap-3"><BrainCircuit className="h-4 w-4" /> AI mentorius su tavo kontekstu</div>
            <div className="flex items-center gap-3"><ShieldCheck className="h-4 w-4" /> Privati ir saugi refleksijos erdvė</div>
          </div>
        </aside>
        <div className="flex items-center justify-center p-4 sm:p-8 lg:p-12">
      <Card className="w-full max-w-md border-0 bg-transparent shadow-none backdrop-blur-none">
        <CardHeader className="text-center">
          <Link to="/" className="mx-auto mb-3 flex items-center gap-2 text-primary md:hidden">
            <Compass className="h-6 w-6" />
            <span className="font-serif text-xl">Augimo Kompasas</span>
          </Link>
          <CardTitle>{heading}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === "forgot" && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Mail className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="recovery-email">El. paštas</Label>
                <Input
                  id="recovery-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vardas@pastas.lt"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                Siųsti atkūrimo nuorodą
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full gap-2"
                onClick={() => setMode("signin")}
              >
                <ArrowLeft className="h-4 w-4" /> Grįžti į prisijungimą
              </Button>
            </form>
          )}

          {mode === "recovery" && (
            <form onSubmit={handleNewPassword} className="space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-password">Naujas slaptažodis</Label>
                <Input
                  id="new-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-password-confirm">Pakartokite slaptažodį</Label>
                <Input
                  id="new-password-confirm"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Naudokite bent 8 simbolius ir nesirinkite anksčiau naudoto slaptažodžio.
              </p>
              <Button type="submit" className="w-full" disabled={busy}>
                Išsaugoti naują slaptažodį
              </Button>
            </form>
          )}

          {(mode === "signin" || mode === "signup") && (
            <>
              {mode === "signup" && (
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
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="password">Slaptažodis</Label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        className="text-xs font-medium text-primary hover:underline"
                        onClick={() => setMode("forgot")}
                      >
                        Pamiršote slaptažodį?
                      </button>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
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
                {mode === "signin"
                  ? "Neturite paskyros? Registruokitės"
                  : "Jau turite paskyrą? Prisijunkite"}
              </button>
            </>
          )}
        </CardContent>
      </Card>
        </div>
      </div>
    </div>
  );
}
