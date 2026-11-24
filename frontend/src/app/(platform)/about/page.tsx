import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Trophy,
  Users,
  Radio,
  MessageCircle,
  Target,
  Brain,
  Gift,
  Crown,
  Heart,
  Globe2,
  Sparkles,
} from "lucide-react";
import "./about.css";

export const metadata: Metadata = {
  title: "About Us | SportyFanz",
  description:
    "Discover SportyFanz, the sports fan community bringing fans together through live sports, conversations, predictions, trivia and rewards.",
};

const features = [
  {
    icon: Radio,
    href: "/live",
    buttonText: "View Live Matches",
    title: "Stay in the Game",
    description:
      "Follow live scores, match updates and the moments that matter across your favourite sports.",
  },
  {
    icon: MessageCircle,
    href: "/fanroom",
    buttonText: "Explore Fan Rooms",
    title: "Find Your Fan Room",
    description:
      "Join conversations, share reactions and connect with fans who understand your passion.",
  },
  {
    icon: Target,
    href: "/participate",
    buttonText: "Make Predictions",
    title: "Make Your Predictions",
    description:
      "Put your sporting knowledge to the test by predicting match outcomes.",
  },
  {
    icon: Brain,
    href: "/participate",
    buttonText: "Join Activities",
    title: "Play, Vote & Participate",
    description:
      "Take part in sports trivia, polls and challenges that make every fan's opinion count.",
  },
  {
    icon: Gift,
    href: "/rewards",
    buttonText: "Explore Rewards",
    title: "Earn Fan Points",
    description:
      "Registered fans can earn points through eligible activities and explore available rewards.",
  },
  {
    icon: Crown,
    href: "/kingdom",
    buttonText: "Enter My Kingdom",
    title: "Build Your Fan Kingdom",
    description:
      "Grow your fan identity, follow your progress and celebrate your journey through fan levels.",
  },
];

export default function AboutPage() {
  return (
    <div className="sf-about">
      <section className="sf-about-hero">
        <div className="sf-about-hero-content">
          <span className="sf-about-eyebrow">
            <Sparkles size={16} />
            WELCOME TO SPORTYFANZ
          </span>

          <h1>
            Sport is more than a game.
            <span> It&apos;s where we belong.</span>
          </h1>

          <p>
            We&apos;re building a home for the passion, excitement,
            friendships and unforgettable moments that make being
            a sports fan extraordinary.
          </p>

          <strong>Every Sport. Every Fan. Every Moment.</strong>

          <div className="sf-about-hero-actions">
            <Link href="/register" className="sf-about-button-primary">
              Join<ArrowRight size={17} />
            </Link>

            <Link href="/discover" className="sf-about-button-outline">
              Explore the Platform
            </Link>
          </div>
        </div>

        <div className="sf-about-hero-art" aria-hidden="true">
          <div className="sf-about-orbit sf-about-orbit-one" />
          <div className="sf-about-orbit sf-about-orbit-two" />
          <div className="sf-about-crown">
            <Crown size={76} strokeWidth={1.5} />
          </div>
          <span className="sf-about-sport sf-about-sport-one">⚽</span>
          <span className="sf-about-sport sf-about-sport-two">🏀</span>
          <span className="sf-about-sport sf-about-sport-three">🏏</span>
          <span className="sf-about-sport sf-about-sport-four">🏆</span>
        </div>
      </section>

      <section className="sf-about-intro">
        <div className="sf-about-intro-visual">
          <img
            src="/about-fans.png"
            alt="SportyFanz supporters celebrating their love of sport"
            loading="lazy"
          />
        </div>

        <div>
          <span className="sf-about-kicker">WHO WE ARE</span>
          <p>
            SportyFanz is a digital sports fan community where
            supporters can follow the action, discover sports,
            join conversations and participate in activities
            that bring their passion to life.
          </p>

          <p>
            Whether you&apos;re celebrating a last-minute winner,
            debating a big decision or discovering a new team,
            SportyFanz is designed to make those experiences
            more connected, interactive and rewarding.
          </p>
        </div>
      </section>

      <section className="sf-about-mission-grid">
        <article className="sf-about-mission-card">
          <div className="sf-about-icon">
            <Heart size={24} />
          </div>
          <span>OUR MISSION</span>
          <h3>Bring every fan closer to the action.</h3>
          <p>
            Create a welcoming space where sports fans can
            connect, express themselves, participate and
            celebrate the sports they love.
          </p>
        </article>

        <article className="sf-about-mission-card">
          <div className="sf-about-icon">
            <Globe2 size={24} />
          </div>
          <span>OUR VISION</span>
          <h3>A world connected by the love of sport.</h3>
          <p>
            Build an inclusive fan community where different
            sports, teams and supporters come together through
            shared experiences.
          </p>
        </article>

        <article className="sf-about-mission-card">
          <div className="sf-about-icon">
            <Users size={24} />
          </div>
          <span>OUR BELIEF</span>
          <h3>The fan is at the heart of every moment.</h3>
          <p>
            Great sports experiences are shaped not only by
            what happens on the field, but by the people who
            cheer, discuss and celebrate together.
          </p>
        </article>
      </section>

      <section className="sf-about-features">
        <div className="sf-about-section-heading">
          <span className="sf-about-kicker">EXPLORE THE EXPERIENCE</span>
          <h2>There&apos;s more to being a fan.</h2>
          <p>
            From matchday excitement to everyday participation,
            discover the experiences waiting for you.
          </p>
        </div>

        <div className="sf-about-feature-grid">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <article className="sf-about-feature-card" key={feature.title}>
                <div className="sf-about-feature-icon">
                  <Icon size={23} />
                </div>

                <h3>{feature.title}</h3>
                <p>{feature.description}</p>

                <Link href={feature.href} className="sf-about-feature-link">
                  {feature.buttonText}
                  <ArrowRight size={16} />
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="sf-about-kingdom">
        <div className="sf-about-kingdom-visual">
          <img
            src="/about-kingdom.png"
            alt="SportyFanz fans celebrating their shared sporting passion"
            loading="lazy"
          />
        </div>

        <div>
          <span className="sf-about-kicker">YOUR FAN KINGDOM</span>
          <p>
            Follow your favourite sports, join the conversation,
            take part in fan activities and grow your identity
            within the SportyFanz community. Every fan brings
            something unique to the game.
          </p>

          <Link href="/kingdom">
            Explore Your Kingdom <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      <section className="sf-about-join">
        <span>THE NEXT MOMENT STARTS WITH YOU</span>
        <h2>Ready to be part of something bigger?</h2>
        <p>
          Your sports. Your voice. Your community.
          Come experience.
        </p>

        <div className="sf-about-join-actions">
          <Link href="/register" className="sf-about-button-primary">
            Become a Member <ArrowRight size={17} />
          </Link>

          <Link href="/participate" className="sf-about-button-outline">
            Explore Fan Activities
          </Link>
        </div>
      </section>
    </div>
  );
}
