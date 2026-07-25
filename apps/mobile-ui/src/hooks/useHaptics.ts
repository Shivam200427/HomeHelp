import * as Haptics from 'expo-haptics';

type ImpactStyle = 'light' | 'medium' | 'heavy';

export function useHaptics() {
  function impact(style: ImpactStyle = 'light') {
    const key = style.charAt(0).toUpperCase() + style.slice(1);
    const value = (Haptics.ImpactFeedbackStyle as Record<string, Haptics.ImpactFeedbackStyle>)[key];
    if (value != null) {
      try { Haptics.impactAsync(value); } catch {}
    }
  }
  function notification(type: 'success' | 'warning' | 'error' = 'success') {
    const key = type.charAt(0).toUpperCase() + type.slice(1);
    const value = (Haptics.NotificationFeedbackType as Record<string, Haptics.NotificationFeedbackType>)[key];
    if (value != null) {
      try { Haptics.notificationAsync(value); } catch {}
    }
  }
  return { impact, notification };
}