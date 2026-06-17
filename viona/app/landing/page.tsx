"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";
import "./landing.css";

import HeroSection from "./components/HeroSection";
import MacbookScrollSection from "./components/MacbookScrollSection";
import HeroParallaxSection from "./components/HeroParallaxSection";
import FeaturesSection from "./components/FeaturesSection";
import WorkflowShowcase from "./components/WorkflowShowcase";
import PricingSection from "./components/PricingSection";
import CTASection from "./components/CTASection";
import Footer from "./components/Footer";
import Header from "./components/Header";

export default function LandingPage() {
  const { isSignedIn } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn) {
      router.push("/");
    }
  }, [isSignedIn, router]);

  const handleGetStarted = () => {
    router.push("/sign-up");
  };

  const handleLogin = () => {
    router.push("/sign-in");
  };

  return (
    <div className="dark">
      <div className="min-h-screen bg-black text-white relative selection:bg-emerald-500/20 overflow-hidden">
        <Header onSignIn={handleLogin} onGetStarted={handleGetStarted} />

        <main className="relative z-10 w-full">
          <HeroSection onGetStarted={handleGetStarted} />
          <MacbookScrollSection />
          <HeroParallaxSection />
          <FeaturesSection />
          <WorkflowShowcase />
          <PricingSection onGetStarted={handleGetStarted} />
          <CTASection onGetStarted={handleGetStarted} />

          <SignedOut>
            <div className="text-center my-8">
              <div className="space-x-4">
                <SignInButton>
                  <button className="bg-emerald-500 text-white px-4 py-2 rounded-md hover:bg-emerald-400 transition">
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton>
                  <button className="bg-white/10 text-white px-4 py-2 rounded-md hover:bg-white/20 transition border border-white/10">
                    Sign Up
                  </button>
                </SignUpButton>
              </div>
              <p className="mt-2 text-neutral-400 text-sm">
                Sign in or sign up using the buttons above.
              </p>
            </div>
          </SignedOut>
        </main>

        <Footer />
      </div>
    </div>
  );
}
