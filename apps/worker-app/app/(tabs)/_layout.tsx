import { Stack } from 'expo-router';

export default function TabsLayout() {
return (
<Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
<Stack.Screen name="index" />
<Stack.Screen name="jobs" />
<Stack.Screen name="earnings" />
<Stack.Screen name="profile" />
</Stack>
);
}