"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SkillsAndInterests } from "@/types/resume";

function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function CommaListField({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  values: string[] | undefined;
  onChange: (next: string[]) => void;
}) {
  const [text, setText] = useState((values || []).join(", "));

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Input
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseCommaList(e.target.value));
        }}
      />
      <p className="text-xs text-muted-foreground">Separate items with commas.</p>
    </div>
  );
}

export function AdditionalEditor({
  value,
  onChange,
}: {
  value: SkillsAndInterests;
  onChange: (next: SkillsAndInterests) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <CommaListField
        label="Skills"
        placeholder="SQL, Python, Tableau, Advanced Excel"
        values={value.skills}
        onChange={(skills) => onChange({ ...value, skills })}
      />
      <CommaListField
        label="Languages"
        placeholder="Spanish (fluent), Mandarin (conversational)"
        values={value.languages}
        onChange={(languages) => onChange({ ...value, languages })}
      />
      <CommaListField
        label="Interests"
        placeholder="Marathon running, photography, chess"
        values={value.interests}
        onChange={(interests) => onChange({ ...value, interests })}
      />
    </div>
  );
}
