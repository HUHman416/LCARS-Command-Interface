package com.lcars.padd;

/** Pure battery classification used by the mobile shell and its build-time boundary tests. */
final class BatteryStatus {
    private BatteryStatus() {}

    static String classify(int percent, boolean charging) {
        if (percent < 0 || percent > 100) return "UNKNOWN";
        if (charging) return "CHARGING";
        if (percent <= 10) return "CRITICAL";
        if (percent <= 25) return "LOW";
        return "READY";
    }
}
