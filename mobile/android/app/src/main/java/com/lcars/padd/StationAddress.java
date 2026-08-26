package com.lcars.padd;

import java.net.URI;
import java.net.URISyntaxException;

public final class StationAddress {
    public static final int PADD_PORT = 8766;

    private StationAddress() {}

    public static String normalize(String raw) {
        String candidate = raw == null ? "" : raw.trim();
        if (candidate.isEmpty()) {
            throw new IllegalArgumentException("Enter the private IPv4 address shown by LCARS Settings.");
        }
        if (!candidate.contains("://")) {
            candidate = "http://" + candidate;
        }
        final URI uri;
        try {
            uri = new URI(candidate);
        } catch (URISyntaxException error) {
            throw new IllegalArgumentException("That station address is not valid.");
        }
        String host = uri.getHost();
        if (!"http".equalsIgnoreCase(uri.getScheme()) || host == null || !isPrivateIpv4(host)) {
            throw new IllegalArgumentException("Use the private IPv4 address displayed by LCARS, such as 192.168.1.42.");
        }
        int port = uri.getPort() < 0 ? PADD_PORT : uri.getPort();
        if (port != PADD_PORT) {
            throw new IllegalArgumentException("LCARS PADD connections use local port 8766.");
        }
        return "http://" + host + ":" + PADD_PORT + "/";
    }

    public static boolean isAllowedUrl(String candidate, String stationRoot) {
        try {
            URI target = new URI(candidate);
            URI station = new URI(stationRoot);
            int targetPort = target.getPort() < 0 ? PADD_PORT : target.getPort();
            return "http".equalsIgnoreCase(target.getScheme())
                && station.getHost().equalsIgnoreCase(target.getHost())
                && targetPort == PADD_PORT;
        } catch (Exception error) {
            return false;
        }
    }

    private static boolean isPrivateIpv4(String host) {
        String[] pieces = host.split("\\.", -1);
        if (pieces.length != 4) return false;
        int[] octets = new int[4];
        try {
            for (int index = 0; index < pieces.length; index++) {
                if (pieces[index].isEmpty() || pieces[index].length() > 3) return false;
                octets[index] = Integer.parseInt(pieces[index]);
                if (octets[index] < 0 || octets[index] > 255) return false;
            }
        } catch (NumberFormatException error) {
            return false;
        }
        return octets[0] == 10
            || (octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31)
            || (octets[0] == 192 && octets[1] == 168);
    }
}
