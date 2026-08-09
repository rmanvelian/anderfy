"use client";

import { Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { newId } from "@/lib/id";
import { removeItem, updateItem } from "@/lib/resumeOps";
import type { LeadershipEntry } from "@/types/resume";
import { BulletListEditor } from "@/components/resume/editor/BulletListEditor";

export function LeadershipEditor({
  entries,
  onChange,
}: {
  entries: LeadershipEntry[];
  onChange: (next: LeadershipEntry[]) => void;
}) {
  const addEntry = () =>
    onChange([
      ...entries,
      { id: newId(), org: "", role: "", location: "", dates: "", bullets: [] },
    ]);

  return (
    <div className="flex flex-col gap-4">
      {entries.map((l) => (
        <div key={l.id} className="rounded-lg border p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Users className="size-4" />
              Leadership / activity entry
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onChange(removeItem(entries, l.id))}
              aria-label="Remove leadership entry"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Organization</Label>
              <Input
                value={l.org}
                onChange={(e) => onChange(updateItem(entries, l.id, { org: e.target.value }))}
                placeholder="Big Brothers Big Sisters"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Location</Label>
              <Input
                value={l.location || ""}
                onChange={(e) => onChange(updateItem(entries, l.id, { location: e.target.value }))}
                placeholder="Los Angeles, CA"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Role</Label>
              <Input
                value={l.role}
                onChange={(e) => onChange(updateItem(entries, l.id, { role: e.target.value }))}
                placeholder="Volunteer Mentor"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Dates</Label>
              <Input
                value={l.dates || ""}
                onChange={(e) => onChange(updateItem(entries, l.id, { dates: e.target.value }))}
                placeholder="Sep 2019 - Present"
              />
            </div>
          </div>
          <div className="mt-3">
            <Label className="mb-1.5 block">Bullets (optional)</Label>
            <BulletListEditor
              bullets={l.bullets}
              onChange={(bullets) => onChange(updateItem(entries, l.id, { bullets }))}
            />
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addEntry}>
        <Plus className="size-3.5" />
        Add leadership / activity entry
      </Button>
    </div>
  );
}
