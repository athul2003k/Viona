import { SignUp } from '@clerk/nextjs'
import { clerkAppearance } from '@/lib/clerk-appearance'
import { dark } from '@clerk/themes'

export default function Page() {
  return <SignUp appearance={{ ...clerkAppearance, baseTheme: dark }} afterSignInUrl="/" />
}