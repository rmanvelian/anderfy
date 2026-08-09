"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "source", label: "Your background" },
  { key: "job", label: "Job posting" },
  { key: "review", label: "Review & export" },
] as const;

export type WizardStepKey = (typeof STEPS)[number]["key"];

export function WizardStepper({ current }: { current: WizardStepKey }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <ol className="flex w-full items-center gap-2">
      {STEPS.map((step, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <li key={step.key} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                isDone && "border-ucla-gold bg-ucla-gold text-ucla-blue",
                isCurrent && "border-ucla-gold bg-ucla-gold text-ucla-darkest-blue",
                !isDone && !isCurrent && "border-muted-foreground/30 text-muted-foreground"
              )}
            >
              {isDone ? <Check className="size-3.5" /> : index + 1}
            </div>
            <span
              className={cn(
                "text-sm font-medium",
                isCurrent ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
            {index < STEPS.length - 1 && (
              <div
                className={cn("mx-1 h-px flex-1", isDone ? "bg-ucla-blue" : "bg-border")}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
