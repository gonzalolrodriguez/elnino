import NetInfo from "@react-native-community/netinfo";

import { hayRed } from "@/lib/red";

describe("hayRed", () => {
  const fetchMock = NetInfo.fetch as jest.Mock;

  it("en una LAN sin internet (isInternetReachable=false) sigue habiendo red hacia el servidor", async () => {
    fetchMock.mockResolvedValueOnce({ isConnected: true, isInternetReachable: false });
    expect(await hayRed()).toBe(true);
  });

  it("sin conexión de red no hay red", async () => {
    fetchMock.mockResolvedValueOnce({ isConnected: false, isInternetReachable: false });
    expect(await hayRed()).toBe(false);
    fetchMock.mockResolvedValueOnce({ isConnected: null, isInternetReachable: null });
    expect(await hayRed()).toBe(false);
  });
});
