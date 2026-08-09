"use client";

import { Briefcase, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { newId } from "@/lib/id";
import { removeItem, updateItem } from "@/lib/resumeOps";
import type { ExperienceEntry } from "@/types/resume";
import { BulletListEditor } from "@/components/resume/editor/BulletListEditor";

export function ExperienceEditor({
  entries,
  onChange,
}: {
  entries: ExperienceEntry[];
  onChange: (next: ExperienceEntry[]) => void;
}) {
  const addEntry = () =>
    onChange([
      ...entries,
      {
        id: newId(),
        company: "",
        location: "",
        title: "",
        startDate: "",
        endDate: "",
        bullets: [""],
      },
    ]);

  return (
    <div className="flex flex-col gap-4">
      {entries.map((ex) => (
        <div key={ex.id} className="rounded-lg border p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Briefcase className="size-4" />
              Experience entry
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onChange(removeItem(entries, ex.id))}
              aria-label="Remove experience entry"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Company</Label>
              <Input
                value={ex.company}
                onChange={(e) => onChange(updateItem(entries, ex.id, { company: e.target.value }))}
                placeholder="Meridian Consulting Group"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Location</Label>
              <Input
                value={ex.location || ""}
                onChange={(e) => onChange(updateItem(entries, ex.id, { location: e.target.value }))}
                placeholder="Los Angeles, CA"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Title</Label>
              <Input
                value={ex.title}
                onChange={(e) => onChange(updateItem(entries, ex.id, { title: e.target.value }))}
                placeholder="Senior Business Analyst"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Start date</Label>
                <Input
                  value={ex.startDate}
                  onChange={(e) => onChange(updateItem(entries, ex.id, { startDate: e.target.value }))}
                  placeholder="Jul 2021"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>End date</Label>
                <Input
                  value={ex.endDate}
                  onChange={(e) => onChange(updateItem(entries, ex.id, { endDate: e.target.value }))}
                  placeholder="Present"
                />
              </div>
            </div>
          </div>
          <div className="mt-3">
            <Label className="mb-1.5 block">Bullets (S-T-A-R, quantify impact)</Label>
            <BulletListEditor
              bullets={ex.bullets}
              onChange={(bullets) => onChange(updateItem(entries, ex.id, { bullets }))}
            />
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addEntry}>
        <Plus className="size-3.5" />
        Add experience entry
      </Button>
    </div>
  );
}
