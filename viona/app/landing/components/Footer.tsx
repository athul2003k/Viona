import React from "react";
import {
  Mail,
  Phone,
  MapPin,
  Twitter,
  Linkedin,
  Github,
  Facebook,
  LucideIcon,
} from "lucide-react";

interface FooterLink {
  name: string;
  href: string;
}

interface FooterLinks {
  Product: FooterLink[];
  Company: FooterLink[];
  Resources: FooterLink[];
  Legal: FooterLink[];
}

interface SocialLink {
  name: string;
  icon: LucideIcon;
  href: string;
}

const Footer: React.FC = () => {
  const footerLinks: FooterLinks = {
    Product: [
      { name: "Features", href: "#features" },
      { name: "Pricing", href: "#pricing" },
      { name: "Integrations", href: "#" },
      { name: "API Docs", href: "#" },
      { name: "Changelog", href: "#" },
    ],
    Company: [
      { name: "About Us", href: "#" },
      { name: "Careers", href: "#" },
      { name: "Blog", href: "#" },
      { name: "Press Kit", href: "#" },
      { name: "Contact", href: "#" },
    ],
    Resources: [
      { name: "Help Center", href: "#" },
      { name: "Tutorials", href: "#" },
      { name: "Webinars", href: "#" },
      { name: "Case Studies", href: "#" },
      { name: "Community", href: "#" },
    ],
    Legal: [
      { name: "Privacy Policy", href: "#" },
      { name: "Terms of Service", href: "#" },
      { name: "Cookie Policy", href: "#" },
      { name: "GDPR", href: "#" },
      { name: "Security", href: "#" },
    ],
  };

  const socialLinks: SocialLink[] = [
    { name: "Twitter", icon: Twitter, href: "#" },
    { name: "LinkedIn", icon: Linkedin, href: "#" },
    { name: "Facebook", icon: Facebook, href: "#" },
    { name: "GitHub", icon: Github, href: "#" },
  ];

  const scrollToSection = (sectionId: string) => {
    if (sectionId.startsWith("#") && sectionId !== "#") {
      const element = document.getElementById(sectionId.substring(1));
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <footer className="bg-neutral-950 border-t border-white/5 relative">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Main Footer Content */}
        <div className="py-16">
          <div className="grid lg:grid-cols-5 gap-8">
            {/* Company Info */}
            <div className="lg:col-span-2">
              <div className="space-y-4">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  Viona Pro
                </h3>
                <p className="text-neutral-400 max-w-md">
                  Transform your business with AI-powered analytics, real-time
                  insights, and streamlined operations. Join thousands of
                  successful companies worldwide.
                </p>

                {/* Contact Info */}
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-neutral-500">
                    <Mail className="h-4 w-4 mr-2 text-neutral-600" />
                    hello@bizflowpro.com
                  </div>
                  <div className="flex items-center text-sm text-neutral-500">
                    <Phone className="h-4 w-4 mr-2 text-neutral-600" />
                    +1 (555) 123-4567
                  </div>
                  <div className="flex items-center text-sm text-neutral-500">
                    <MapPin className="h-4 w-4 mr-2 text-neutral-600" />
                    San Francisco, CA
                  </div>
                </div>

                {/* Social Links */}
                <div className="flex space-x-3 pt-4">
                  {socialLinks.map((social, index) => {
                    const IconComponent = social.icon;
                    return (
                      <a
                        key={index}
                        href={social.href}
                        className="p-2 bg-white/5 rounded-lg text-neutral-500 hover:bg-emerald-500/10 hover:text-emerald-400 transition-all duration-300 border border-white/5 hover:border-emerald-500/20"
                        aria-label={social.name}
                      >
                        <IconComponent className="h-4 w-4" />
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer Links */}
            {Object.entries(footerLinks).map(([category, links]) => (
              <div key={category}>
                <h4 className="font-semibold text-white mb-4">
                  {category}
                </h4>
                <ul className="space-y-2">
                  {links.map((link: FooterLink, index: number) => (
                    <li key={index}>
                      <button
                        onClick={() => scrollToSection(link.href)}
                        className="text-sm text-neutral-500 hover:text-emerald-400 transition-colors duration-300 text-left"
                      >
                        {link.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Newsletter Signup */}
        <div className="py-8 border-t border-white/5">
          <div className="max-w-md mx-auto text-center lg:text-left lg:max-w-none lg:flex lg:items-center lg:justify-between">
            <div>
              <h4 className="text-lg font-semibold text-white mb-2">
                Stay updated with our newsletter
              </h4>
              <p className="text-sm text-neutral-500">
                Get the latest product updates, tips, and exclusive offers.
              </p>
            </div>
            <div className="mt-4 lg:mt-0 lg:ml-8">
              <div className="flex max-w-md mx-auto lg:mx-0">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-2 text-sm border border-white/10 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-transparent bg-white/5 text-white placeholder-neutral-600"
                />
                <button className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-sm font-medium rounded-r-lg hover:from-emerald-400 hover:to-cyan-400 transition-all">
                  Subscribe
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="py-6 border-t border-white/5">
          <div className="flex flex-col lg:flex-row justify-between items-center space-y-4 lg:space-y-0">
            <div className="text-sm text-neutral-600">
              © 2025 Viona Pro. All rights reserved.
            </div>
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2 text-xs text-neutral-500">
                <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-sm shadow-emerald-500/50"></div>
                <span>All systems operational</span>
              </div>
              <div className="text-xs text-neutral-600">
                Made with ❤️ by Anvin George.
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
