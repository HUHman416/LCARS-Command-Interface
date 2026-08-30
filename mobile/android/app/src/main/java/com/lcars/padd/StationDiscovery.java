package com.lcars.padd;

import org.json.JSONObject;

import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;

/** Bounded LAN broadcast discovery for explicitly enabled LCARS stations. */
final class StationDiscovery {
    static final int PORT = 8767;
    private static final byte[] QUERY = "LCARS_FEDERATION_DISCOVER_V1".getBytes(StandardCharsets.UTF_8);

    static final class Result {
        final String address, name, fingerprint, version;
        final boolean pairing;
        Result(String address, String name, String fingerprint, String version, boolean pairing) {
            this.address=address;this.name=name;this.fingerprint=fingerprint;this.version=version;this.pairing=pairing;
        }
    }

    static ArrayList<Result> scan() {
        ArrayList<Result> found=new ArrayList<>();HashSet<String> seen=new HashSet<>();
        try(DatagramSocket socket=new DatagramSocket()){
            socket.setBroadcast(true);socket.setSoTimeout(450);
            DatagramPacket query=new DatagramPacket(QUERY,QUERY.length,InetAddress.getByName("255.255.255.255"),PORT);socket.send(query);
            long until=System.currentTimeMillis()+1800;
            while(System.currentTimeMillis()<until){
                try{byte[] buffer=new byte[2048];DatagramPacket packet=new DatagramPacket(buffer,buffer.length);socket.receive(packet);JSONObject value=new JSONObject(new String(packet.getData(),0,packet.getLength(),StandardCharsets.UTF_8));if(!"lcars-federation-v1".equals(value.optString("protocol")))continue;JSONObject station=value.optJSONObject("station");String address="http://"+packet.getAddress().getHostAddress()+":"+value.optInt("port",8766)+"/";if(!seen.add(address))continue;found.add(new Result(address,station==null?"LCARS STATION":station.optString("name","LCARS STATION"),station==null?"":station.optString("fingerprint"),value.optString("version","UNKNOWN"),value.optBoolean("pairing",false)));}catch(java.net.SocketTimeoutException ignored){}
            }
        }catch(Exception ignored){}
        return found;
    }

    private StationDiscovery() {}
}
