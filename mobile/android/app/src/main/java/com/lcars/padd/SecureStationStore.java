package com.lcars.padd;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Comparator;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Encrypted, migration-aware registry for the Version 29.3 Connected Station Dock. */
final class SecureStationStore {
    private static final String PREFS = "lcars-stations-v29";
    private static final String REGISTRY = "registry";
    private static final String KEY_ALIAS = "lcars_station_credentials_v29";
    private static final String LEGACY_PREFS = "lcars-padd";
    private static final String LEGACY_STATION = "last-station";
    private static final String LEGACY_TOKEN = "station-token";
    private static final String LEGACY_NAME = "device-name";
    private static final int MAX_STATIONS = 8;

    static final class Station {
        final String id;
        final String address;
        final String label;
        final String deviceName;
        final String token;
        final long updatedAt;

        Station(String id, String address, String label, String deviceName, String token, long updatedAt) {
            this.id = id;
            this.address = address;
            this.label = label;
            this.deviceName = deviceName;
            this.token = token;
            this.updatedAt = updatedAt;
        }
    }

    private final SharedPreferences preferences;
    private final SharedPreferences legacy;

    SecureStationStore(Context context) {
        preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        legacy = context.getSharedPreferences(LEGACY_PREFS, Context.MODE_PRIVATE);
        migrateLegacy();
    }

    synchronized ArrayList<Station> all() {
        ArrayList<Station> result = new ArrayList<>();
        JSONObject root = readRoot();
        JSONArray stations = root.optJSONArray("stations");
        if (stations == null) return result;
        for (int index = 0; index < stations.length(); index++) {
            JSONObject item = stations.optJSONObject(index);
            if (item == null) continue;
            try {
                String address = StationAddress.normalize(item.optString("address"));
                String token = decrypt(item.optString("credential"));
                if (token.isEmpty()) continue;
                result.add(new Station(
                    item.optString("id", stationId(address)), address,
                    clean(item.optString("label", address), 48),
                    clean(item.optString("deviceName", "Personal PADD"), 48),
                    token, item.optLong("updatedAt", 0)
                ));
            } catch (Exception ignored) {}
        }
        result.sort(Comparator.comparingLong((Station station) -> station.updatedAt).reversed());
        return result;
    }

    synchronized Station active() {
        ArrayList<Station> stations = all();
        if (stations.isEmpty()) return null;
        String active = readRoot().optString("active");
        for (Station station : stations) if (station.id.equals(active)) return station;
        return stations.get(0);
    }

    synchronized Station save(String rawAddress, String label, String deviceName, String token) throws Exception {
        String address = StationAddress.normalize(rawAddress);
        String id = stationId(address);
        JSONObject root = readRoot();
        JSONArray old = root.optJSONArray("stations");
        JSONArray next = new JSONArray();
        JSONObject saved = stationJson(id, address, label, deviceName, token, System.currentTimeMillis());
        next.put(saved);
        if (old != null) for (int index = 0; index < old.length() && next.length() < MAX_STATIONS; index++) {
            JSONObject item = old.optJSONObject(index);
            if (item != null && !id.equals(item.optString("id"))) next.put(item);
        }
        root.put("schema", 2);
        root.put("active", id);
        root.put("stations", next);
        writeRoot(root);
        return new Station(id, address, clean(label.isEmpty() ? address : label, 48), clean(deviceName, 48), token, System.currentTimeMillis());
    }

    synchronized void activate(String id) {
        JSONObject root = readRoot();
        try { root.put("active", id); writeRoot(root); } catch (Exception ignored) {}
    }

    synchronized void remove(String id) {
        JSONObject root = readRoot();
        JSONArray old = root.optJSONArray("stations"), next = new JSONArray();
        if (old != null) for (int index = 0; index < old.length(); index++) {
            JSONObject item = old.optJSONObject(index);
            if (item != null && !id.equals(item.optString("id"))) next.put(item);
        }
        try {
            root.put("stations", next);
            if (id.equals(root.optString("active"))) root.put("active", next.length() == 0 ? "" : next.optJSONObject(0).optString("id"));
            writeRoot(root);
        } catch (Exception ignored) {}
    }

    synchronized void clearCredential(String id) { remove(id); }

    private void migrateLegacy() {
        if (preferences.getBoolean("legacy-migrated", false)) return;
        String address = legacy.getString(LEGACY_STATION, "");
        String token = legacy.getString(LEGACY_TOKEN, "");
        String deviceName = legacy.getString(LEGACY_NAME, "Personal PADD");
        boolean migrated = address.isEmpty() || token.isEmpty();
        if (!address.isEmpty() && !token.isEmpty()) {
            try { save(address, "PRIMARY STATION", deviceName, token); migrated = true; }
            catch (Exception ignored) {}
        }
        if (migrated) {
            legacy.edit().remove(LEGACY_TOKEN).remove(LEGACY_STATION).apply();
            preferences.edit().putBoolean("legacy-migrated", true).apply();
        }
    }

    private JSONObject stationJson(String id, String address, String label, String deviceName, String token, long updatedAt) throws Exception {
        JSONObject item = new JSONObject();
        item.put("id", id);
        item.put("address", address);
        item.put("label", clean(label.isEmpty() ? address : label, 48));
        item.put("deviceName", clean(deviceName.isEmpty() ? "Personal PADD" : deviceName, 48));
        item.put("credential", encrypt(token));
        item.put("updatedAt", updatedAt);
        return item;
    }

    private JSONObject readRoot() {
        try {
            JSONObject root = new JSONObject(preferences.getString(REGISTRY, "{}"));
            if (root.optJSONArray("stations") == null) root.put("stations", new JSONArray());
            return root;
        } catch (Exception ignored) {
            JSONObject root = new JSONObject();
            try { root.put("schema", 2); root.put("stations", new JSONArray()); } catch (Exception ignoredAgain) {}
            return root;
        }
    }

    private void writeRoot(JSONObject root) { preferences.edit().putString(REGISTRY, root.toString()).apply(); }

    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(KEY_ALIAS)) return ((KeyStore.SecretKeyEntry) store.getEntry(KEY_ALIAS, null)).getSecretKey();
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .build());
        return generator.generateKey();
    }

    private String encrypt(String value) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key());
        byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
        byte[] payload = new byte[cipher.getIV().length + encrypted.length];
        System.arraycopy(cipher.getIV(), 0, payload, 0, cipher.getIV().length);
        System.arraycopy(encrypted, 0, payload, cipher.getIV().length, encrypted.length);
        return Base64.encodeToString(payload, Base64.NO_WRAP);
    }

    private String decrypt(String encoded) throws Exception {
        byte[] payload = Base64.decode(encoded, Base64.NO_WRAP);
        if (payload.length < 13) return "";
        byte[] iv = new byte[12], encrypted = new byte[payload.length - 12];
        System.arraycopy(payload, 0, iv, 0, 12);
        System.arraycopy(payload, 12, encrypted, 0, encrypted.length);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, iv));
        return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
    }

    private static String stationId(String address) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(address.getBytes(StandardCharsets.UTF_8));
        StringBuilder value = new StringBuilder("station-");
        for (int index = 0; index < 8; index++) value.append(String.format("%02x", digest[index]));
        return value.toString();
    }

    private static String clean(String value, int limit) {
        String compact = value == null ? "" : value.trim().replaceAll("\\s+", " ");
        return compact.substring(0, Math.min(limit, compact.length()));
    }
}
