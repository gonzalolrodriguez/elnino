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

// En el monorepo pnpm instala dos variantes de react-native (con React 18 para la web y con React 19 para la
// app). jest-expo puede resolver la de React 18 desde su propia carpeta: se fija la de esta app.
const path = require("path");
const RN = path.dirname(require.resolve("react-native/package.json", { paths: [__dirname] })).split(path.sep).join("/");

module.exports = {
  preset: "jest-expo",
  testTimeout: 30000,
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^react-native$": RN,
    "^react-native/(Libraries|src|jest)/(.*)$": `${RN}/$1/$2`,
  },
  testPathIgnorePatterns: ["/node_modules/", "/.expo/"],
  transformIgnorePatterns: [`node_modules/(?!(\\.pnpm/|${permitidos}))`],
};
