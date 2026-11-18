import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { LeyendaFija } from "@/components/LeyendaFija";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#7c2d12" }} edges={["top"]}>
        <StatusBar style="light" />
        <LeyendaFija />
        <View style={{ flex: 1, backgroundColor: "#ffffff" }}>
          <Stack screenOptions={{ headerShown: false }} />
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
