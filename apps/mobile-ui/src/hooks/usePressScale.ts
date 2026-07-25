import { useRef } from 'react';
import { Animated } from 'react-native';

export function usePressScale() {
  const scale = useRef(new Animated.Value(1)).current;

  function onPressIn() {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, tension: 80, friction: 8 }).start();
  }
  function onPressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }).start();
  }

  return { scale, onPressIn, onPressOut };
}