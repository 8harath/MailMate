"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { AnimatedWave } from "./animated-wave";

const REPO_URL = "https://github.com/8harath/MailMate";

type FooterLink = {
  name: string;
  href: string;
  external?: boolean;
};

const footerLinks: Record<string, FooterLink[]> = {
  Product: [
    { name: "Features", href: "#features" },
    { name: "How it works", href: "#how-it-works" },
    { name: "Pricing", href: "#pricing" },
    { name: "Integrations", href: "#integrations" },
    { name: "Security", href: "#security" },
  ],
  Resources: [
    { name: "Documentation", href: `${REPO_URL}#readme`, external: true },
    { name: "Architecture", href: `${REPO_URL}/blob/main/docs/ARCHITECTURE.md`, external: true },
    { name: "Changelog", href: `${REPO_URL}/blob/main/CHANGELOG.md`, external: true },
    { name: "Report an issue", href: `${REPO_URL}/issues`, external: true },
    { name: "Open demo inbox", href: "/inbox" },
  ],
};

const socialLinks = [{ name: "GitHub", href: REPO_URL, external: true }];

export function FooterSection() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative border-t border-foreground/10">
      {/* Animated wave background */}
      <div className="absolute inset-0 h-64 opacity-20 pointer-events-none overflow-hidden">
        <AnimatedWave />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Main Footer */}
        <div className="py-10 lg:py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 lg:gap-8">
            {/* Brand Column */}
            <div className="col-span-2">
              <Link href="/" className="inline-flex items-center gap-2 mb-6">
                <span className="text-2xl font-display"><span className="font-black">M</span>ail<span className="font-black">M</span>ate</span>
              </Link>

              <p className="text-muted-foreground leading-relaxed mb-8 max-w-xs">
                AI-powered email triage with Google sign-in, inbox analysis, editable drafts, and approval-first workflow actions.
              </p>

              {/* Social Links */}
              <div className="flex gap-6">
                {socialLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 group"
                  >
                    {link.name}
                    <ArrowUpRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </a>
                ))}
              </div>
            </div>

            {/* Link Columns */}
            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <h3 className="text-sm font-medium mb-6">{title}</h3>
                <ul className="space-y-4">
                  {links.map((link) => (
                    <li key={link.name}>
                      <a
                        href={link.href}
                        {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2"
                      >
                        {link.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="py-8 border-t border-foreground/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {year} MailMate. MIT licensed.
          </p>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 hover:text-foreground transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Open source on GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
