package com.lcars.padd;

public final class StationAddressSelfTest {
    public static void main(String[] args) {
        expect("http://192.168.1.42:8766/", StationAddress.normalize("192.168.1.42"));
        expect("http://10.0.0.8:8766/", StationAddress.normalize("http://10.0.0.8:8766"));
        expect("http://172.31.4.9:8766/", StationAddress.normalize("172.31.4.9"));
        reject("https://192.168.1.42");
        reject("8.8.8.8");
        reject("192.168.1.42:8080");
        reject("example.com");
        if (!StationAddress.isAllowedUrl("http://192.168.1.42:8766/api/padd/status", "http://192.168.1.42:8766/")) fail("same-station API URL rejected");
        if (StationAddress.isAllowedUrl("http://192.168.1.43:8766/", "http://192.168.1.42:8766/")) fail("other host accepted");
        System.out.println("LCARS Android station-address guard: OK");
    }

    private static void reject(String value) {
        try {
            StationAddress.normalize(value);
            fail("accepted unsafe address " + value);
        } catch (IllegalArgumentException expected) {
            // Expected.
        }
    }

    private static void expect(String expected, String actual) {
        if (!expected.equals(actual)) fail("expected " + expected + " but got " + actual);
    }

    private static void fail(String message) {
        throw new AssertionError(message);
    }
}
