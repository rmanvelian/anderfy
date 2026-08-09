import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ResumeData } from "@/types/resume";

// A best-effort recreation of the well-documented UCLA Anderson / Parker CMC
// MBA resume conventions: one page, conservative business formatting, serif
// font, bold small-caps section headers with a rule, right-aligned
// dates/locations, and STAR-style bullets. The real Anderson Word template is
// distributed privately to admitted students and isn't publicly available,
// so this is an approximation based on Anderson's published guidance.

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 34,
    paddingHorizontal: 46,
    fontFamily: "Times-Roman",
    fontSize: 9.5,
    color: "#111111",
  },
  name: {
    fontFamily: "Times-Bold",
    fontSize: 16,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  contactLine: {
    textAlign: "center",
    fontSize: 9,
    marginTop: 3,
    color: "#222222",
  },
  headerRule: {
    borderBottomWidth: 1.2,
    borderBottomColor: "#111111",
    marginTop: 6,
    marginBottom: 8,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: "Times-Bold",
    fontSize: 10.5,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  sectionRule: {
    borderBottomWidth: 0.75,
    borderBottomColor: "#111111",
    marginTop: 2,
    marginBottom: 5,
  },
  entry: {
    marginBottom: 6,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  bold: {
    fontFamily: "Times-Bold",
  },
  italic: {
    fontFamily: "Times-Italic",
    fontSize: 9.5,
  },
  bulletRow: {
    flexDirection: "row",
    marginTop: 2,
    paddingLeft: 2,
  },
  bulletMark: {
    width: 10,
    fontSize: 9.5,
  },
  bulletText: {
    flex: 1,
    fontSize: 9.5,
    lineHeight: 1.28,
  },
  additionalRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  additionalLabel: {
    fontFamily: "Times-Bold",
    fontSize: 9.5,
    width: 78,
  },
  additionalValue: {
    fontSize: 9.5,
    flex: 1,
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

function Bullets({ items }: { items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <View>
      {items
        .filter((b) => b && b.trim())
        .map((bullet, i) => (
          <View style={styles.bulletRow} key={i}>
            <Text style={styles.bulletMark}>•</Text>
            <Text style={styles.bulletText}>{bullet}</Text>
          </View>
        ))}
    </View>
  );
}

function contactParts(resume: ResumeData): string[] {
  const c = resume.contact;
  return [c.location, c.phone, c.email, c.linkedin].filter(
    (v): v is string => !!v && v.trim().length > 0
  );
}

export function AndersonResumeDocument({ resume }: { resume: ResumeData }) {
  const hasLeadership = resume.leadership?.some((l) => l.org || l.role);
  const s = resume.skillsAndInterests;
  const hasAdditional =
    !!s && ((s.skills?.length ?? 0) > 0 || (s.languages?.length ?? 0) > 0 || (s.interests?.length ?? 0) > 0);

  return (
    <Document
      title={resume.contact.name ? `${resume.contact.name} - Resume` : "Resume"}
      author={resume.contact.name || undefined}
    >
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.name}>{resume.contact.name || "Your Name"}</Text>
        {contactParts(resume).length > 0 && (
          <Text style={styles.contactLine}>{contactParts(resume).join("   |   ")}</Text>
        )}
        <View style={styles.headerRule} />

        {resume.education.length > 0 && (
          <View style={styles.section}>
            <SectionHeading>Education</SectionHeading>
            {resume.education.map((ed) => (
              <View style={styles.entry} key={ed.id}>
                <View style={styles.rowBetween}>
                  <Text style={styles.bold}>{ed.school}</Text>
                  <Text>{ed.location}</Text>
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.italic}>
                    {[ed.degree, ed.field].filter(Boolean).join(" in ")}
                    {ed.gpa ? `, GPA: ${ed.gpa}` : ""}
                    {ed.honors ? ` — ${ed.honors}` : ""}
                  </Text>
                  <Text style={styles.italic}>{ed.gradDate}</Text>
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
                  <Text style={styles.bold}>{ex.company}</Text>
                  <Text>{ex.location}</Text>
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.italic}>{ex.title}</Text>
                  <Text style={styles.italic}>
                    {ex.startDate}
                    {ex.startDate || ex.endDate ? " – " : ""}
                    {ex.endDate}
                  </Text>
                </View>
                <Bullets items={ex.bullets} />
              </View>
            ))}
          </View>
        )}

        {hasLeadership && (
          <View style={styles.section}>
            <SectionHeading>Leadership &amp; Activities</SectionHeading>
            {resume.leadership.map((l) => (
              <View style={styles.entry} key={l.id}>
                <View style={styles.rowBetween}>
                  <Text style={styles.bold}>{l.org}</Text>
                  <Text>{l.location}</Text>
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.italic}>{l.role}</Text>
                  <Text style={styles.italic}>{l.dates}</Text>
                </View>
                <Bullets items={l.bullets} />
              </View>
            ))}
          </View>
        )}

        {hasAdditional && (
          <View style={styles.section}>
            <SectionHeading>Additional</SectionHeading>
            {(s?.skills?.length ?? 0) > 0 && (
              <View style={styles.additionalRow}>
                <Text style={styles.additionalLabel}>Skills:</Text>
                <Text style={styles.additionalValue}>{s!.skills!.join(", ")}</Text>
              </View>
            )}
            {(s?.languages?.length ?? 0) > 0 && (
              <View style={styles.additionalRow}>
                <Text style={styles.additionalLabel}>Languages:</Text>
                <Text style={styles.additionalValue}>{s!.languages!.join(", ")}</Text>
              </View>
            )}
            {(s?.interests?.length ?? 0) > 0 && (
              <View style={styles.additionalRow}>
                <Text style={styles.additionalLabel}>Interests:</Text>
                <Text style={styles.additionalValue}>{s!.interests!.join(", ")}</Text>
              </View>
            )}
          </View>
        )}
      </Page>
    </Document>
  );
}
