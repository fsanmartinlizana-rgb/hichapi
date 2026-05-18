/**
 * OnboardingNavigator — wraps OnboardingScreen for the first-launch flow.
 */

import React from 'react';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';

interface Props {
  onComplete: () => void;
}

export default function OnboardingNavigator({ onComplete }: Props) {
  return <OnboardingScreen onComplete={onComplete} isTutorial={false} />;
}
