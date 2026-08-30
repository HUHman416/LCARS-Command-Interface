package com.lcars.padd;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** One-tap verified GitHub APK update flow; Android retains its required installation confirmation. */
final class MobileUpdateManager {
    interface Reporter { void update(String message, boolean error); }
    private static final String RELEASES="https://api.github.com/repos/HUHman416/LCARS-Command-Interface/releases?per_page=12";
    private static final String PENDING="pending-mobile-update.apk";
    private static final ExecutorService NETWORK=Executors.newSingleThreadExecutor();

    private MobileUpdateManager() {}

    static void checkAndInstall(Activity activity,Reporter reporter){
        reporter.update("CHECKING VERIFIED MOBILE RELEASES…",false);
        NETWORK.execute(()->{try{
            JSONArray releases=new JSONArray(readUrl(RELEASES));JSONObject chosen=null,apk=null,sums=null;
            for(int index=0;index<releases.length()&&apk==null;index++){
                JSONObject release=releases.optJSONObject(index);if(release==null||release.optBoolean("draft"))continue;JSONArray assets=release.optJSONArray("assets");if(assets==null)continue;JSONObject releaseApk=null,releaseSums=null;
                for(int assetIndex=0;assetIndex<assets.length();assetIndex++){JSONObject asset=assets.optJSONObject(assetIndex);String name=asset==null?"":asset.optString("name");if(name.endsWith("-Android.apk")&&name.contains("LCARS-Mobile-Environment"))releaseApk=asset;else if(name.equals("SHA256SUMS.txt"))releaseSums=asset;}
                if(releaseApk!=null){chosen=release;apk=releaseApk;sums=releaseSums;}
            }
            if(chosen==null||apk==null)throw new IllegalStateException("No mobile release asset is available");String tag=chosen.optString("tag_name","UNKNOWN");
            if(!isNewer(activity,tag)){String finalTag=tag;activity.runOnUiThread(()->reporter.update("MOBILE CLIENT CURRENT · "+finalTag.toUpperCase(Locale.ROOT),false));return;}
            String expected="";if(sums!=null){String manifest=readUrl(sums.getString("browser_download_url"));String apkName=apk.getString("name");for(String line:manifest.split("\\R"))if(line.trim().endsWith(apkName)){expected=line.trim().split("\\s+")[0].toLowerCase(Locale.ROOT);break;}}
            if(expected.isEmpty())throw new SecurityException("Release checksum is unavailable");File directory=activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);if(directory==null)throw new IllegalStateException("Update storage is unavailable");File target=new File(directory,PENDING);download(apk.getString("browser_download_url"),target,activity,reporter);
            String actual=sha256(target);if(!actual.equals(expected)){target.delete();throw new SecurityException("APK checksum verification failed");}
            activity.getSharedPreferences("lcars-mobile-update",Activity.MODE_PRIVATE).edit().putString("tag",tag).apply();activity.runOnUiThread(()->{reporter.update("VERIFIED "+tag.toUpperCase(Locale.ROOT)+" · OPENING ANDROID INSTALLER",false);install(activity,target);});
        }catch(Exception error){activity.runOnUiThread(()->reporter.update("UPDATE FAILED · "+safe(error),true));}});
    }

    static void resumePendingInstall(Activity activity,Reporter reporter){File directory=activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);File pending=directory==null?null:new File(directory,PENDING);if(pending!=null&&pending.isFile()&&pending.length()>0&&canInstall(activity)){reporter.update("VERIFIED UPDATE READY · OPENING ANDROID INSTALLER",false);install(activity,pending);}}

    private static boolean isNewer(Activity activity,String tag){String release=normalized(tag),current=normalized(currentVersion(activity));int[] target=parts(release),installed=parts(current);if(target[0]==installed[0]&&target[1]==0&&!release.contains(".")&&(current.contains("rc")||current.contains("development")||current.contains("dev")))return true;if(current.startsWith(release))return false;for(int index=0;index<3;index++){if(target[index]>installed[index])return true;if(target[index]<installed[index])return false;}return !release.equals(current);}
    private static String currentVersion(Activity activity){try{return activity.getPackageManager().getPackageInfo(activity.getPackageName(),0).versionName;}catch(Exception ignored){return "0";}}
    private static String normalized(String value){return value.toLowerCase(Locale.ROOT).replace("version","").replaceFirst("^v","").trim();}
    private static int[] parts(String value){int[] result={0,0,0};String[] tokens=value.split("[^0-9]+");int output=0;for(String token:tokens){if(token.isEmpty())continue;try{result[output++]=Integer.parseInt(token);}catch(NumberFormatException ignored){}if(output==result.length)break;}return result;}
    private static boolean canInstall(Activity activity){return Build.VERSION.SDK_INT<26||activity.getPackageManager().canRequestPackageInstalls();}
    private static void install(Activity activity,File apk){
        if(!canInstall(activity)){Intent permission=new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+activity.getPackageName()));activity.startActivity(permission);return;}
        Uri uri=FileProvider.getUriForFile(activity,activity.getPackageName()+".updates",apk);Intent install=new Intent(Intent.ACTION_VIEW);install.setDataAndType(uri,"application/vnd.android.package-archive");install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_ACTIVITY_NEW_TASK);activity.startActivity(install);
    }
    private static void download(String source,File target,Activity activity,Reporter reporter)throws Exception{HttpURLConnection connection=(HttpURLConnection)new URL(source).openConnection();connection.setConnectTimeout(10000);connection.setReadTimeout(30000);connection.setRequestProperty("Accept","application/octet-stream");int size=connection.getContentLength();try(InputStream input=connection.getInputStream();FileOutputStream output=new FileOutputStream(target)){byte[] buffer=new byte[32768];long copied=0;for(int read;(read=input.read(buffer))!=-1;){output.write(buffer,0,read);copied+=read;if(size>0){int percent=(int)Math.min(99,copied*100/size);if(percent%10==0){int shown=percent;activity.runOnUiThread(()->reporter.update("DOWNLOADING MOBILE UPDATE · "+shown+"%",false));}}}}finally{connection.disconnect();}}
    private static String readUrl(String source)throws Exception{HttpURLConnection connection=(HttpURLConnection)new URL(source).openConnection();connection.setConnectTimeout(10000);connection.setReadTimeout(15000);connection.setRequestProperty("Accept","application/vnd.github+json");StringBuilder text=new StringBuilder();try(BufferedReader reader=new BufferedReader(new InputStreamReader(connection.getInputStream(),StandardCharsets.UTF_8))){for(String line;(line=reader.readLine())!=null;)text.append(line);}finally{connection.disconnect();}return text.toString();}
    private static String sha256(File file)throws Exception{MessageDigest digest=MessageDigest.getInstance("SHA-256");try(FileInputStream input=new FileInputStream(file)){byte[] buffer=new byte[32768];for(int read;(read=input.read(buffer))!=-1;)digest.update(buffer,0,read);}StringBuilder value=new StringBuilder();for(byte item:digest.digest())value.append(String.format(Locale.ROOT,"%02x",item));return value.toString();}
    private static String safe(Exception error){return error.getMessage()==null?"UNKNOWN ERROR":error.getMessage();}
}
