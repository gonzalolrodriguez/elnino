process.env.EXPO_PUBLIC_API_URL = "http://localhost:8000";

// Simulaciones de los módulos nativos que no existen en el entorno de pruebas.
jest.mock("expo-secure-store", () => {
  const almacen = new Map<string, string>();
  return {
    __almacen: almacen,
    setItemAsync: jest.fn(async (k: string, v: string) => void almacen.set(k, v)),
    getItemAsync: jest.fn(async (k: string) => almacen.get(k) ?? null),
    deleteItemAsync: jest.fn(async (k: string) => void almacen.delete(k)),
  };
});

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })),
    addEventListener: jest.fn(() => () => undefined),
  },
}));

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  scheduleNotificationAsync: jest.fn(async () => "id"),
  AndroidImportance: { HIGH: 4 },
}));

jest.mock("react-native-maps", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: View, Marker: View, Polygon: View };
});
