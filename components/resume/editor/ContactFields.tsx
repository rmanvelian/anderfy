"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ContactInfo } from "@/types/resume";

export function ContactFields({
  contact,
  onChange,
}: {
  contact: ContactInfo;
  onChange: (next: ContactInfo) => void;
}) {
  const set = (patch: Partial<ContactInfo>) => onChange({ ...contact, ...patch });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="contact-name">Full name</Label>
        <Input
          id="contact-name"
          value={contact.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Jordan Rivera"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact-phone">Phone</Label>
        <Input
          id="contact-phone"
          value={contact.phone || ""}
          onChange={(e) => set({ phone: e.target.value })}
          placeholder="(555) 123-4567"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact-email">Email</Label>
        <Input
          id="contact-email"
          value={contact.email || ""}
          onChange={(e) => set({ email: e.target.value })}
          placeholder="jordan@email.com"
        />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="contact-linkedin">LinkedIn</Label>
        <Input
          id="contact-linkedin"
          value={contact.linkedin || ""}
          onChange={(e) => set({ linkedin: e.target.value })}
          placeholder="linkedin.com/in/jordanrivera"
        />
      </div>
    </div>
  );
}
