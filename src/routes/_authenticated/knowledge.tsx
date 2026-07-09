import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Library, Upload, FileText, Trash2, Loader2, Plus, MessageSquare, RefreshCw, Tag } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { extractText } from "@/lib/knowledge-parse";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/knowledge")({
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw redirect({ to: "/ask" });
  },
  component: KnowledgePage,
});

type Doc = {
  id: string;
  title: string;
  source_type: string;
  chunk_count: number;
  byte_size: number | null;
  status: string;
  error: string | null;
  created_at: string;
  language: string | null;
  tags: string[] | null;
};

function KnowledgePage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [reindexing, setReindexing] = useState<string | null>(null);
  const [editingTags, setEditingTags] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("knowledge_documents")
      .select("id, title, source_type, chunk_count, byte_size, status, error, created_at, language, tags")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setDocs((data as Doc[]) ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function ingest(payload: {
    title: string;
    text: string;
    source_type: string;
    file_path?: string | null;
    byte_size?: number | null;
  }) {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) throw new Error("Nesi prisijungęs");
    const resp = await fetch("/api/knowledge-ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) throw new Error(await resp.text().catch(() => "Nepavyko"));
    return resp.json();
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      try {
        toast.message(`Skaitau: ${file.name}`);
        const text = await extractText(file);
        if (!text.trim()) {
          toast.error(`${file.name}: nepavyko ištraukti teksto`);
          continue;
        }
        // upload original to storage (optional; keeps source)
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        let filePath: string | null = null;
        if (uid) {
          const key = `${uid}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          const up = await supabase.storage.from("knowledge").upload(key, file, {
            upsert: false,
            contentType: file.type || undefined,
          });
          if (!up.error) filePath = key;
        }
        toast.message(`Skaidau ir kuriu embeddings: ${file.name}`);
        const res = await ingest({
          title: file.name.replace(/\.[^.]+$/, ""),
          text,
          source_type: file.type || file.name.split(".").pop() || "file",
          file_path: filePath,
          byte_size: file.size,
        });
        toast.success(`${file.name}: ${res.chunks} gabalų`);
        ok++;
      } catch (e: unknown) {
        toast.error(`${file.name}: ${e instanceof Error ? e.message : "klaida"}`);
      }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (ok > 0) load();
  }

  async function submitPaste() {
    if (!pasteText.trim()) return toast.error("Įklijuok tekstą");
    setUploading(true);
    try {
      const res = await ingest({
        title: pasteTitle.trim() || "Įrašas",
        text: pasteText,
        source_type: "text",
      });
      toast.success(`Įrašyta: ${res.chunks} gabalų`);
      setPasteText("");
      setPasteTitle("");
      setPasteOpen(false);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Nepavyko");
    } finally {
      setUploading(false);
    }
  }

  async function remove(doc: Doc) {
    if (!confirm(`Ištrinti „${doc.title}"?`)) return;
    const { error } = await supabase.from("knowledge_documents").delete().eq("id", doc.id);
    if (error) return toast.error(error.message);
    toast.success("Ištrinta");
    load();
  }

  async function reindex(doc: Doc) {
    setReindexing(doc.id);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Nesi prisijungęs");
      const resp = await fetch("/api/knowledge-reindex", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ document_id: doc.id }),
      });
      if (!resp.ok) throw new Error(await resp.text().catch(() => "Nepavyko"));
      const res = await resp.json();
      toast.success(`Perindeksuota: ${res.chunks} gabalų`);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Nepavyko");
    } finally {
      setReindexing(null);
    }
  }

  async function saveTags(doc: Doc) {
    const tags = tagDraft
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12);
    const { error } = await supabase
      .from("knowledge_documents")
      .update({ tags })
      .eq("id", doc.id);
    if (error) return toast.error(error.message);
    setEditingTags(null);
    setTagDraft("");
    load();
  }

  const totalChunks = docs.reduce((s, d) => s + (d.chunk_count ?? 0), 0);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <header className="border-b bg-background/80 backdrop-blur px-6 py-4 flex items-start gap-3">
        <SidebarTrigger className="mt-1" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <Library className="h-6 w-6 text-primary" />
            <h1 className="font-serif text-3xl leading-tight">Žinių bazė</h1>
            <Badge variant="secondary">
              {docs.length} dok. · {totalChunks} gabalų
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Įkelk knygas, straipsnius, konspektus. Mentorius atsakinės iš šių šaltinių su citatomis.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link to="/ask">
            <MessageSquare className="h-3.5 w-3.5" /> Greitas Q&amp;A
          </Link>
        </Button>
      </header>

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Upload className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-serif text-xl">Įkelk failus</h3>
              <p className="text-sm text-muted-foreground mt-1">
                .txt, .md, .pdf, .docx – iki 20 MB. Skaidoma ir indeksuojama automatiškai.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept=".txt,.md,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => onFiles(e.target.files)}
                />
                <Button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="gap-2"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Pasirinkti failus
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPasteOpen((v) => !v)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" /> Įklijuoti tekstą
                </Button>
              </div>
              {pasteOpen && (
                <div className="mt-4 space-y-3 rounded-lg border p-4 bg-muted/30">
                  <Input
                    placeholder='Pavadinimas (pvz. „Demartini – vertybės“)'
                    value={pasteTitle}
                    onChange={(e) => setPasteTitle(e.target.value)}
                  />
                  <Textarea
                    placeholder="Įklijuok citatas, ištraukas, konspektus…"
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    rows={8}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setPasteOpen(false)}>
                      Atšaukti
                    </Button>
                    <Button size="sm" onClick={submitPaste} disabled={uploading}>
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Įrašyti"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        <div>
          <h2 className="font-serif text-xl mb-3">Įkelti šaltiniai</h2>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Kraunama…
            </div>
          ) : docs.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Dar nieko neįkelta. Įkelk pirmą failą arba įklijuok tekstą aukščiau.
            </Card>
          ) : (
            <div className="space-y-2">
              {docs.map((d) => (
                <Card key={d.id} className="p-4 flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{d.title}</span>
                      <StatusBadge status={d.status} />
                      {d.language && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted uppercase tracking-wide">
                          {d.language}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {d.chunk_count} gabalų
                        {d.byte_size ? ` · ${(d.byte_size / 1024).toFixed(1)} KB` : ""}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      {editingTags === d.id ? (
                        <>
                          <Input
                            autoFocus
                            value={tagDraft}
                            onChange={(e) => setTagDraft(e.target.value)}
                            placeholder="tag1, tag2, tag3"
                            className="h-7 text-xs max-w-xs"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveTags(d);
                              if (e.key === "Escape") {
                                setEditingTags(null);
                                setTagDraft("");
                              }
                            }}
                          />
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => saveTags(d)}>
                            Išsaugoti
                          </Button>
                        </>
                      ) : (
                        <>
                          {(d.tags ?? []).map((t) => (
                            <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">
                              {t}
                            </Badge>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTags(d.id);
                              setTagDraft((d.tags ?? []).join(", "));
                            }}
                            className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                          >
                            <Tag className="h-3 w-3" />
                            {(d.tags ?? []).length === 0 ? "Pridėti žymes" : "Redaguoti"}
                          </button>
                        </>
                      )}
                    </div>
                    {d.error && (
                      <p className="text-xs text-destructive mt-1 truncate">{d.error}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => reindex(d)}
                    disabled={reindexing === d.id}
                    title="Perindeksuoti su nauju valymu"
                  >
                    {reindexing === d.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(d)} title="Ištrinti">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    ready: { label: "Paruošta", className: "bg-map-green/20 text-map-green" },
    processing: { label: "Apdorojama", className: "bg-map-orange/20 text-map-orange" },
    error: { label: "Klaida", className: "bg-destructive/20 text-destructive" },
    empty: { label: "Tuščia", className: "bg-muted text-muted-foreground" },
  };
  const m = map[status] ?? { label: status, className: "bg-muted" };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded ${m.className}`}>{m.label}</span>;
}
