import { SignIn } from '@clerk/nextjs';
import { clerkAppearance } from '@/lib/clerk-appearance';
import { dark } from '@clerk/themes';

export default function Page() {
  return <SignIn appearance={{ ...clerkAppearance, baseTheme: dark }} />;
}

