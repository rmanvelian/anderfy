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
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">Separate items with commas. Leave a field blank to omit it.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CommaListField
          label="Certifications"
          placeholder="CFA, Series 63, Six Sigma Green Belt"
          values={value.certifications}
          onChange={(certifications) => onChange({ ...value, certifications })}
        />
        <CommaListField
          label="Languages"
          placeholder="Spanish (fluent), Mandarin (conversational)"
          values={value.languages}
          onChange={(languages) => onChange({ ...value, languages })}
        />
        <CommaListField
          label="Software"
          placeholder="SQL, Python, Tableau, Advanced Excel"
          values={value.software}
          onChange={(software) => onChange({ ...value, software })}
        />
        <CommaListField
          label="Volunteer"
          placeholder="Big Brothers Big Sisters, Volunteer Mentor"
          values={value.volunteer}
          onChange={(volunteer) => onChange({ ...value, volunteer })}
        />
        <CommaListField
          label="Interests"
          placeholder="Marathon running, photography, chess"
          values={value.interests}
          onChange={(interests) => onChange({ ...value, interests })}
        />
      </div>
    </div>
  );
}
