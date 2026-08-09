import { randomUUID } from "crypto";

export function newId(): string {
  if (typeof randomUUID === "function") return randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
