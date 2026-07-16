import { useProfile } from '@/features/profile/ProfileProvider';
import { ProfileForm } from '@/features/profile/ProfileForm';

export function OnboardingScreen() {
  const { setProfile } = useProfile();
  return <ProfileForm mode="onboarding" onSaved={setProfile} />;
}
