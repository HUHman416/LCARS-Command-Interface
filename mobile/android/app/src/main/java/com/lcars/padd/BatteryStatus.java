package com.lcars.padd;

/** Pure battery classification used by the mobile shell and its build-time boundary tests. */
final class BatteryStatus {
    static final String UNKNOWN = "UNKNOWN";
    static final String CHARGING = "CHARGING";
    static final String CRITICAL = "CRITICAL";
    static final String LOW = "LOW";
    static final String READY = "READY";

    private BatteryStatus() {}

    static String classify(int percent, boolean charging) {
        if (percent < 0 || percent > 100) return UNKNOWN;
        if (charging) return CHARGING;
        if (percent <= 10) return CRITICAL;
        if (percent <= 25) return LOW;
        return READY;
    }
}
