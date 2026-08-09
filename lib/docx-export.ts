import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
} from "docx";
import type { ResumeData } from "@/types/resume";

// Generates an editable .docx that mirrors the AndersonResumeDocument PDF
// layout (same font, section structure, and right-aligned dates/locations)
// so users can hand-edit the tailored resume in Word if they want to.

const FONT = "Times New Roman";
const PAGE_WIDTH_TWIPS = 12240; // 8.5in
const MARGIN_TWIPS = 900; // 0.625in
const USABLE_WIDTH_TWIPS = PAGE_WIDTH_TWIPS - MARGIN_TWIPS * 2;

const ruleBorder = {
  bottom: {
    style: BorderStyle.SINGLE,
    size: 6,
    color: "111111",
  },
};

function rightAlignedTabStop() {
  return [{ type: TabStopType.RIGHT, position: USABLE_WIDTH_TWIPS }];
}

function headerRule(): Paragraph {
  return new Paragraph({ border: ruleBorder, spacing: { after: 160 } });
}

function sectionHeading(title: string): Paragraph {
  return new Paragraph({
    border: ruleBorder,
    spacing: { before: 120, after: 80 },
    children: [
      new TextRun({
        text: title.toUpperCase(),
        bold: true,
        font: FONT,
        size: 21,
        allCaps: true,
      }),
    ],
  });
}

function twoColumnLine(left: string, right: string, opts: { bold?: boolean; italics?: boolean } = {}) {
  return new Paragraph({
    tabStops: rightAlignedTabStop(),
    spacing: { after: 20 },
    children: [
      new TextRun({ text: left || "", font: FONT, size: 19, bold: opts.bold, italics: opts.italics }),
      new TextRun({ text: right ? `\t${right}` : "", font: FONT, size: 19, italics: opts.italics }),
    ],
  });
}

function bulletParagraph(text: string): Paragraph {
  return new Paragraph({
    indent: { left: 260, hanging: 260 },
    spacing: { after: 20 },
    children: [
      new TextRun({ text: "•  ", font: FONT, size: 19 }),
      new TextRun({ text, font: FONT, size: 19 }),
    ],
  });
}

function bullets(items?: string[]): Paragraph[] {
  return (items || []).filter((b) => b && b.trim()).map(bulletParagraph);
}

export async function buildResumeDocx(resume: ResumeData): Promise<Buffer> {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: resume.contact.name || "Your Name",
          bold: true,
          font: FONT,
          size: 32,
        }),
      ],
    })
  );

  const contactParts = [
    resume.contact.location,
    resume.contact.phone,
    resume.contact.email,
    resume.contact.linkedin,
  ].filter((v): v is string => !!v && v.trim().length > 0);

  if (contactParts.length > 0) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({ text: contactParts.join("   |   "), font: FONT, size: 18 }),
        ],
      })
    );
  }

  children.push(headerRule());

  if (resume.education.length > 0) {
    children.push(sectionHeading("Education"));
    for (const ed of resume.education) {
      children.push(twoColumnLine(ed.school, ed.location || "", { bold: true }));
      const degreeLine = [ed.degree, ed.field].filter(Boolean).join(" in ");
      const detail = [degreeLine, ed.gpa ? `GPA: ${ed.gpa}` : "", ed.honors]
        .filter(Boolean)
        .join(" — ");
      children.push(twoColumnLine(detail, ed.gradDate || "", { italics: true }));
      children.push(...bullets(ed.bullets));
    }
  }

  if (resume.experience.length > 0) {
    children.push(sectionHeading("Experience"));
    for (const ex of resume.experience) {
      children.push(twoColumnLine(ex.company, ex.location || "", { bold: true }));
      const dates = [ex.startDate, ex.endDate].filter(Boolean).join(" – ");
      children.push(twoColumnLine(ex.title, dates, { italics: true }));
      children.push(...bullets(ex.bullets));
    }
  }

  const leadership = resume.leadership.filter((l) => l.org || l.role);
  if (leadership.length > 0) {
    children.push(sectionHeading("Leadership & Activities"));
    for (const l of leadership) {
      children.push(twoColumnLine(l.org, l.location || "", { bold: true }));
      children.push(twoColumnLine(l.role, l.dates || "", { italics: true }));
      children.push(...bullets(l.bullets));
    }
  }

  const s = resume.skillsAndInterests;
  const additionalRows: [string, string[] | undefined][] = [
    ["Skills:", s?.skills],
    ["Languages:", s?.languages],
    ["Interests:", s?.interests],
  ];
  const hasAdditional = additionalRows.some(([, arr]) => arr && arr.length > 0);
  if (hasAdditional) {
    children.push(sectionHeading("Additional"));
    for (const [label, arr] of additionalRows) {
      if (!arr || arr.length === 0) continue;
      children.push(
        new Paragraph({
          spacing: { after: 20 },
          children: [
            new TextRun({ text: `${label} `, bold: true, font: FONT, size: 19 }),
            new TextRun({ text: arr.join(", "), font: FONT, size: 19 }),
          ],
        })
      );
    }
  }

  const doc = new Document({
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

  return Packer.toBuffer(doc);
}
