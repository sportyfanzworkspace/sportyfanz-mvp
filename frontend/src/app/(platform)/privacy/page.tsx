import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Mail } from "lucide-react";
import "./privacy.css";

export const metadata: Metadata = {
  title: "Privacy Policy | SportyFanz",
  description: "Read the SportyFanz Privacy Policy.",
};

const policyGroups = [
  {
    title: "1. Terms of Use",
    sections: [
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
],
  },
  {
    title: "2. Privacy Policy",
    sections: [
  {
    title: "1. Introduction",
    paragraphs: [
      "SportyFanz is a digital sports fan community. This Privacy Policy explains the categories of personal information processed through the platform and how that information relates to account management, participation and community features.",
      "This document is a draft pending operational verification and legal review. It should not be treated as a final statement of all processing activities.",
    ],
  },
  {
    title: "2. Information provided during registration",
    paragraphs: [
      "Registration collects first name, last name, username, email address, password, country and date of birth. A WhatsApp number may also be provided voluntarily.",
      "Passwords are processed using a password-hashing function rather than being stored as ordinary readable passwords. Email verification records are used to confirm account email addresses.",
    ],
  },
  {
    title: "3. Profile and participation information",
    paragraphs: [
      "SportyFanz maintains fan profiles that may include display names, profile images, biographies, sports preferences and fan levels.",
      "Participation records may include predictions, poll votes, trivia attempts, challenge activity, Fan Room membership, messages, points transactions and reward redemptions.",
      "Some profile and community information may be visible to other users depending on the feature and its visibility settings.",
    ],
  },
  {
    title: "4. Guest activity and cookies",
    paragraphs: [
      "SportyFanz uses authentication cookies to maintain signed-in sessions. These cookies are configured as HTTP-only, with Secure enabled in production and SameSite=Lax.",
      "The platform also defines guest news-engagement and guest poll cookies, each configured with a maximum lifetime of 365 days. Their precise use and any associated retention of activity records should be confirmed before this policy is published.",
      "Cookie lifetime does not necessarily establish how long related server-side records are retained.",
    ],
  },
  {
    title: "5. How information is used",
    paragraphs: [
      "Account and activity information supports registration, authentication, email verification, fan profiles, sports preferences, participation features, community interactions, points and rewards.",
      "Information may also be processed to maintain platform security, investigate misuse, provide support and meet applicable legal obligations.",
      "The legal bases applicable to each processing activity must be verified and documented before publication.",
    ],
  },
  {
    title: "6. Community content and Fan Rooms",
    paragraphs: [
      "Messages and other content submitted to community features may be displayed to participants and processed for moderation and platform operation.",
      "The database supports guest names associated with some Fan Room messages. Guest message submission and its related privacy arrangements must be verified before being described as generally available.",
      "Users should avoid publishing sensitive personal information in public conversations.",
    ],
  },
  {
    title: "7. Parental Consent and Protection of Minors",
    paragraphs: [
      "SportyFanz welcomes sports fans aged 13 years and above. Individuals under 13 are not permitted to register for an account.",
      "We recognize the importance of protecting the personal information, privacy and safety of younger users.",
      "Where required by applicable law, SportyFanz must obtain and verify consent from a parent or legal guardian before processing a minor's personal information on the basis of consent. Agreeing to this Privacy Policy does not itself establish parental or guardian consent.",
      "SportyFanz intends to apply appropriate safeguards for younger users, including responsible data collection, privacy protections and community safety measures. These safeguards and any required consent-verification procedures must be implemented and reviewed before registration for minors is enabled in production.",
      "Parents and legal guardians may contact SportyFanz at contact@sportyfanz.com to raise privacy concerns or request information about their child's personal data.",
      "The treatment of existing accounts and any additional requirements under applicable data protection laws must be reviewed before this policy is finalized.",
    ],
  },
  {
    title: "8. Service providers and external content",
    paragraphs: [
      "SportyFanz uses external infrastructure and services to operate its website, database, email delivery and sports information features.",
      "Sports articles, statistics and links may originate from external providers. Visiting an external website may subject users to that provider's privacy practices.",
      "A complete list of relevant processors, international data transfers and applicable safeguards must be verified before publication.",
    ],
  },
  {
    title: "9. Security",
    paragraphs: [
      "SportyFanz uses password hashing and signed authentication tokens. Session cookies are configured as HTTP-only and Secure in production.",
      "No online service can guarantee absolute security. Additional organisational and technical safeguards must be assessed and documented as appropriate.",
    ],
  },
  {
    title: "10. Retention of information",
    paragraphs: [
      "Account, activity and community records may be retained for operational, security or legal purposes.",
      "Specific retention periods and deletion procedures have not yet been verified. A documented retention schedule must be established before this policy is finalised.",
    ],
  },
  {
    title: "11. Your privacy rights",
    paragraphs: [
      "Depending on applicable law, individuals may have rights relating to access, correction, deletion, objection, restriction, portability or withdrawal of consent.",
      "Requests and questions can be directed to contact@sportyfanz.com. The identity-verification and request-handling process must be confirmed before publication.",
      "Automated account deletion and personal data export tools have not been verified as available.",
    ],
  },
  {
    title: "12. Changes and contact",
    paragraphs: [
      "This Privacy Policy may be updated as SportyFanz develops its services and confirms its data-processing practices. Material updates should be communicated as required by applicable law.",
      "For privacy-related enquiries, contact contact@sportyfanz.com.",
    ],
  },
],
  },
  {
    title: "3. Community Guidelines",
    sections: [
  {
    title: "Respect every fan",
    paragraphs: [
      "Sporting rivalry and respectful disagreement are welcome. Harassment, bullying, threats, hateful conduct and targeted abuse are prohibited.",
      "Respect fellow supporters regardless of their team, nationality, background or personal characteristics.",
    ],
  },
  {
    title: "Fan Rooms and discussions",
    paragraphs: [
      "Keep discussions relevant, respectful and appropriate for a community that may include younger fans.",
      "Do not impersonate others, repeatedly spam conversations, publish private information or share malicious links.",
      "Guests must follow the same conduct rules wherever guest participation is supported.",
    ],
  },
  {
    title: "Fair participation",
    paragraphs: [
      "Do not manipulate predictions, polls, trivia, challenges, points or reward systems.",
      "Fraudulent accounts, automated abuse and deliberate exploitation of platform weaknesses are prohibited.",
    ],
  },
  {
    title: "Reporting and moderation",
    paragraphs: [
      "Community concerns may be reported to contact@sportyfanz.com. Include relevant details without unnecessarily disclosing sensitive information.",
      "SportyFanz may remove content, restrict participation or suspend accounts in response to violations, subject to applicable requirements.",
      "In-platform reporting and moderation features must be verified before they are described as available.",
    ],
  },
],
  },
  {
    title: "4. Fan Points & Rewards Policy",
    sections: [
  {
    title: "Two types of points",
    paragraphs: [
      "SportyFanz distinguishes Progression Points from redeemable Fan Points, also called Fan Points.",
      "Progression Points support fan-level advancement. They are not redeemable rewards currency.",
      "Redeemable Fan Points may be used for eligible rewards according to the applicable reward conditions.",
    ],
  },
  {
    title: "Earning points",
    paragraphs: [
      "Eligible registered members may earn points through activities such as predictions, trivia, polls, challenges and other qualifying opportunities.",
      "Point awards, eligibility conditions, activity limits and deadlines may vary and should be displayed with each activity.",
      "Visitors do not earn registered-member points or rewards merely by browsing the platform.",
    ],
  },
  {
    title: "Fan progression levels",
    paragraphs: [
      "SportyFanz fan progression includes New Fan, Rising Fan, Super Fan, Champion Fan and King Fan.",
      "Progression Points are used for level advancement and are separate from redeemable Fan Points.",
      "Level thresholds and qualifying activities must be confirmed against the implemented progression system before publication.",
    ],
  },
  {
    title: "Reward redemption",
    paragraphs: [
      "Rewards are subject to availability, eligibility, applicable point costs and any clearly displayed redemption conditions.",
      "Points are not cash, are not bank deposits and do not automatically create a right to a monetary payment.",
      "Reward fulfilment procedures, cancellation conditions and any applicable restrictions must be confirmed before publication.",
    ],
  },
  {
    title: "Fair use and corrections",
    paragraphs: [
      "Fraudulent activity, duplicate-account abuse and manipulation of points or rewards may result in review and appropriate enforcement.",
      "Any correction, reversal or restriction of points must be handled according to documented rules and applicable law.",
    ],
  },
],
  },
];

