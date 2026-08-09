"use client";

import { useEffect } from "react";
import { withBasePath } from "@/lib/apiBase";

/** Legacy route — the wizard now lives on the landing page at `/#build`. */
export default function BuildPage() {
  useEffect(() => {
    window.location.replace(`${withBasePath("/")}#build`);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-16 text-sm text-muted-foreground">
      Taking you to the builder…
    </div>
  );
}
