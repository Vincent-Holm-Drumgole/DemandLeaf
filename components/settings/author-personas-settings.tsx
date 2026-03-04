"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Plus, Star } from "lucide-react";

interface Persona {
  id: string;
  name: string;
  jobTitle: string | null;
  bio: string | null;
  expertiseAreas: string[];
  isDefault: boolean;
}

export function AuthorPersonasSettings() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [operatingId, setOperatingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [bio, setBio] = useState("");
  const [expertise, setExpertise] = useState("");

  async function loadPersonas() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/author-personas");
      if (res.ok) {
        setPersonas(await res.json());
      } else {
        setError("Failed to load author personas");
      }
    } catch {
      setError("Failed to load author personas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPersonas();
  }, []);

  async function handleAdd() {
    if (!name) return;
    setAdding(true);
    try {
      const res = await fetch("/api/author-personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          jobTitle: jobTitle || undefined,
          bio: bio || undefined,
          expertiseAreas: expertise
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          isDefault: personas.length === 0,
        }),
      });
      if (res.ok) {
        setName("");
        setJobTitle("");
        setBio("");
        setExpertise("");
        setShowForm(false);
        await loadPersonas();
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleSetDefault(id: string) {
    setOperatingId(id);
    try {
      const res = await fetch(`/api/author-personas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) {
        setError("Failed to set default persona");
      }
      await loadPersonas();
    } catch {
      setError("Failed to set default persona");
    } finally {
      setOperatingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this author persona? This cannot be undone.")) return;
    setOperatingId(id);
    try {
      const res = await fetch(`/api/author-personas/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Failed to delete persona");
      }
      await loadPersonas();
    } catch {
      setError("Failed to delete persona");
    } finally {
      setOperatingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading author personas...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      {personas.length === 0 && !showForm && !error && (
        <p className="text-sm text-muted-foreground">
          No author personas yet. Add one to include author schema on published
          posts.
        </p>
      )}

      {personas.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between rounded-md border p-3"
        >
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{p.name}</p>
              {p.isDefault && (
                <Badge variant="secondary" className="text-[10px]">
                  Default
                </Badge>
              )}
            </div>
            {p.jobTitle && (
              <p className="text-xs text-muted-foreground">{p.jobTitle}</p>
            )}
            {p.expertiseAreas.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {p.expertiseAreas.map((area) => (
                  <Badge
                    key={area}
                    variant="outline"
                    className="text-[9px]"
                  >
                    {area}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!p.isDefault && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => handleSetDefault(p.id)}
                disabled={operatingId === p.id}
                title="Set as default"
              >
                <Star className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-red-500"
              onClick={() => handleDelete(p.id)}
              disabled={operatingId === p.id}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}

      {showForm ? (
        <div className="space-y-3 rounded-md border p-3">
          <Input
            placeholder="Author name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="Job title (optional)"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
          />
          <textarea
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Short bio (optional)"
            rows={2}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
          <Input
            placeholder="Expertise areas (comma-separated)"
            value={expertise}
            onChange={(e) => setExpertise(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={adding}>
              {adding && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Add Author
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowForm(true)}
        >
          <Plus className="mr-1 h-3 w-3" />
          Add Author Persona
        </Button>
      )}
    </div>
  );
}
