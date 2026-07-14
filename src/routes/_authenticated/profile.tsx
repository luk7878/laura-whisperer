import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { User, Shield, Bell, KeyRound, Trash2, Bot, Sparkles, LockKeyhole } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  birth_date: string | null;
  location: string | null;
  timezone: string | null;
  language: string | null;
  profile_visibility: "private" | "friends" | "public";
  share_progress: boolean;
  share_insights: boolean;
  allow_analytics: boolean;
  email_notifications: boolean;
  session_reminders: boolean;
  weekly_summary: boolean;
  goal_reminders: boolean;
  mentor_replies: boolean;
  marketing_emails: boolean;
  reminder_time: string | null;
};

type AgentSettings = {
  user_id: string;
  enabled: boolean;
  confirm_before_write: boolean;
  remember_goal_history: boolean;
  include_values_context: boolean;
};

type AgentEntitlement = {
  access_source: string;
  active: boolean;
  expires_at: string | null;
};

function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [agentSettings, setAgentSettings] = useState<AgentSettings | null>(null);
  const [agentEntitlement, setAgentEntitlement] = useState<AgentEntitlement | null>(null);
  const [savingAgent, setSavingAgent] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      setEmail(userData.user.email ?? "");
      const [{ data, error }, { data: settings }, { data: entitlement }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userData.user.id).maybeSingle(),
        supabase
          .from("agent_settings")
          .select(
            "user_id,enabled,confirm_before_write,remember_goal_history,include_values_context",
          )
          .eq("user_id", userData.user.id)
          .maybeSingle(),
        supabase
          .from("feature_entitlements")
          .select("access_source,active,expires_at")
          .eq("user_id", userData.user.id)
          .eq("feature_key", "growth_agent")
          .maybeSingle(),
      ]);
      if (error) toast.error(error.message);
      setAgentSettings(
        (settings as AgentSettings | null) ?? {
          user_id: userData.user.id,
          enabled: false,
          confirm_before_write: true,
          remember_goal_history: true,
          include_values_context: true,
        },
      );
      setAgentEntitlement((entitlement as AgentEntitlement | null) ?? null);
      if (data) setProfile(data as Profile);
      else {
        // create empty profile if missing
        const { data: created } = await supabase
          .from("profiles")
          .insert({ id: userData.user.id })
          .select("*")
          .single();
        setProfile(created as Profile);
      }
      setLoading(false);
    })();
  }, []);

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
  }

  async function save() {
    if (!profile) return;
    setSaving(true);
    const { id, ...patch } = profile;
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Išsaugota");
  }

  async function changePassword() {
    if (newPassword.length < 6) return toast.error("Slaptažodis per trumpas (min. 6 simb.)");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) toast.error(error.message);
    else {
      toast.success("Slaptažodis atnaujintas");
      setNewPassword("");
    }
  }

  function updateAgent<K extends keyof AgentSettings>(key: K, value: AgentSettings[K]) {
    setAgentSettings((settings) => (settings ? { ...settings, [key]: value } : settings));
  }

  async function saveAgentSettings() {
    if (!agentSettings || !agentEntitlement?.active) return;
    setSavingAgent(true);
    const { error } = await supabase.from("agent_settings").upsert(agentSettings);
    setSavingAgent(false);
    if (error) toast.error(error.message);
    else
      toast.success(agentSettings.enabled ? "Augimo agentas įjungtas" : "Augimo agentas išjungtas");
  }

  async function deleteAccount() {
    if (!profile) return;
    const { error } = await supabase.from("profiles").delete().eq("id", profile.id);
    if (error) return toast.error(error.message);
    await supabase.auth.signOut();
    toast.success("Paskyros duomenys ištrinti. Atsijungiama.");
    window.location.href = "/auth";
  }

  if (loading || !profile) {
    return (
      <div className="mx-auto max-w-4xl p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const initials = (profile.display_name || email || "AK").slice(0, 2).toUpperCase();

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="app-page-header">
        <SidebarTrigger className="shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-xl md:text-2xl leading-tight truncate">
            Profilis ir nustatymai
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground truncate">
            Duomenys, privatumas, pranešimai
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl p-3 md:p-6 space-y-4 md:space-y-6">
          <Tabs defaultValue="profile" className="space-y-4">
            <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
              <TabsTrigger value="profile" className="gap-1.5 shrink-0">
                <User className="h-4 w-4" /> <span className="hidden sm:inline">Profilis</span>
              </TabsTrigger>
              <TabsTrigger value="privacy" className="gap-1.5 shrink-0">
                <Shield className="h-4 w-4" /> <span className="hidden sm:inline">Privatumas</span>
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-1.5 shrink-0">
                <Bell className="h-4 w-4" /> <span className="hidden sm:inline">Pranešimai</span>
              </TabsTrigger>
              <TabsTrigger value="agent" className="gap-1.5 shrink-0">
                <Bot className="h-4 w-4" /> <span className="hidden sm:inline">Agentas</span>
              </TabsTrigger>
              <TabsTrigger value="account" className="gap-1.5 shrink-0">
                <KeyRound className="h-4 w-4" /> <span className="hidden sm:inline">Paskyra</span>
              </TabsTrigger>
            </TabsList>

            {/* PROFILE */}
            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle>Asmeninė informacija</CardTitle>
                  <CardDescription>
                    Ši informacija matoma tik tau, jei privatumas – privatus.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={profile.avatar_url ?? undefined} />
                      <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <Label>Nuotraukos nuoroda</Label>
                      <Input
                        placeholder="https://..."
                        value={profile.avatar_url ?? ""}
                        onChange={(e) => update("avatar_url", e.target.value || null)}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Vardas</Label>
                      <Input
                        value={profile.display_name ?? ""}
                        onChange={(e) => update("display_name", e.target.value)}
                        maxLength={100}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>El. paštas</Label>
                      <Input value={email} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label>Gimimo data</Label>
                      <Input
                        type="date"
                        value={profile.birth_date ?? ""}
                        onChange={(e) => update("birth_date", e.target.value || null)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Vieta</Label>
                      <Input
                        value={profile.location ?? ""}
                        onChange={(e) => update("location", e.target.value || null)}
                        maxLength={120}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Kalba</Label>
                      <Select
                        value={profile.language ?? "lt"}
                        onValueChange={(v) => update("language", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lt">Lietuvių</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Laiko juosta</Label>
                      <Input
                        value={profile.timezone ?? ""}
                        onChange={(e) => update("timezone", e.target.value || null)}
                        placeholder="Europe/Vilnius"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Apie mane</Label>
                    <Textarea
                      value={profile.bio ?? ""}
                      onChange={(e) => update("bio", e.target.value || null)}
                      rows={4}
                      maxLength={500}
                      placeholder="Trumpai apie tave, tavo tikslus, vertybes..."
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={save} disabled={saving}>
                      {saving ? "Saugoma..." : "Išsaugoti"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* PRIVACY */}
            <TabsContent value="privacy">
              <Card>
                <CardHeader>
                  <CardTitle>Privatumas</CardTitle>
                  <CardDescription>
                    Kontroliuok, kas mato tavo duomenis ir kaip jie naudojami.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label>Profilio matomumas</Label>
                    <Select
                      value={profile.profile_visibility}
                      onValueChange={(v) =>
                        update("profile_visibility", v as Profile["profile_visibility"])
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">Privatus – matai tik tu</SelectItem>
                        <SelectItem value="friends">Draugams – tik pakviestiems</SelectItem>
                        <SelectItem value="public">Viešas – matomas visiems</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <ToggleRow
                    label="Dalintis pažangos duomenimis"
                    desc="Anoniminiai pažangos rodikliai gali būti rodomi bendruomenei."
                    checked={profile.share_progress}
                    onChange={(v) => update("share_progress", v)}
                  />
                  <ToggleRow
                    label="Dalintis įžvalgomis"
                    desc="Sesijų įžvalgas gali matyti kiti pagal profilio matomumą."
                    checked={profile.share_insights}
                    onChange={(v) => update("share_insights", v)}
                  />
                  <ToggleRow
                    label="Leisti analitiką produktui gerinti"
                    desc="Anoniminė naudojimo statistika padeda tobulinti platformą."
                    checked={profile.allow_analytics}
                    onChange={(v) => update("allow_analytics", v)}
                  />

                  <div className="flex justify-end">
                    <Button onClick={save} disabled={saving}>
                      {saving ? "Saugoma..." : "Išsaugoti"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* NOTIFICATIONS */}
            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle>Pranešimai</CardTitle>
                  <CardDescription>Pasirink, kokius pranešimus nori gauti.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <ToggleRow
                    label="El. pašto pranešimai"
                    desc="Bendras jungiklis visiems el. laiškams."
                    checked={profile.email_notifications}
                    onChange={(v) => update("email_notifications", v)}
                  />
                  <Separator />
                  <ToggleRow
                    label="Sesijų priminimai"
                    desc="Priminti apie suplanuotas augimo sesijas."
                    checked={profile.session_reminders}
                    onChange={(v) => update("session_reminders", v)}
                  />
                  <ToggleRow
                    label="Savaitės santrauka"
                    desc="Kiekvieną sekmadienį – tavo savaitės apžvalga."
                    checked={profile.weekly_summary}
                    onChange={(v) => update("weekly_summary", v)}
                  />
                  <ToggleRow
                    label="Tikslų priminimai"
                    desc="Priminti apie besibaigiančius tikslų terminus."
                    checked={profile.goal_reminders}
                    onChange={(v) => update("goal_reminders", v)}
                  />
                  <ToggleRow
                    label="Mentoriaus atsakymai"
                    desc="Kai mentoris atsako į tavo klausimą."
                    checked={profile.mentor_replies}
                    onChange={(v) => update("mentor_replies", v)}
                  />
                  <ToggleRow
                    label="Rinkodaros laiškai"
                    desc="Naujienos, patarimai, pasiūlymai."
                    checked={profile.marketing_emails}
                    onChange={(v) => update("marketing_emails", v)}
                  />

                  <Separator />

                  <div className="space-y-2 max-w-xs">
                    <Label>Priminimų laikas</Label>
                    <Input
                      type="time"
                      value={(profile.reminder_time ?? "09:00:00").slice(0, 5)}
                      onChange={(e) => update("reminder_time", e.target.value + ":00")}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={save} disabled={saving}>
                      {saving ? "Saugoma..." : "Išsaugoti"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ACCOUNT */}
            <TabsContent value="agent">
              <div className="space-y-4">
                <Card className="overflow-hidden border-primary/20">
                  <div className="bg-gradient-to-br from-primary/10 via-background to-violet-500/5 p-5 md:p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                        <Bot className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-serif text-2xl">Asmeninis augimo agentas</h2>
                          {agentEntitlement?.active ? (
                            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              {agentEntitlement.access_source === "preview"
                                ? "Bandomoji prieiga"
                                : "Aktyvi prieiga"}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                              <LockKeyhole className="h-3 w-3" /> Reikalinga prenumerata
                            </span>
                          )}
                        </div>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                          Agentas galės prisiminti tikslų istoriją, planuoti dieną ir paruošti
                          tikslų bei prioritetų pakeitimus. Prieš keisdamas duomenis visada pateiks
                          aiškų veiksmų juodraštį.
                        </p>
                      </div>
                    </div>
                  </div>
                  <CardContent className="space-y-5 p-5 md:p-6">
                    {agentSettings && (
                      <>
                        <ToggleRow
                          label="Įjungti augimo agentą"
                          desc="Mentoriaus pokalbiuose leis ne tik atsakyti, bet ir paruošti veiksmus platformoje."
                          checked={agentSettings.enabled}
                          onChange={(value) => updateAgent("enabled", value)}
                          disabled={!agentEntitlement?.active}
                        />
                        <Separator />
                        <ToggleRow
                          label="Prieš pakeitimus prašyti patvirtinimo"
                          desc="Tikslai, prioritetai ir terminai nebus keičiami be tavo aiškaus sutikimo."
                          checked={agentSettings.confirm_before_write}
                          onChange={(value) => updateAgent("confirm_before_write", value)}
                          disabled={!agentSettings.enabled}
                        />
                        <ToggleRow
                          label="Naudoti tikslų istoriją"
                          desc="Aptikti panašius, anksčiau pradelstus ar nebaigtus tikslus."
                          checked={agentSettings.remember_goal_history}
                          onChange={(value) => updateAgent("remember_goal_history", value)}
                          disabled={!agentSettings.enabled}
                        />
                        <ToggleRow
                          label="Naudoti vertybių kontekstą"
                          desc="Patikrinti, ar siūlomi veiksmai palaiko tavo realią vertybių hierarchiją."
                          checked={agentSettings.include_values_context}
                          onChange={(value) => updateAgent("include_values_context", value)}
                          disabled={!agentSettings.enabled}
                        />
                        <div className="rounded-xl border bg-muted/30 p-4">
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            <Sparkles className="h-4 w-4 text-primary" /> Ką agentas galės daryti
                          </div>
                          <ul className="mt-2 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
                            <li>• Sudaryti realistišką dienos planą</li>
                            <li>• Rasti panašius ankstesnius tikslus</li>
                            <li>• Paruošti naują tikslą ar prioritetą</li>
                            <li>• Perspėti apie per didelę apkrovą</li>
                          </ul>
                        </div>
                        <div className="flex justify-end">
                          <Button
                            onClick={saveAgentSettings}
                            disabled={savingAgent || !agentEntitlement?.active}
                          >
                            {savingAgent ? "Saugoma…" : "Išsaugoti agento nustatymus"}
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ACCOUNT */}
            <TabsContent value="account">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Slaptažodis</CardTitle>
                    <CardDescription>Pakeisti prisijungimo slaptažodį.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2 max-w-md">
                      <Label>Naujas slaptažodis</Label>
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Bent 6 simboliai"
                      />
                    </div>
                    <Button onClick={changePassword} disabled={!newPassword}>
                      Pakeisti slaptažodį
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-destructive/40">
                  <CardHeader>
                    <CardTitle className="text-destructive">Pavojinga zona</CardTitle>
                    <CardDescription>Šie veiksmai negrįžtami.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="gap-2">
                          <Trash2 className="h-4 w-4" /> Ištrinti mano duomenis
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Ar tikrai nori ištrinti duomenis?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Bus ištrintas tavo profilis ir atsijungsi. Šio veiksmo atšaukti
                            negalima.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Atšaukti</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={deleteAccount}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Ištrinti
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
