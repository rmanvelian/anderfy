"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addBullet, removeBullet, updateBullet } from "@/lib/resumeOps";

export function BulletListEditor({
  bullets,
  onChange,
  placeholder = "Led a team of ... resulting in ...",
}: {
  bullets: string[] | undefined;
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const items = bullets || [];

  return (
    <div className="flex flex-col gap-2">
      {items.map((bullet, index) => (
        <div key={index} className="flex items-start gap-2">
          <span className="mt-2 text-muted-foreground">•</span>
          <Textarea
            value={bullet}
            placeholder={placeholder}
            onChange={(e) => onChange(updateBullet(items, index, e.target.value))}
            className="min-h-[2.25rem] resize-none py-1.5"
            rows={1}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => onChange(removeBullet(items, index))}
            aria-label="Remove bullet"
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() => onChange(addBullet(items))}
      >
        <Plus className="size-3.5" />
        Add bullet
      </Button>
    </div>
  );
}
