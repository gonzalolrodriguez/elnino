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

// WebView simulado: guarda cada instancia (props y mensajes enviados) para que las pruebas lo inspeccionen.
jest.mock("react-native-webview", () => {
  const React = require("react");
  const { View } = require("react-native");
  const instancias: { props: Record<string, any>; postMessage: jest.Mock }[] = [];
  const WebView = React.forwardRef((props: Record<string, any>, ref: any) => {
    const instancia = React.useRef({ props, postMessage: jest.fn() }).current;
    instancia.props = props;
    React.useEffect(() => {
      instancias.push(instancia);
    }, [instancia]);
    React.useImperativeHandle(ref, () => ({ postMessage: instancia.postMessage }));
    return React.createElement(View, { testID: "webview", accessibilityLabel: props.accessibilityLabel });
  });
  return {
    __esModule: true,
    WebView,
    default: WebView,
    __instancias: instancias,
    __ultima: () => instancias[instancias.length - 1],
    __reiniciar: () => void (instancias.length = 0),
  };
});
