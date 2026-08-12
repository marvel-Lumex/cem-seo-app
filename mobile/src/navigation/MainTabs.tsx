import React from "react";
import { Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { colors } from "../theme/theme";
import HomeScreen from "../screens/HomeScreen";
import ProjectsStack from "./ProjectsStack";
import KeywordsScreen from "../screens/KeywordsScreen";
import AuditScreen from "../screens/AuditScreen";
import MoreStack from "./MoreStack";

const Tab = createBottomTabNavigator();

const icons: Record<string, string> = {
  Home: "⌂",
  Projects: "▤",
  Keywords: "◎",
  Audit: "✓",
  More: "⋯",
};

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.purple,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.cardBorder,
          height: 68,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
        tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>{icons[route.name]}</Text>,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Projects" component={ProjectsStack} />
      <Tab.Screen name="Keywords" component={KeywordsScreen} />
      <Tab.Screen name="Audit" component={AuditScreen} />
      <Tab.Screen name="More" component={MoreStack} />
    </Tab.Navigator>
  );
}
