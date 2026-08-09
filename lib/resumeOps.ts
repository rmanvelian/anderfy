export function updateItem<T extends { id: string }>(
  items: T[],
  id: string,
  patch: Partial<T>
): T[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

export function removeItem<T extends { id: string }>(items: T[], id: string): T[] {
  return items.filter((item) => item.id !== id);
}

export function updateBullet(bullets: string[] | undefined, index: number, value: string): string[] {
  const next = [...(bullets || [])];
  next[index] = value;
  return next;
}

export function removeBullet(bullets: string[] | undefined, index: number): string[] {
  return (bullets || []).filter((_, i) => i !== index);
}

export function addBullet(bullets: string[] | undefined): string[] {
  return [...(bullets || []), ""];
}
