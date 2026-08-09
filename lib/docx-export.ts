import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
} from "docx";
import { splitBulletLabel } from "@/lib/bulletLabel";
import type { ResumeData } from "@/types/resume";

// Generates an editable .docx mirroring the official Anderson (Parker CMC)
// resume template: Letter page, 0.5in margins, Times New Roman, bold-caps
// section headers with a rule, and one blank-line of spacing between the
// header/sections/entries.

const FONT = "Times New Roman";
const PAGE_WIDTH_TWIPS = 12240; // 8.5in
const MARGIN_TWIPS = 720; // 0.5in
const USABLE_WIDTH_TWIPS = PAGE_WIDTH_TWIPS - MARGIN_TWIPS * 2;
const BODY_SIZE = 22; // 11pt, in half-points
const NAME_SIZE = 32; // 16pt
const HEADING_SIZE = 24; // 12pt
const GAP_TWIPS = 180; // ~1 blank line at 11pt

const ruleBorder = {
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
};

function rightAlignedTabStop() {
  return [{ type: TabStopType.RIGHT, position: USABLE_WIDTH_TWIPS }];
}

function sectionHeading(title: string): Paragraph {
  return new Paragraph({
    border: ruleBorder,
    spacing: { after: GAP_TWIPS },
    children: [
      new TextRun({ text: title.toUpperCase(), bold: true, font: FONT, size: HEADING_SIZE }),
    ],
  });
}

interface SideStyle {
  bold?: boolean;
  italics?: boolean;
  uppercase?: boolean;
  size?: number;
}

function twoColumnLine(left: string, leftStyle: SideStyle, right: string, rightStyle: SideStyle): Paragraph {
  return new Paragraph({
    tabStops: rightAlignedTabStop(),
    children: [
      new TextRun({
        text: leftStyle.uppercase ? (left || "").toUpperCase() : left || "",
        font: FONT,
        size: leftStyle.size ?? BODY_SIZE,
        bold: leftStyle.bold,
        italics: leftStyle.italics,
      }),
      new TextRun({
        text: right ? `\t${right}` : "",
        font: FONT,
        size: rightStyle.size ?? BODY_SIZE,
        bold: rightStyle.bold,
        italics: rightStyle.italics,
      }),
    ],
  });
}

function bulletParagraph(text: string, isLastInEntry: boolean): Paragraph {
  const { label, rest } = splitBulletLabel(text);
  const runs: TextRun[] = [new TextRun({ text: "•  ", font: FONT, size: BODY_SIZE })];
  if (label) {
    runs.push(new TextRun({ text: `${label} `, font: FONT, size: BODY_SIZE, italics: true }));
    runs.push(new TextRun({ text: rest, font: FONT, size: BODY_SIZE }));
  } else {
    runs.push(new TextRun({ text, font: FONT, size: BODY_SIZE }));
  }
  return new Paragraph({
    indent: { left: 260, hanging: 260 },
    spacing: { after: isLastInEntry ? GAP_TWIPS : 0 },
    children: runs,
  });
}

function bullets(items: string[] | undefined, fallbackGapIfEmpty: boolean): Paragraph[] {
  const filtered = (items || []).filter((b) => b && b.trim());
  if (filtered.length === 0) {
    return fallbackGapIfEmpty
      ? [new Paragraph({ spacing: { after: GAP_TWIPS }, children: [] })]
      : [];
  }
  return filtered.map((b, i) => bulletParagraph(b, i === filtered.length - 1));
}

function buildResumeDocument(resume: ResumeData): Document {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: resume.contact.name || "Your Name", bold: true, font: FONT, size: NAME_SIZE }),
      ],
    })
  );

  const contactParts = [resume.contact.phone, resume.contact.email, resume.contact.linkedin].filter(
    (v): v is string => !!v && v.trim().length > 0
  );

  if (contactParts.length > 0) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: GAP_TWIPS },
        children: [new TextRun({ text: contactParts.join("  |  "), font: FONT, size: BODY_SIZE })],
      })
    );
  }

  if (resume.education.length > 0) {
    children.push(sectionHeading("Education"));
    for (const ed of resume.education) {
      children.push(
        twoColumnLine(ed.school, { bold: true, uppercase: true, size: HEADING_SIZE }, ed.location || "", {})
      );
      children.push(twoColumnLine(ed.degree, { bold: true, italics: true }, ed.gradDate || "", {}));
      children.push(...bullets(ed.bullets, true));
    }
  }

  if (resume.experience.length > 0) {
    children.push(sectionHeading("Experience"));
    for (const ex of resume.experience) {
      children.push(
        twoColumnLine(ex.company, { bold: true, uppercase: true, size: HEADING_SIZE }, ex.location || "", {})
      );
      const dates = [ex.startDate, ex.endDate].filter(Boolean).join(" - ");
      children.push(twoColumnLine(ex.title, { bold: true, italics: true }, dates, { italics: true }));
      children.push(...bullets(ex.bullets, true));
    }
  }

  const s = resume.skillsAndInterests;
  const additional: [string, string[]][] = (
    [
      ["Certifications", s?.certifications],
      ["Languages", s?.languages],
      ["Software", s?.software],
      ["Volunteer", s?.volunteer],
      ["Interests", s?.interests],
    ] as [string, string[] | undefined][]
  ).filter((entry): entry is [string, string[]] => !!entry[1] && entry[1].length > 0);

  if (additional.length > 0) {
    children.push(sectionHeading("Additional"));
    children.push(
      ...bullets(
        additional.map(([label, arr]) => `${label}: ${arr.join(", ")}`),
        false
      )
    );
  }

  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_WIDTH_TWIPS, height: 15840 },
            margin: {
              top: MARGIN_TWIPS,
              bottom: MARGIN_TWIPS,
              left: MARGIN_TWIPS,
              right: MARGIN_TWIPS,
            },
          },
        },
        children,
      },
    ],
  });
}

/** Node/API export path. */
export async function buildResumeDocx(resume: ResumeData): Promise<Buffer> {
  return Packer.toBuffer(buildResumeDocument(resume));
}

/** Browser-safe export path (GitHub Pages / static hosting). */
export async function buildResumeDocxBlob(resume: ResumeData): Promise<Blob> {
  return Packer.toBlob(buildResumeDocument(resume));
}
