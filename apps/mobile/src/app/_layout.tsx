import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { MarcoApp } from "@/components/MarcoApp";
import { SesionProvider } from "@/lib/SesionContext";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SesionProvider>
        <MarcoApp>
          <Stack screenOptions={{ headerShown: false }} />
        </MarcoApp>
      </SesionProvider>
    </SafeAreaProvider>
  );
}
