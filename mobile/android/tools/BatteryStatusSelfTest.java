package com.lcars.padd;

public final class BatteryStatusSelfTest {
    private static void expect(String actual, String expected) {
        if (!expected.equals(actual)) throw new AssertionError("Expected " + expected + " but received " + actual);
    }

    public static void main(String[] args) {
        expect(BatteryStatus.classify(-1, false), "UNKNOWN");
        expect(BatteryStatus.classify(0, false), "CRITICAL");
        expect(BatteryStatus.classify(10, false), "CRITICAL");
        expect(BatteryStatus.classify(11, false), "LOW");
        expect(BatteryStatus.classify(25, false), "LOW");
        expect(BatteryStatus.classify(26, false), "READY");
        expect(BatteryStatus.classify(100, false), "READY");
        expect(BatteryStatus.classify(5, true), "CHARGING");
        expect(BatteryStatus.classify(101, false), "UNKNOWN");
    }
}
