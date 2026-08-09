import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { splitBulletLabel } from "@/lib/bulletLabel";
import type { ResumeData } from "@/types/resume";

// Modeled directly on UCLA Anderson's official Parker CMC resume template
// (1st-Year Resume Template, 2026): Letter page, 0.5in margins, Times New
// Roman, bold-caps section headers with a thin rule, and a single blank-line
// worth of spacing between the header/sections/entries.

const GAP = 9; // one "blank line" of vertical spacing, matching the template's use of blank paragraphs

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 36,
    fontFamily: "Times-Roman",
    fontSize: 11,
    color: "#000000",
  },
  header: {
    marginBottom: GAP,
  },
  name: {
    fontFamily: "Times-Bold",
    fontSize: 16,
    textAlign: "center",
  },
  contactLine: {
    textAlign: "center",
    fontSize: 11,
    marginTop: 2,
  },
  section: {
    marginBottom: GAP,
  },
  sectionTitle: {
    fontFamily: "Times-Bold",
    fontSize: 12,
    textTransform: "uppercase",
  },
  sectionRule: {
    borderBottomWidth: 0.75,
    borderBottomColor: "#000000",
    marginTop: 1,
  },
  entry: {
    marginBottom: GAP,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  entryName: {
    fontFamily: "Times-Bold",
    fontSize: 12,
    textTransform: "uppercase",
  },
  entryLocation: {
    fontSize: 11,
  },
  boldItalic: {
    fontFamily: "Times-BoldItalic",
    fontSize: 11,
  },
  italic: {
    fontFamily: "Times-Italic",
    fontSize: 11,
  },
  plain: {
    fontFamily: "Times-Roman",
    fontSize: 11,
  },
  bulletRow: {
    flexDirection: "row",
    marginTop: 2,
    paddingLeft: 4,
  },
  bulletMark: {
    width: 12,
    fontSize: 11,
  },
  bulletText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 1.2,
  },
});

function SectionHeading({ children }: { children: string }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{children}</Text>
      <View style={styles.sectionRule} />
    </View>
  );
}

function BulletLine({ bullet }: { bullet: string }) {
  const { label, rest } = splitBulletLabel(bullet);
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletMark}>•</Text>
      <Text style={styles.bulletText}>
        {label ? <Text style={styles.italic}>{label} </Text> : null}
        {rest}
      </Text>
    </View>
  );
}

function Bullets({ items }: { items?: string[] }) {
  const filtered = (items || []).filter((b) => b && b.trim());
  if (filtered.length === 0) return null;
  return (
    <View>
      {filtered.map((bullet, i) => (
        <BulletLine bullet={bullet} key={i} />
      ))}
    </View>
  );
}

function contactParts(resume: ResumeData): string[] {
  const c = resume.contact;
  return [c.phone, c.email, c.linkedin].filter((v): v is string => !!v && v.trim().length > 0);
}

export function AndersonResumeDocument({ resume }: { resume: ResumeData }) {
  const s = resume.skillsAndInterests;
  const additional: { label: string; values: string[] }[] = [
    { label: "Certifications", values: s?.certifications ?? [] },
    { label: "Languages", values: s?.languages ?? [] },
    { label: "Software", values: s?.software ?? [] },
    { label: "Volunteer", values: s?.volunteer ?? [] },
    { label: "Interests", values: s?.interests ?? [] },
  ].filter((row) => row.values.length > 0);

  return (
    <Document
      title={resume.contact.name ? `${resume.contact.name} - Resume` : "Resume"}
      author={resume.contact.name || undefined}
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.name}>{resume.contact.name || "Your Name"}</Text>
          {contactParts(resume).length > 0 && (
            <Text style={styles.contactLine}>{contactParts(resume).join("  |  ")}</Text>
          )}
        </View>

        {resume.education.length > 0 && (
          <View style={styles.section}>
            <SectionHeading>Education</SectionHeading>
            {resume.education.map((ed) => (
              <View style={styles.entry} key={ed.id}>
                <View style={styles.rowBetween}>
                  <Text style={styles.entryName}>{ed.school}</Text>
                  <Text style={styles.entryLocation}>{ed.location}</Text>
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.boldItalic}>{ed.degree}</Text>
                  <Text style={styles.plain}>{ed.gradDate}</Text>
                </View>
                <Bullets items={ed.bullets} />
              </View>
            ))}
          </View>
        )}

        {resume.experience.length > 0 && (
          <View style={styles.section}>
            <SectionHeading>Experience</SectionHeading>
            {resume.experience.map((ex) => (
              <View style={styles.entry} key={ex.id}>
                <View style={styles.rowBetween}>
                  <Text style={styles.entryName}>{ex.company}</Text>
                  <Text style={styles.entryLocation}>{ex.location}</Text>
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.boldItalic}>{ex.title}</Text>
                  <Text style={styles.italic}>
                    {ex.startDate}
                    {ex.startDate || ex.endDate ? " - " : ""}
                    {ex.endDate}
                  </Text>
                </View>
                <Bullets items={ex.bullets} />
              </View>
            ))}
          </View>
        )}

        {additional.length > 0 && (
          <View style={styles.section}>
            <SectionHeading>Additional</SectionHeading>
            <Bullets items={additional.map((row) => `${row.label}: ${row.values.join(", ")}`)} />
          </View>
        )}
      </Page>
    </Document>
  );
}
