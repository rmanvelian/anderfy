"use client";

import type { ReactNode } from "react";
import { GraduationCap, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EDUCATION_NONE_VALUE } from "@/lib/educationBullets";
import { newId } from "@/lib/id";
import { removeItem, updateItem } from "@/lib/resumeOps";
import type { EducationEntry } from "@/types/resume";
import { BulletListEditor } from "@/components/resume/editor/BulletListEditor";

export function EducationEditor({
  entries,
  onChange,
}: {
  entries: EducationEntry[];
  onChange: (next: EducationEntry[]) => void;
}) {
  const addEntry = () =>
    onChange([
      ...entries,
      {
        id: newId(),
        school: "",
        location: "",
        degree: "",
        gradDate: "",
        bullets: [
          `Honors: ${EDUCATION_NONE_VALUE}`,
          `Leadership: ${EDUCATION_NONE_VALUE}`,
          `Membership: ${EDUCATION_NONE_VALUE}`,
        ],
      },
    ]);

  return (
    <div className="flex flex-col gap-4">
      {entries.map((ed) => (
        <div key={ed.id} className="rounded-lg border p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <GraduationCap className="size-4" />
              Education entry
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onChange(removeItem(entries, ed.id))}
              aria-label="Remove education entry"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="School">
              <Input
                value={ed.school}
                onChange={(e) => onChange(updateItem(entries, ed.id, { school: e.target.value }))}
                placeholder="UCLA Anderson School of Management"
              />
            </Field>
            <Field label="Location">
              <Input
                value={ed.location || ""}
                onChange={(e) => onChange(updateItem(entries, ed.id, { location: e.target.value }))}
                placeholder="Los Angeles, CA"
              />
            </Field>
            <Field label="Degree" hint="Degree + program/major together">
              <Input
                value={ed.degree}
                onChange={(e) => onChange(updateItem(entries, ed.id, { degree: e.target.value }))}
                placeholder="M.B.A., Full-Time Program"
              />
            </Field>
            <Field label="Graduation date">
              <Input
                value={ed.gradDate}
                onChange={(e) => onChange(updateItem(entries, ed.id, { gradDate: e.target.value }))}
                placeholder="Jun 2028"
              />
            </Field>
          </div>
          <div className="mt-3">
            <Label className="mb-1.5 block">Honors / Leadership / Membership</Label>
            <BulletListEditor
              bullets={ed.bullets}
              onChange={(bullets) => onChange(updateItem(entries, ed.id, { bullets }))}
              placeholder={`Honors: ${EDUCATION_NONE_VALUE}`}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Anderson format: keep Honors, Leadership, and Membership — use
              &quot;{EDUCATION_NONE_VALUE}&quot; if blank.
            </p>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addEntry}>
        <Plus className="size-3.5" />
        Add education entry
      </Button>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
