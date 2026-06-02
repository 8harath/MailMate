"use client";

import { ArrowRight, Check } from "lucide-react";

const REPO_URL = "https://github.com/8harath/MailMate";

const plans = [
  {
    name: "Demo",
    description: "Explore every feature with realistic sample data",
    priceLabel: "Free",
    priceNote: "no signup",
    features: [
      "Pre-loaded inbox with realistic threads",
      "AI thread summaries and priority tagging",
      "Smart reply drafts and writing tools",
      "Task extraction and deadline detection",
      "Meeting detection with calendar preview",
    ],
    cta: "Open demo inbox",
    href: "/inbox",
    popular: false,
  },
  {
    name: "Connect your Gmail",
    description: "Bring your own Google and Groq keys",
    priceLabel: "Free",
    priceNote: "your API usage",
    features: [
      "Live Gmail inbox with send and sync",
      "Google Calendar integration",
      "AI analysis on your real threads",
      "AI chat assistant with full thread context",
      "Custom labels and inbox organization",
      "Approval-gated automation actions",
    ],
    cta: "Connect Google",
    href: "/auth/signin",
    popular: true,
  },
  {
    name: "Self-host",
    description: "Run your own instance, fully under your control",
    priceLabel: "Open source",
    priceNote: "MIT licensed",
    features: [
      "One-click Vercel deploy or Docker image",
      "Optional Supabase for persistence",
      "Full source on GitHub",
      "No vendor lock-in",
      "You hold all data, tokens, and API keys",
    ],
    cta: "View on GitHub",
    href: REPO_URL,
    popular: false,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="relative py-16 lg:py-20 border-t border-foreground/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="max-w-3xl mb-12">
          <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase block mb-6">
            Pricing
          </span>
          <h2 className="font-display text-5xl md:text-6xl lg:text-7xl tracking-tight text-foreground mb-6">
            Free and open source.
            <br />
            <span className="text-stroke">No inbox surprises.</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl">
            Start with the demo, connect your own Gmail when you are ready, or self-host the whole thing. MailMate is MIT licensed — you only pay the Google and Groq usage your account incurs.
          </p>
        </div>

        {/* Plan Cards */}
        <div className="grid md:grid-cols-3 gap-px bg-foreground/10">
          {plans.map((plan, idx) => {
            const external = plan.href.startsWith("http");
            return (
              <div
                key={plan.name}
                className={`relative p-8 lg:p-12 bg-background ${
                  plan.popular ? "md:-my-4 md:py-12 lg:py-16 border-2 border-foreground" : ""
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-8 px-3 py-1 bg-foreground text-primary-foreground text-xs font-mono uppercase tracking-widest">
                    Most Popular
                  </span>
                )}

                {/* Plan Header */}
                <div className="mb-8">
                  <span className="font-mono text-xs text-muted-foreground">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-display text-3xl text-foreground mt-2">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                </div>

                {/* Price */}
                <div className="mb-8 pb-8 border-b border-foreground/10">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-4xl lg:text-5xl text-foreground">
                      {plan.priceLabel}
                    </span>
                    <span className="text-muted-foreground">{plan.priceNote}</span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-4 mb-10">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-foreground mt-0.5 shrink-0" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <a
                  href={plan.href}
                  {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
                  className={`w-full py-4 flex items-center justify-center gap-2 text-sm font-medium transition-all group ${
                    plan.popular
                      ? "bg-foreground text-primary-foreground hover:bg-foreground/90"
                      : "border border-foreground/20 text-foreground hover:border-foreground hover:bg-foreground/5"
                  }`}
                >
                  {plan.cta}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </a>
              </div>
            );
          })}
        </div>

        {/* Bottom Note */}
        <p className="mt-12 text-center text-sm text-muted-foreground">
          MailMate runs on infrastructure you control. Email content is sent only to the APIs you configure — Google and Groq — and never to a MailMate-operated service.{" "}
          <a href="#security" className="underline underline-offset-4 hover:text-foreground transition-colors">
            Learn about the trust model
          </a>
        </p>
      </div>
    </section>
  );
}
