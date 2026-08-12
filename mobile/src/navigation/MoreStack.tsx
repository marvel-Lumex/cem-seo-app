import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { colors } from "../theme/theme";
import MoreScreen from "../screens/MoreScreen";
import ProfileScreen from "../screens/ProfileScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import BillingScreen from "../screens/BillingScreen";
import HelpScreen from "../screens/HelpScreen";
import SearchConsoleScreen from "../screens/SearchConsoleScreen";

const Stack = createNativeStackNavigator();

export default function MoreStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.ink,
        headerShadowVisible: false,
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen name="MoreHome" component={MoreScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
      <Stack.Screen name="SearchConsole" component={SearchConsoleScreen} options={{ title: "Search Console" }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Notifications" }} />
      <Stack.Screen name="Billing" component={BillingScreen} options={{ title: "Billing" }} />
      <Stack.Screen name="Help" component={HelpScreen} options={{ title: "Help & Support" }} />
    </Stack.Navigator>
  );
}
