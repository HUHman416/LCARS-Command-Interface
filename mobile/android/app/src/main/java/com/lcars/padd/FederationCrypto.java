package com.lcars.padd;

import android.util.Base64;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/** AES-256-GCM transport and request authentication for Version 30.2 links. */
final class FederationCrypto {
    private static final SecureRandom RANDOM = new SecureRandom();

    static byte[] key(String token) throws Exception {
        return MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
    }

    static JSONObject seal(byte[] key, JSONObject value, String aad) throws Exception {
        byte[] nonce = new byte[12];
        RANDOM.nextBytes(nonce);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, nonce));
        cipher.updateAAD(aad.getBytes(StandardCharsets.UTF_8));
        byte[] combined = cipher.doFinal(value.toString().getBytes(StandardCharsets.UTF_8));
        int ciphertextLength = combined.length - 16;
        byte[] ciphertext = new byte[ciphertextLength], tag = new byte[16];
        System.arraycopy(combined, 0, ciphertext, 0, ciphertextLength);
        System.arraycopy(combined, ciphertextLength, tag, 0, 16);
        return new JSONObject()
            .put("secure", 1)
            .put("nonce", Base64.encodeToString(nonce, Base64.NO_WRAP))
            .put("ciphertext", Base64.encodeToString(ciphertext, Base64.NO_WRAP))
            .put("tag", Base64.encodeToString(tag, Base64.NO_WRAP));
    }

    static JSONObject open(byte[] key, JSONObject envelope, String aad) throws Exception {
        if (envelope.optInt("secure", 0) != 1) return envelope;
        byte[] nonce = Base64.decode(envelope.getString("nonce"), Base64.NO_WRAP);
        byte[] ciphertext = Base64.decode(envelope.getString("ciphertext"), Base64.NO_WRAP);
        byte[] tag = Base64.decode(envelope.getString("tag"), Base64.NO_WRAP);
        byte[] combined = new byte[ciphertext.length + tag.length];
        System.arraycopy(ciphertext, 0, combined, 0, ciphertext.length);
        System.arraycopy(tag, 0, combined, ciphertext.length, tag.length);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, nonce));
        cipher.updateAAD(aad.getBytes(StandardCharsets.UTF_8));
        return new JSONObject(new String(cipher.doFinal(combined), StandardCharsets.UTF_8));
    }

    static String signature(byte[] key, String timestamp, String nonce, String method, String path, byte[] body) throws Exception {
        String bodyDigest = hex(MessageDigest.getInstance("SHA-256").digest(body));
        String material = timestamp + "\n" + nonce + "\n" + method.toUpperCase() + "\n/" + path + "\n" + bodyDigest;
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        return Base64.encodeToString(mac.doFinal(material.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
    }

    private static String hex(byte[] value) {
        StringBuilder text = new StringBuilder();
        for (byte part : value) text.append(String.format("%02x", part & 0xff));
        return text.toString();
    }

    private FederationCrypto() {}
}
