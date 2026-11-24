import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText, Mail } from "lucide-react";
import "./terms.css";

export const metadata: Metadata = {
  title: "Terms of Use | SportyFanz",
  description: "Read the SportyFanz platform Terms of Use.",
};

const sections = [
  {
    title: "1. About SportyFanz",
    paragraphs: [
      "SportyFanz is a digital sports fan community where visitors can explore sports content, follow matches and discover fan activities. Registered members can access additional participation features.",
      "These Terms explain the rules for accessing and using the SportyFanz platform.",
    ],
  },
  {
    title: "2. Eligibility and registration",
    paragraphs: [
      "You must be at least 13 years old to register for a SportyFanz account. Additional safeguards or consent requirements may apply depending on your location and applicable law.",
      "Registration requires accurate account information. SportyFanz may require email verification before an account can be used.",
      "You are responsible for protecting your account credentials and for activity conducted through your account.",
    ],
  },
  {
    title: "3. Browsing and participation",
    paragraphs: [
      "Visitors may browse publicly available sections without creating an account.",
      "Submitting predictions, answering trivia, voting in polls and earning points or rewards requires an eligible registered account.",
      "Some activities may have additional deadlines, entry limits or eligibility requirements displayed with the activity.",
    ],
  },
  {
    title: "4. Fan Rooms and community conduct",
    paragraphs: [
      "Fan Rooms are spaces for sports discussions and community interaction. Guest participation may be available where supported.",
      "All participants, including guests, must communicate respectfully and follow the SportyFanz Community Guidelines.",
      "Harassment, threats, hateful conduct, impersonation, spam, fraud and unlawful content are prohibited.",
    ],
  },
  {
    title: "5. Moderation and enforcement",
    paragraphs: [
      "SportyFanz may review reported or otherwise identified violations and take proportionate action, including removing content, restricting participation or suspending accounts.",
      "Enforcement decisions should take account of the nature and seriousness of the conduct and applicable legal requirements.",
    ],
  },
  {
    title: "6. Points, progression and rewards",
    paragraphs: [
      "SportyFanz distinguishes progression points, which support fan-level advancement, from redeemable Fan Points used for eligible rewards.",
      "Points are not cash, do not represent a bank deposit and are not automatically transferable or exchangeable for money.",
      "Earning opportunities, reward availability and redemption conditions are governed by the Fan Points & Rewards Policy and any clearly displayed activity-specific rules.",
    ],
  },
  {
    title: "7. Sports information and external services",
    paragraphs: [
      "SportyFanz may display scores, fixtures, statistics, news and other information obtained from third-party providers.",
      "Sports information can be delayed, corrected or temporarily unavailable. Users should verify important information independently.",
      "Links to external websites and services may be governed by those providers' own terms and privacy notices.",
    ],
  },
  {
    title: "8. Intellectual property",
    paragraphs: [
      "SportyFanz branding, original platform design and original content are protected by applicable intellectual property laws.",
      "Users must respect the rights of SportyFanz, other users and third-party content owners. Posting content does not transfer ownership of that content to SportyFanz.",
    ],
  },
  {
    title: "9. Platform availability",
    paragraphs: [
      "SportyFanz may perform maintenance, correct errors and modify platform features. Continuous or uninterrupted availability is not guaranteed.",
      "Nothing in these Terms excludes rights or remedies that cannot lawfully be excluded under applicable law.",
    ],
  },
  {
    title: "10. Changes to these Terms",
    paragraphs: [
      "SportyFanz may update these Terms as its services evolve. Material changes should be communicated appropriately, with any legally required notice or consent.",
    ],
  },
  {
    title: "11. Contact",
    paragraphs: [
      "Questions about these Terms can be sent to contact@sportyfanz.com.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="sf-terms-page">
      <header className="sf-terms-hero">
        <Link href="/about" className="sf-terms-back">
          <ArrowLeft size={16} />
          About SportyFanz
        </Link>

        <div className="sf-terms-hero-icon">
          <FileText size={30} />
        </div>

        <span className="sf-terms-eyebrow">SPORTYFANZ POLICIES</span>
        <h1>Terms of Use</h1>
        <p>
          The rules that help make SportyFanz a fair,
          welcoming and rewarding place for sports fans.
        </p>
        <span className="sf-terms-draft">Draft — pending legal review</span>
      </header>

      <div className="sf-terms-layout">
        <nav className="sf-terms-toc" aria-label="Terms sections">
          <strong>ON THIS PAGE</strong>
          {sections.map((section, index) => (
            <a href={`#section-${index + 1}`} key={section.title}>
              {section.title}
            </a>
          ))}
        </nav>

        <article className="sf-terms-content">
          {sections.map((section, index) => (
            <section id={`section-${index + 1}`} key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}

          <div className="sf-terms-contact">
            <Mail size={23} />
            <div>
              <strong>Questions about these Terms?</strong>
              <p>
                Contact us at{" "}
                <a href="mailto:contact@sportyfanz.com">
                  contact@sportyfanz.com
                </a>
              </p>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
