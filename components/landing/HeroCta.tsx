"use client";

import { Button } from "@/components/ui/button";

const BUILD_SECTION_ID = "build";

export function HeroCta() {
  const scrollToBuild = () => {
    const section = document.getElementById(BUILD_SECTION_ID);
    if (!section) return;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    // Keep the hash in sync so deep links / back-forward still work.
    history.replaceState(null, "", `#${BUILD_SECTION_ID}`);
  };

  return (
    <Button
      type="button"
      size="lg"
      className="bg-ucla-gold text-ucla-darkest-blue hover:bg-ucla-darker-gold"
      onClick={scrollToBuild}
    >
      Anderfy your resume
    </Button>
  );
}

export { BUILD_SECTION_ID };