export default function PrivacyPage() {
  return (
    <div className="sf-terms-page">
      <header className="sf-terms-hero">
        <Link href="/about" className="sf-terms-back">
          <ArrowLeft size={16} />
          About SportyFanz
        </Link>

        <div className="sf-terms-hero-icon">
          <ShieldCheck size={30} />
        </div>

        <span className="sf-terms-eyebrow">SPORTYFANZ POLICIES</span>
        <h1>Privacy Policy</h1>
        <p>
          Our terms, privacy practices, community standards
          and rules for fan points and rewards.
        </p>
      </header>

      <div className="sf-terms-layout">
        <nav className="sf-terms-toc" aria-label="SportyFanz policies">
          <strong>SPORTYFANZ POLICIES</strong>
          {policyGroups.map((group, index) => (
            <a href={`#policy-${index + 1}`} key={group.title}>
              {group.title}
            </a>
          ))}
        </nav>

        <article className="sf-terms-content">
          {policyGroups.map((group, groupIndex) => (
            <section
              id={`policy-${groupIndex + 1}`}
              key={group.title}
              className="sf-policy-group"
            >
              <h2>{group.title}</h2>

              {group.sections.map((section) => (
                <div className="sf-policy-subsection" key={section.title}>
                  <h3>{section.title}</h3>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              ))}
            </section>
          ))}

          <div className="sf-terms-contact">
            <Mail size={23} />
            <div>
              <strong>Questions about your privacy?</strong>
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
