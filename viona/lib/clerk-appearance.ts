import { dark } from '@clerk/themes';

export const clerkAppearance = {
  elements: {
    rootBox: "w-full",
    cardBox: "w-full",
    card: "bg-[#111111] border border-[#222222] shadow-2xl p-8 w-full rounded-2xl",
    header: "hidden", // We handle branding in the layout
    socialButtonsBlockButton: "bg-[#161616] border border-[#2a2a2a] text-white hover:bg-[#1f1f1f] transition-all rounded-xl h-12",
    socialButtonsBlockButtonText: "font-medium text-sm",
    socialButtonsIconButton: "bg-[#161616] border border-[#2a2a2a] hover:bg-[#1f1f1f] transition-all rounded-xl",
    dividerRow: "my-6",
    dividerLine: "bg-[#2a2a2a]",
    dividerText: "text-stone-500 font-medium text-xs",
    formFieldLabel: "text-stone-300 font-medium mb-1.5",
    formFieldInput: "bg-[#161616] border border-[#2a2a2a] text-white focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all rounded-xl h-11 px-4",
    formButtonPrimary: "bg-emerald-500 text-white hover:bg-emerald-600 transition-all rounded-xl h-11 font-bold text-sm mt-4 shadow-none",
    footer: "mt-6",
    footerActionText: "text-stone-500",
    footerActionLink: "text-emerald-500 hover:text-emerald-400 font-semibold transition-colors",
    identityPreviewText: "text-white",
    identityPreviewEditButton: "text-emerald-500 hover:text-emerald-400 font-semibold",
    formResendCodeLink: "text-emerald-500 hover:text-emerald-400 font-semibold",
    otpCodeFieldInput: "bg-[#161616] border border-[#2a2a2a] text-white focus:border-emerald-500/50 rounded-xl",
  },
  layout: {
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const,
    shimmer: true,
  }
};

