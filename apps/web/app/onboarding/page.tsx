import type { Metadata } from "next";
import { OnboardingFlow } from "./onboarding-flow";

export const metadata: Metadata = { title: "Chọn kỹ năng" };

export default function OnboardingPage() {
  return <OnboardingFlow />;
}
