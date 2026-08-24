import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAuth } from "@/hooks/use-auth";

export default function TabLayout() {
  const colors = useColors();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 14 : Math.max(insets.bottom, 16);
  const tabBarHeight = 60 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.surface,
          borderTopColor: "#E8EEF6",
          borderTopWidth: 1,
          shadowColor: "#0F172A",
          shadowOpacity: 0.06,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: -3 },
          elevation: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", marginTop: 1 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Hộp thư",
          tabBarIcon: ({ color }) => <MaterialIcons size={25} name="chat-bubble" color={color} />,
        }}
      />
      <Tabs.Screen name="calls" options={{ href: null }} />
      {user?.role === "admin" ? <Tabs.Screen name="admin" options={{ title: "Quản trị", tabBarIcon: ({ color }) => <MaterialIcons size={25} name="admin-panel-settings" color={color} /> }} /> : null}
      <Tabs.Screen name="settings" options={{ title: "Cài đặt", tabBarIcon: ({ color }) => <MaterialIcons size={24} name="settings" color={color} /> }} />
    </Tabs>
  );
}
