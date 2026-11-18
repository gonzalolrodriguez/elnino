// Con pnpm las rutas son node_modules/.pnpm/<paquete>/node_modules/<paquete>/...: se deja pasar
// ".pnpm/" y la decisión la toma la segunda aparición de node_modules/.
const permitidos = [
  "(jest-)?react-native",
  "@react-native(-community)?",
  "expo(nent)?",
  "@expo(nent)?",
  "@expo-google-fonts",
  "react-navigation",
  "@react-navigation",
  "@sentry/react-native",
  "native-base",
  "react-native-svg",
  "@evacuaciones",
  "test-renderer",
].join("|");

module.exports = {
  preset: "jest-expo",
  testTimeout: 30000,
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  testPathIgnorePatterns: ["/node_modules/", "/.expo/"],
  transformIgnorePatterns: [`node_modules/(?!(\\.pnpm/|${permitidos}))`],
};
