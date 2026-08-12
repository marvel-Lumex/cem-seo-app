import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { colors } from "../theme/theme";
import ProjectsScreen from "../screens/ProjectsScreen";
import ProjectDetailScreen from "../screens/ProjectDetailScreen";
import AddProjectScreen from "../screens/AddProjectScreen";

const Stack = createNativeStackNavigator();

export default function ProjectsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.ink,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="ProjectsList" component={ProjectsScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="ProjectDetail"
        component={ProjectDetailScreen}
        options={({ route }: any) => ({ title: route.params?.domain || "Project" })}
      />
      <Stack.Screen name="AddProject" component={AddProjectScreen} options={{ title: "Add Website" }} />
    </Stack.Navigator>
  );
}
