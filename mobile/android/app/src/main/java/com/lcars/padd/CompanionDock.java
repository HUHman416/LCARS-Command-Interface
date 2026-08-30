package com.lcars.padd;

import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.text.InputType;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Native Companion page embedded inside the Version 29.3 Home shell. */
final class CompanionDock extends LinearLayout {
    private static final int BLACK=Color.BLACK,PANEL=Color.rgb(18,16,22),DIM=Color.rgb(35,31,40);
    private static final int ORANGE=Color.rgb(255,152,104),PEACH=Color.rgb(244,182,107),PINK=Color.rgb(233,155,197);
    private static final int BLUE=Color.rgb(130,154,241),VIOLET=Color.rgb(182,157,232);
    private static final String CHANNEL="lcars-connected-operations",NOTICE="last-notice-v29",SIGNAL="last-signal-v29",MEDIA_TARGET="media-target-v29";

    private final Activity host;
    private final SecureStationStore stations;
    private final SharedPreferences local;
    private final ExecutorService network=Executors.newSingleThreadExecutor();
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final Runnable poll=new Runnable(){@Override public void run(){if(running&&!setup)refresh(false);handler.postDelayed(this,3000);}};
    private SecureStationStore.Station station;
    private JSONObject latest;
    private String tab="status";
    private boolean running,setup;
    private TextView status;
    private LinearLayout body;

    CompanionDock(Activity host,SecureStationStore stations){
        super(host);this.host=host;this.stations=stations;local=host.getSharedPreferences("lcars-padd",Context.MODE_PRIVATE);
        setOrientation(VERTICAL);setBackgroundColor(BLACK);prepareNotifications();
    }

    void start(){running=true;show();handler.removeCallbacks(poll);handler.postDelayed(poll,3000);}
    void stop(){running=false;handler.removeCallbacks(poll);}
    void destroy(){stop();network.shutdownNow();}

    private void show(){
        removeAllViews();station=stations.active();
        if(station==null||setup){showSetup();return;}
        showConsole();
    }

    private void showSetup(){
        setup=true;addView(section("CONNECTED STATION DOCK","PAIR STATION",stations.all().size()+" SAVED"),match(dp(6)));
        ArrayList<SecureStationStore.Station> saved=stations.all();
        if(!saved.isEmpty()){
            LinearLayout list=panel(BLUE);list.addView(field("SAVED STATIONS"),match(dp(5)));
            for(SecureStationStore.Station item:saved){Button choose=button(item.label+" · "+item.address,BLUE);choose.setOnClickListener(v->{stations.activate(item.id);setup=false;latest=null;show();});list.addView(choose,match(dp(3)));}
            addView(list,match(dp(6)));
        }
        LinearLayout form=panel(ORANGE);
        EditText address=input("STATION ADDRESS · 192.168.1.42",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_URI);
        EditText label=input("STATION NAME · BRIDGE",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_CAP_WORDS);
        EditText device=input("PADD NAME",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_CAP_WORDS);device.setText("Personal PADD");
        EditText code=input("SIX-DIGIT PAIRING CODE",InputType.TYPE_CLASS_NUMBER);code.setImeOptions(EditorInfo.IME_ACTION_GO);
        TextView message=text("",PINK,10,true);Button pair=button("PAIR + SAVE STATION",ORANGE);
        View.OnClickListener submit=v->pair(address.getText().toString(),label.getText().toString(),device.getText().toString(),code.getText().toString(),pair,message);
        pair.setOnClickListener(submit);code.setOnEditorActionListener((view,action,event)->{if(action==EditorInfo.IME_ACTION_GO){submit.onClick(view);return true;}return false;});
        form.addView(field("PRIVATE STATION ADDRESS"),match(dp(3)));form.addView(address,match(dp(7)));
        form.addView(field("STATION LABEL"),match(dp(3)));form.addView(label,match(dp(7)));
        form.addView(field("DEVICE NAME"),match(dp(3)));form.addView(device,match(dp(7)));
        form.addView(field("ONE-USE CODE"),match(dp(3)));form.addView(code,match(dp(8)));form.addView(pair,match(dp(5)));form.addView(message,match(0));addView(form,match(0));
    }

    private void pair(String rawAddress,String label,String deviceName,String code,Button pair,TextView message){
        final String address;try{address=StationAddress.normalize(rawAddress);}catch(Exception error){message.setText(error.getMessage());return;}
        if(!code.matches("[0-9]{6}")){message.setText("ENTER THE SIX-DIGIT CODE FROM DESKTOP SETTINGS");return;}
        pair.setEnabled(false);pair.setText("PAIRING…");message.setText("CONTACTING PRIVATE STATION…");
        JSONObject payload=new JSONObject();try{payload.put("name",deviceName.trim().isEmpty()?"Personal PADD":deviceName.trim());payload.put("code",code);}catch(Exception ignored){}
        network.execute(()->{try{
            JSONObject result=request(address,"POST","api/padd/pair",payload,"");
            stations.save(address,label.trim().isEmpty()?"LCARS STATION":label.trim(),deviceName.trim().isEmpty()?"Personal PADD":deviceName.trim(),result.getString("token"));
            host.runOnUiThread(()->{setup=false;latest=null;show();Toast.makeText(host,"STATION ADDED TO SECURE DOCK",Toast.LENGTH_LONG).show();});
        }catch(Exception error){host.runOnUiThread(()->{pair.setEnabled(true);pair.setText("PAIR + SAVE STATION");message.setText("PAIRING FAILED · "+safeMessage(error));});}});
    }

    private void showConsole(){
        setup=false;ArrayList<SecureStationStore.Station> all=stations.all();
        addView(section("CONNECTED STATION DOCK",station.label,all.size()+" STATION"+(all.size()==1?"":"S")),match(dp(5)));
        LinearLayout stationBar=row(BLACK);
        for(SecureStationStore.Station item:all){Button select=button(item.id.equals(station.id)?"● "+item.label:item.label,item.id.equals(station.id)?ORANGE:DIM);select.setTextColor(item.id.equals(station.id)?BLACK:Color.LTGRAY);select.setOnClickListener(v->{stations.activate(item.id);latest=null;show();refresh(true);});stationBar.addView(select,weight(dp(40),dp(3)));}
        Button add=button("+",VIOLET);add.setOnClickListener(v->{setup=true;show();});stationBar.addView(add,new LinearLayout.LayoutParams(dp(44),dp(40)));addView(stationBar,match(dp(5)));
        String[][] tabs={{"STATUS","status"},{"MEDIA","media"},{"COMMS","communications"},{"CMD","command"},{"MORE","more"}};LinearLayout nav=row(BLACK);
        for(int index=0;index<tabs.length;index++){String target=tabs[index][1];Button choice=button(tabs[index][0],tab.equals(target)?ORANGE:DIM);choice.setTextColor(tab.equals(target)?BLACK:Color.LTGRAY);choice.setOnClickListener(v->{tab=target;render();});nav.addView(choice,weight(dp(42),index==tabs.length-1?0:dp(2)));}addView(nav,match(dp(5)));
        body=column(BLACK);addView(body,match(dp(5)));LinearLayout footer=row(BLACK);Button refresh=button("REFRESH",BLUE);refresh.setOnClickListener(v->refresh(true));Button manage=button("MANAGE STATIONS",VIOLET);manage.setOnClickListener(v->{setup=true;show();});footer.addView(refresh,weight(dp(42),dp(3)));footer.addView(manage,weight(dp(42),0));addView(footer,match(dp(3)));
        status=text(latest==null?"ACQUIRING STATION STATE…":"STATION STATE SYNCHRONIZED",PEACH,10,true);addView(status,match(0));
        if(latest!=null)render();else refresh(true);
    }

    private void refresh(boolean announce){
        if(!running||station==null||setup)return;if(announce&&status!=null)status.setText("REFRESHING LOCAL LINK…");SecureStationStore.Station target=station;
        network.execute(()->{try{
            long started=System.currentTimeMillis();JSONObject result=request(target.address,"GET","api/padd/state",null,target.token);long latency=Math.max(0,System.currentTimeMillis()-started);heartbeat(target,latency);latest=result;PaddWidgetProvider.updateAll(host,result.optJSONObject("state"));
            host.runOnUiThread(()->{if(!running||station==null||!station.id.equals(target.id))return;if(status!=null)status.setText(announce?"STATION STATE SYNCHRONIZED":"");processSignal(result.optJSONObject("signal"));notifyPriority(result.optJSONObject("state"));render();});
        }catch(HttpFailure error){host.runOnUiThread(()->{if(error.status==401||error.status==403){stations.clearCredential(target.id);latest=null;setup=true;show();Toast.makeText(host,"STATION AUTHORIZATION REVOKED · PAIR AGAIN",Toast.LENGTH_LONG).show();}else if(status!=null)status.setText("LINK STANDBY · "+safeMessage(error));});
        }catch(Exception error){host.runOnUiThread(()->{if(status!=null)status.setText("LINK STANDBY · "+safeMessage(error));});}});
    }

    private void heartbeat(SecureStationStore.Station target,long latency){JSONObject payload=new JSONObject();try{int battery=battery();payload.put("battery",battery);payload.put("batteryState",BatteryStatus.classify(battery,isCharging()));payload.put("network",networkLabel());payload.put("latencyMs",latency);payload.put("version","29.3.0-rc.1");request(target.address,"POST","api/padd/heartbeat",payload,target.token);}catch(Exception ignored){}}

    private void render(){
        if(body==null)return;body.removeAllViews();JSONObject state=latest==null?new JSONObject():latest.optJSONObject("state");JSONObject capabilities=latest==null?new JSONObject():latest.optJSONObject("capabilities");if(state==null)state=new JSONObject();if(capabilities==null)capabilities=new JSONObject();String role=latest==null?"OFFLINE":latest.optJSONObject("device")==null?"PAIRED":latest.optJSONObject("device").optString("role","operator").toUpperCase(Locale.ROOT);
        JSONObject device=latest==null?null:latest.optJSONObject("device");if(tab.equals("media"))renderMedia(state,capabilities,role);else if(tab.equals("communications"))renderCommunications(state,capabilities,role);else if(tab.equals("command"))renderCommand(state,capabilities,role);else if(tab.equals("more"))renderMore(state,capabilities,role,device);else renderStatus(state,capabilities,role);
    }

    private void renderStatus(JSONObject state,JSONObject capabilities,String role){
        body.addView(subhead("CONNECTED STATUS",role),match(dp(4)));LinearLayout cards=row(BLACK);cards.addView(statusCard("ACTIVE PAGE",state.optString("page","UNKNOWN").toUpperCase(Locale.ROOT),ORANGE),weightWrap(dp(3)));cards.addView(statusCard("MASTER AUDIO",state.optInt("volume",0)+"%",BLUE),weightWrap(0));body.addView(cards,match(dp(4)));
        JSONArray meters=state.optJSONArray("meters");if(meters!=null)for(int index=0;index<Math.min(6,meters.length());index++){JSONObject item=meters.optJSONObject(index);if(item!=null)body.addView(meter(item.optString("label",item.optString("name","SYSTEM")),item.optInt("value",0)),match(dp(3)));}
        body.addView(subhead("NOW PLAYING",count(state.optJSONArray("media"))+" SOURCES"),match(dp(3)));addReadOnly(state.optJSONArray("media"),"NO ACTIVE MEDIA SOURCES");
        body.addView(subhead("NOTICES",count(state.optJSONArray("notices"))+" ACTIVE"),match(dp(3)));addReadOnly(state.optJSONArray("notices"),"NO ACTIVE COMMUNICATIONS");
        body.addView(subhead("QUICK ACTIONS",capabilities.optBoolean("quick")?"READY":"OPERATOR ROLE REQUIRED"),match(dp(3)));addCommandList(state.optJSONArray("quickActions"),"quick",capabilities.optBoolean("quick"),"NO QUICK ACTIONS SHARED");
        JSONArray running=state.optJSONArray("routineStatus");if(running!=null&&running.length()>0){body.addView(subhead("ACTIVE OPERATIONS",running.length()+" RUNNING"),match(dp(3)));addReadOnly(running,"NO ACTIVE ROUTINES");}
    }

    private void renderMedia(JSONObject state,JSONObject capabilities,String role){
        body.addView(subhead("REMOTE AUDIO BUS",role),match(dp(4)));JSONArray media=state.optJSONArray("media");JSONObject target=preferredMedia(media);addMediaSourceList(media);String id=target==null?"":target.optString("id","");boolean ready=capabilities.optBoolean("media")&&!id.isEmpty();if(target!=null)body.addView(subhead("CONTROL TARGET",target.optString("name","ACTIVE PLAYER").toUpperCase(Locale.ROOT)),match(dp(3)));
        LinearLayout controls=row(BLACK);controls.addView(action("|◀","media",mediaValue(id,"previous"),ready,BLUE),weight(dp(48),dp(3)));controls.addView(action("▶ / Ⅱ","media",mediaValue(id,"play-pause"),ready,ORANGE),weight(dp(48),dp(3)));controls.addView(action("▶|","media",mediaValue(id,"next"),ready,BLUE),weight(dp(48),0));body.addView(controls,match(dp(5)));
        LinearLayout volume=panel(VIOLET);TextView value=text(state.optInt("volume",0)+"%",Color.WHITE,21,true);SeekBar seek=new SeekBar(host);seek.setMax(100);seek.setProgress(state.optInt("volume",0));seek.setEnabled(capabilities.optBoolean("volume"));seek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onProgressChanged(SeekBar bar,int progress,boolean fromUser){value.setText(progress+"%");}public void onStartTrackingTouch(SeekBar bar){}public void onStopTrackingTouch(SeekBar bar){sendAction("volume",bar.getProgress());}});volume.addView(field("MASTER VOLUME"),match(dp(3)));volume.addView(value,match(dp(2)));volume.addView(seek,match(0));body.addView(volume,match(0));
    }

    private void renderCommunications(JSONObject state,JSONObject capabilities,String role){
        JSONArray notices=state.optJSONArray("notices");body.addView(subhead("NOTIFICATION CENTER",count(notices)+" SIGNALS · "+role),match(dp(4)));if(notices==null||notices.length()==0){body.addView(empty("NO ACTIVE COMMUNICATIONS"),match(0));return;}
        body.addView(action("DISMISS ALL","notice-dismiss-all","all",capabilities.optBoolean("notice-dismiss-all"),PINK),match(dp(4)));
        for(int index=0;index<notices.length();index++){JSONObject item=notices.optJSONObject(index);if(item==null)continue;LinearLayout card=panel(index%2==0?ORANGE:BLUE);card.addView(text(item.optString("name","LCARS CORE"),PEACH,10,true),match(dp(2)));card.addView(text(item.optString("text",item.optString("detail","SIGNAL")),Color.WHITE,13,false),match(dp(5)));LinearLayout actions=row(PANEL);actions.addView(action("ACKNOWLEDGE","notice-read",item.optString("id"),capabilities.optBoolean("notice-read"),BLUE),weight(dp(40),dp(3)));actions.addView(action("ARCHIVE","notice-archive",item.optString("id"),capabilities.optBoolean("notice-archive"),VIOLET),weight(dp(40),0));card.addView(actions,match(0));body.addView(card,match(dp(4)));}
    }

    private void renderCommand(JSONObject state,JSONObject capabilities,String role){
        body.addView(subhead("ROLE-GUARDED COMMAND DECK",role),match(dp(4)));String[][] pages={{"STATUS","overview"},{"SYSTEMS","system"},{"MEDIA","media"},{"NETWORK","network"},{"UPDATES","updates"},{"SETTINGS","settings"}};for(int index=0;index<pages.length;index+=2){LinearLayout pageRow=row(BLACK);pageRow.addView(action(pages[index][0],"navigate",pages[index][1],capabilities.optBoolean("navigate"),index%4==0?VIOLET:BLUE),weight(dp(44),dp(3)));pageRow.addView(action(pages[index+1][0],"navigate",pages[index+1][1],capabilities.optBoolean("navigate"),index%4==0?BLUE:VIOLET),weight(dp(44),0));body.addView(pageRow,match(dp(3)));}
        boolean nextDnd=!state.optBoolean("doNotDisturb",false);body.addView(action(nextDnd?"ENABLE DO NOT DISTURB":"DISABLE DO NOT DISTURB","dnd",nextDnd,capabilities.optBoolean("dnd"),PINK),match(dp(5)));
        body.addView(subhead("OPERATIONS ROUTINES",capabilities.optBoolean("routine")?"COMMAND READY":"COMMAND ROLE REQUIRED"),match(dp(3)));addCommandList(state.optJSONArray("routines"),"routine",capabilities.optBoolean("routine"),"NO ROUTINES SHARED");
        body.addView(subhead("APPLICATIONS",capabilities.optBoolean("app")?"COMMAND READY":"COMMAND ROLE REQUIRED"),match(dp(3)));addCommandList(state.optJSONArray("apps"),"app",capabilities.optBoolean("app"),"NO APPLICATIONS SHARED");
        body.addView(subhead("CONNECTED WORKSTATIONS",capabilities.optBoolean("workstation")?"APPROVAL-GUARDED":"COMMAND ROLE REQUIRED"),match(dp(3)));addCommandList(state.optJSONArray("workstations"),"workstation",capabilities.optBoolean("workstation"),"NO WORKSTATIONS SHARED");
        body.addView(subhead("QUICK ACTIONS",capabilities.optBoolean("quick")?"READY":"OPERATOR ROLE REQUIRED"),match(dp(3)));addCommandList(state.optJSONArray("quickActions"),"quick",capabilities.optBoolean("quick"),"NO QUICK ACTIONS SHARED");JSONObject handoff=state.optJSONObject("handoff");if(handoff!=null)body.addView(action("HAND OFF "+handoff.optString("title","ACTIVE CONSOLE"),"handoff",handoff.optString("page","overview"),capabilities.optBoolean("handoff"),ORANGE),match(dp(4)));
    }

    private void renderMore(JSONObject state,JSONObject capabilities,String role,JSONObject device){
        body.addView(subhead("STATION OPERATIONS",role),match(dp(4)));JSONArray selected=state.optJSONArray("widgets");String[][] choices={{"status","STATION STATUS"},{"media","NOW PLAYING"},{"communications","COMMUNICATIONS"},{"telemetry","TELEMETRY"},{"quick-actions","QUICK ACTIONS"}};LinearLayout widgets=panel(VIOLET);widgets.addView(field("PADD WIDGETS"),match(dp(4)));for(String[] choice:choices){boolean enabled=contains(selected,choice[0]);Button toggle=button((enabled?"✓ ":"+ ")+choice[1],enabled?BLUE:DIM);toggle.setTextColor(enabled?BLACK:Color.LTGRAY);toggle.setOnClickListener(v->saveWidgetPreference(selected,choice[0],!enabled));widgets.addView(toggle,match(dp(3)));}body.addView(widgets,match(dp(4)));
        LinearLayout clipboard=panel(PINK);clipboard.addView(field("OPT-IN TEXT CLIPBOARD"),match(dp(3)));EditText copy=input("TEXT TO REQUEST ON THE DESKTOP",InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_MULTI_LINE);copy.setSingleLine(false);copy.setMaxLines(4);Button transmit=action("REQUEST DESKTOP CLIPBOARD","clipboard","",capabilities.optBoolean("clipboard"),PINK);transmit.setOnClickListener(v->sendAction("clipboard",copy.getText().toString()));clipboard.addView(copy,match(dp(4)));clipboard.addView(transmit,match(0));body.addView(clipboard,match(dp(4)));
        JSONObject release=state.optJSONObject("release");LinearLayout releasePanel=panel(BLUE);releasePanel.addView(field("RELEASE MATRIX"),match(dp(3)));releasePanel.addView(text("STABLE · "+(release==null?"UNKNOWN":release.optString("stable","UNKNOWN")),Color.WHITE,12,true),match(dp(2)));releasePanel.addView(text("DEVELOPMENT · "+(release==null?"UNKNOWN":release.optString("development","UNKNOWN")),PEACH,12,true),match(dp(2)));releasePanel.addView(text("CLIENT · VERSION 29.3 RC 1",Color.LTGRAY,10,true),match(0));body.addView(releasePanel,match(dp(4)));
        if(device!=null){String diagnostics=device.optString("network","NETWORK UNKNOWN").toUpperCase(Locale.ROOT)+" · "+device.optInt("latencyMs",0)+" MS · "+device.optInt("battery",-1)+"% BATTERY";body.addView(subhead("LINK DIAGNOSTICS",diagnostics),match(dp(4)));}
        String compatibility=latest==null?"unknown":latest.optString("compatibility","unknown"),stationVersion=latest==null?"unknown":latest.optString("stationVersion","unknown");LinearLayout recovery=panel(compatibility.equals("compatible")?BLUE:PINK);recovery.addView(field("CONNECTION RECOVERY"),match(dp(3)));recovery.addView(text(compatibility.equals("compatible")?"CLIENT AND STATION VERSIONS ALIGNED":"VERSION ATTENTION · "+compatibility.replace('-',' ').toUpperCase(Locale.ROOT),compatibility.equals("compatible")?BLUE:PINK,10,true),match(dp(2)));recovery.addView(text("STATION "+stationVersion.toUpperCase(Locale.ROOT)+" · CLIENT VERSION 29.3",Color.LTGRAY,9,true),match(dp(4)));LinearLayout recoveryActions=row(PANEL);Button retry=button("RETRY LINK",BLUE);retry.setOnClickListener(v->refresh(true));Button repair=button("PAIR AGAIN",VIOLET);repair.setOnClickListener(v->{setup=true;show();});recoveryActions.addView(retry,weight(dp(40),dp(3)));recoveryActions.addView(repair,weight(dp(40),0));recovery.addView(recoveryActions,match(0));body.addView(recovery,match(dp(4)));
        LinearLayout info=panel(BLUE);info.addView(field(station.label),match(dp(3)));info.addView(text(station.address,Color.WHITE,12,true),match(dp(3)));info.addView(text("CREDENTIALS · ANDROID KEYSTORE AES-GCM\nMULTI-STATION REGISTRY · "+stations.all().size()+"/8",Color.LTGRAY,10,false),match(0));body.addView(info,match(dp(4)));
        Button remove=button("REMOVE THIS STATION",PINK);remove.setOnClickListener(v->new android.app.AlertDialog.Builder(host).setTitle("REMOVE STATION?").setMessage("The encrypted credential is deleted from this device. Pairing can be restored later with a new code.").setPositiveButton("REMOVE",(dialog,which)->{stations.remove(station.id);latest=null;setup=stations.active()==null;show();}).setNegativeButton("CANCEL",null).show());body.addView(remove,match(0));
    }

    private void sendAction(String action,Object value){if(station==null)return;if(status!=null)status.setText("TRANSMITTING "+action.toUpperCase(Locale.ROOT)+"…");vibrate(45);SecureStationStore.Station target=station;JSONObject payload=new JSONObject();try{payload.put("action",action);payload.put("value",value);}catch(Exception ignored){}network.execute(()->{try{JSONObject result=request(target.address,"POST","api/padd/action",payload,target.token);host.runOnUiThread(()->{if(status!=null)status.setText(result.optString("message","COMMAND TRANSMITTED"));handler.postDelayed(()->refresh(false),350);});}catch(Exception error){host.runOnUiThread(()->{if(status!=null)status.setText("COMMAND REJECTED · "+safeMessage(error));});}});}

    private JSONObject request(String root,String method,String path,JSONObject payload,String token)throws Exception{
        URL url=new URL(root+path);HttpURLConnection connection=(HttpURLConnection)url.openConnection();connection.setConnectTimeout(4500);connection.setReadTimeout(6500);connection.setRequestMethod(method);connection.setRequestProperty("Accept","application/json");if(token!=null&&!token.isEmpty())connection.setRequestProperty("Authorization","Bearer "+token);
        if(payload!=null){byte[] bytes=payload.toString().getBytes(StandardCharsets.UTF_8);connection.setDoOutput(true);connection.setRequestProperty("Content-Type","application/json");connection.setFixedLengthStreamingMode(bytes.length);connection.getOutputStream().write(bytes);}
        int code=connection.getResponseCode();InputStream stream=code>=400?connection.getErrorStream():connection.getInputStream();StringBuilder text=new StringBuilder();if(stream!=null)try(BufferedReader reader=new BufferedReader(new InputStreamReader(stream,StandardCharsets.UTF_8))){for(String line;(line=reader.readLine())!=null;)text.append(line);}connection.disconnect();JSONObject result=text.length()==0?new JSONObject():new JSONObject(text.toString());if(code>=400||result.has("ok")&&!result.optBoolean("ok"))throw new HttpFailure(code,result.optString("error","Station request failed"));return result;
    }

    private void prepareNotifications(){NotificationManager manager=host.getSystemService(NotificationManager.class);if(Build.VERSION.SDK_INT>=26&&manager!=null){NotificationChannel channel=new NotificationChannel(CHANNEL,"LCARS Communications",NotificationManager.IMPORTANCE_HIGH);channel.setDescription("Priority communications from paired LCARS stations");manager.createNotificationChannel(channel);}}
    private void processSignal(JSONObject signal){if(signal==null||station==null)return;String id=station.id+":"+signal.optString("id","");if(id.endsWith(":")||id.equals(local.getString(SIGNAL,"")))return;local.edit().putString(SIGNAL,id).apply();vibrate(180);Toast.makeText(host,"LCARS IDENTIFY · THIS IS "+station.deviceName,Toast.LENGTH_LONG).show();}
    private void notifyPriority(JSONObject state){JSONArray notices=state==null?null:state.optJSONArray("notices");if(notices==null)return;JSONObject device=latest==null?null:latest.optJSONObject("device"),settings=device==null?null:device.optJSONObject("notifications");boolean priorityOnly=settings==null||settings.optBoolean("priorityOnly",true),connectionEvents=settings==null||settings.optBoolean("connectionEvents",true),routineResults=settings==null||settings.optBoolean("routineResults",true);for(int index=0;index<notices.length();index++){JSONObject item=notices.optJSONObject(index);if(item==null||item.optBoolean("read",false))continue;String priority=item.optString("priority",item.optString("status","")).toLowerCase(Locale.ROOT);boolean urgent=priority.contains("critical")||priority.contains("priority")||priority.contains("error");if(priorityOnly&&!urgent)continue;String category=(item.optString("source","")+" "+item.optString("name","")+" "+item.optString("kind","")).toLowerCase(Locale.ROOT);if(!connectionEvents&&(category.contains("connection")||category.contains("link"))||!routineResults&&category.contains("routine"))continue;String id=station.id+":"+item.optString("id","");if(id.equals(local.getString(NOTICE,"")))return;local.edit().putString(NOTICE,id).apply();Intent open=new Intent(host,HomeActivity.class);open.putExtra("open-page","companion");PendingIntent pending=PendingIntent.getActivity(host,293,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);Notification notification=new Notification.Builder(host,CHANNEL).setSmallIcon(android.R.drawable.stat_notify_more).setContentTitle(item.optString("name","LCARS PRIORITY SIGNAL")).setContentText(item.optString("text",item.optString("detail","Open the Companion page"))).setContentIntent(pending).setAutoCancel(true).build();NotificationManager manager=host.getSystemService(NotificationManager.class);if(manager!=null&&(Build.VERSION.SDK_INT<33||host.checkSelfPermission("android.permission.POST_NOTIFICATIONS")==PackageManager.PERMISSION_GRANTED))manager.notify(id.hashCode(),notification);return;}}
    private void vibrate(int milliseconds){Vibrator vibrator;if(Build.VERSION.SDK_INT>=31){VibratorManager manager=host.getSystemService(VibratorManager.class);vibrator=manager==null?null:manager.getDefaultVibrator();}else vibrator=(Vibrator)host.getSystemService(Context.VIBRATOR_SERVICE);if(vibrator==null||!vibrator.hasVibrator())return;if(Build.VERSION.SDK_INT>=26)vibrator.vibrate(VibrationEffect.createOneShot(milliseconds,VibrationEffect.DEFAULT_AMPLITUDE));else vibrator.vibrate(milliseconds);}

    private int battery(){BatteryManager manager=host.getSystemService(BatteryManager.class);return manager==null?-1:manager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);}
    private boolean isCharging(){BatteryManager manager=host.getSystemService(BatteryManager.class);return manager!=null&&manager.isCharging();}
    private String networkLabel(){ConnectivityManager manager=host.getSystemService(ConnectivityManager.class);if(manager==null)return"unknown";Network network=manager.getActiveNetwork();NetworkCapabilities capabilities=network==null?null:manager.getNetworkCapabilities(network);if(capabilities==null)return"offline";if(capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI))return"wifi";if(capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR))return"cellular";if(capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET))return"ethernet";return"local-network";}
    private JSONObject mediaValue(String player,String command){JSONObject value=new JSONObject();try{value.put("player",player);value.put("command",command);}catch(Exception ignored){}return value;}
    private JSONObject preferredMedia(JSONArray media){if(media==null)return null;String selected=local.getString(MEDIA_TARGET,"");JSONObject fallback=null;for(int index=0;index<media.length();index++){JSONObject item=media.optJSONObject(index);if(item==null)continue;if(fallback==null)fallback=item;if(!selected.isEmpty()&&selected.equals(item.optString("id","")))return item;}for(int index=0;index<media.length();index++){JSONObject item=media.optJSONObject(index);if(item!=null&&"playing".equalsIgnoreCase(item.optString("status","")))return item;}return fallback;}
    private void addMediaSourceList(JSONArray media){if(media==null||media.length()==0){body.addView(empty("NO ACTIVE MEDIA SOURCES"),match(dp(4)));return;}JSONObject preferred=preferredMedia(media);String selected=preferred==null?"":preferred.optString("id","");for(int index=0;index<media.length();index++){JSONObject item=media.optJSONObject(index);if(item==null)continue;String id=item.optString("id",""),title=(id.equals(selected)?"✓ ":"")+String.format(Locale.ROOT,"%02d · %s · %s",index+1,item.optString("name","MEDIA"),item.optString("status","READY"));Button source=button(title,id.equals(selected)?ORANGE:DIM);source.setTextColor(id.equals(selected)?BLACK:Color.LTGRAY);source.setOnClickListener(v->{local.edit().putString(MEDIA_TARGET,id).apply();render();if(status!=null)status.setText("MEDIA TARGET SELECTED · "+item.optString("name","MEDIA"));});body.addView(source,match(dp(3)));}}
    private int count(JSONArray values){return values==null?0:values.length();}
    private boolean contains(JSONArray values,String target){if(values==null)return false;for(int index=0;index<values.length();index++)if(target.equals(values.optString(index)))return true;return false;}
    private void saveWidgetPreference(JSONArray current,String id,boolean enabled){JSONArray next=new JSONArray();if(current!=null)for(int index=0;index<current.length();index++){String value=current.optString(index);if(!value.equals(id))next.put(value);}if(enabled)next.put(id);JSONObject payload=new JSONObject();try{payload.put("widgets",next);}catch(Exception ignored){}SecureStationStore.Station target=station;if(target==null)return;network.execute(()->{try{request(target.address,"POST","api/padd/preferences",payload,target.token);host.runOnUiThread(()->refresh(true));}catch(Exception error){host.runOnUiThread(()->{if(status!=null)status.setText("LAYOUT SAVE FAILED · "+safeMessage(error));});}});}
    private String safeMessage(Exception error){return error.getMessage()==null?"UNKNOWN ERROR":error.getMessage();}

    private void addReadOnly(JSONArray values,String emptyMessage){if(values==null||values.length()==0){body.addView(empty(emptyMessage),match(dp(4)));return;}for(int index=0;index<values.length();index++){JSONObject item=values.optJSONObject(index);if(item==null)continue;LinearLayout row=row(PANEL);TextView number=text(String.format(Locale.ROOT,"%02d",index+1),BLACK,11,true);number.setGravity(Gravity.CENTER);number.setBackgroundColor(index%2==0?ORANGE:BLUE);LinearLayout copy=column(PANEL);copy.setPadding(dp(8),dp(5),dp(8),dp(5));copy.addView(fit(item.optString("name",item.optString("title",item.optString("text","LCARS SIGNAL"))),Color.WHITE,8,13,true),match(dp(1)));copy.addView(fit(item.optString("detail",item.optString("status","")),Color.GRAY,7,10,false),match(0));row.addView(number,new LinearLayout.LayoutParams(dp(40),dp(50)));row.addView(copy,new LinearLayout.LayoutParams(0,dp(50),1));body.addView(row,match(dp(3)));}}
    private void addCommandList(JSONArray values,String actionName,boolean enabled,String emptyMessage){if(values==null||values.length()==0){body.addView(empty(emptyMessage),match(dp(4)));return;}for(int index=0;index<values.length();index++){JSONObject item=values.optJSONObject(index);if(item!=null)body.addView(action(String.format(Locale.ROOT,"%02d · %s",index+1,item.optString("name",item.optString("title","LCARS COMMAND"))),actionName,item.optString("id",""),enabled,index%2==0?VIOLET:BLUE),match(dp(3)));}}
    private Button action(String title,String action,Object value,boolean enabled,int color){Button button=button(title,color);button.setEnabled(enabled);button.setAlpha(enabled?1f:.38f);button.setOnClickListener(v->sendAction(action,value));return button;}
    private LinearLayout section(String eyebrow,String title,String badge){LinearLayout shell=row(BLACK);View rail=new View(host);rail.setBackground(shape(ORANGE,18,3,3,18));LinearLayout copy=column(PANEL);copy.setPadding(dp(9),dp(5),dp(7),dp(5));copy.addView(fit(eyebrow,PEACH,7,9,true),match(0));copy.addView(fit(title,Color.WHITE,7,19,true),match(0));TextView value=fit(badge,BLUE,6,10,true);value.setGravity(Gravity.CENTER);value.setBackground(shape(PANEL,3,20,20,3));LinearLayout.LayoutParams rp=new LinearLayout.LayoutParams(dp(16),dp(58));rp.rightMargin=dp(3);shell.addView(rail,rp);LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(0,dp(58),1);cp.rightMargin=dp(3);shell.addView(copy,cp);shell.addView(value,new LinearLayout.LayoutParams(dp(82),dp(58)));return shell;}
    private LinearLayout subhead(String title,String detail){LinearLayout value=row(PANEL);value.setPadding(dp(9),dp(5),dp(9),dp(5));value.setBackground(shape(PANEL,18,3,3,18));value.addView(fit(title,Color.WHITE,8,13,true),new LinearLayout.LayoutParams(0,dp(34),1));TextView right=fit(detail,PEACH,6,9,true);right.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);value.addView(right,new LinearLayout.LayoutParams(0,dp(34),1));return value;}
    private LinearLayout panel(int accent){LinearLayout value=column(PANEL);value.setPadding(dp(9),dp(8),dp(9),dp(8));GradientDrawable background=shape(PANEL,20,3,20,20);background.setStroke(dp(2),accent);value.setBackground(background);return value;}
    private LinearLayout statusCard(String title,String value,int accent){LinearLayout card=panel(accent);card.addView(field(title),match(dp(2)));card.addView(fit(value,Color.WHITE,8,17,true),match(0));return card;}
    private LinearLayout meter(String title,int reading){int safe=Math.max(0,Math.min(100,reading));LinearLayout outer=panel(BLUE),top=row(PANEL);top.addView(fit(title.toUpperCase(Locale.ROOT),Color.LTGRAY,7,10,true),new LinearLayout.LayoutParams(0,dp(26),1));TextView value=fit(safe+"%",PEACH,8,11,true);value.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);top.addView(value,new LinearLayout.LayoutParams(dp(54),dp(26)));outer.addView(top,match(dp(2)));LinearLayout track=row(DIM);View fill=new View(host);fill.setBackgroundColor(BLUE);track.addView(fill,new LinearLayout.LayoutParams(0,dp(7),Math.max(1,safe)));track.addView(new View(host),new LinearLayout.LayoutParams(0,dp(7),Math.max(1,100-safe)));outer.addView(track,match(0));return outer;}
    private TextView field(String value){return fit(value,PEACH,7,10,true);}
    private TextView empty(String value){TextView text=text(value,Color.GRAY,10,true);text.setGravity(Gravity.CENTER);text.setPadding(dp(8),dp(14),dp(8),dp(14));text.setBackground(shape(PANEL,18,3,18,18));return text;}
    private EditText input(String hint,int type){EditText value=new EditText(host);value.setSingleLine(true);value.setHint(hint);value.setInputType(type);value.setTextColor(Color.WHITE);value.setHintTextColor(Color.GRAY);value.setTextSize(TypedValue.COMPLEX_UNIT_SP,13);value.setPadding(dp(10),dp(7),dp(10),dp(7));GradientDrawable background=shape(DIM,18,3,18,18);background.setStroke(dp(1),ORANGE);value.setBackground(background);return value;}
    private Button button(String label,int color){Button value=new Button(host);value.setAllCaps(false);value.setText(label);value.setTextColor(BLACK);value.setTextSize(TypedValue.COMPLEX_UNIT_SP,9);value.setTypeface(Typeface.create("sans-serif-condensed",Typeface.BOLD));value.setPadding(dp(5),dp(3),dp(5),dp(3));value.setMinHeight(0);value.setMinimumHeight(0);value.setMinimumWidth(0);value.setElevation(0);value.setStateListAnimator(null);value.setBackground(shape(color,20,3,20,20));return value;}
    private TextView text(String value,int color,int size,boolean bold){TextView text=new TextView(host);text.setText(value);text.setTextColor(color);text.setTextSize(TypedValue.COMPLEX_UNIT_SP,size);text.setTypeface(Typeface.create("sans-serif-condensed",bold?Typeface.BOLD:Typeface.NORMAL));text.setGravity(Gravity.CENTER_VERTICAL);return text;}
    private TextView fit(String value,int color,int min,int max,boolean bold){TextView text=text(value,color,max,bold);text.setSingleLine(true);text.setEllipsize(TextUtils.TruncateAt.END);if(Build.VERSION.SDK_INT>=26)text.setAutoSizeTextTypeUniformWithConfiguration(min,max,1,TypedValue.COMPLEX_UNIT_SP);return text;}
    private LinearLayout row(int color){LinearLayout value=new LinearLayout(host);value.setOrientation(HORIZONTAL);value.setGravity(Gravity.CENTER_VERTICAL);value.setBackgroundColor(color);return value;}
    private LinearLayout column(int color){LinearLayout value=new LinearLayout(host);value.setOrientation(VERTICAL);value.setBackgroundColor(color);return value;}
    private GradientDrawable shape(int color,int tl,int tr,int br,int bl){GradientDrawable value=new GradientDrawable();value.setColor(color);value.setCornerRadii(new float[]{dp(tl),dp(tl),dp(tr),dp(tr),dp(br),dp(br),dp(bl),dp(bl)});return value;}
    private LinearLayout.LayoutParams match(int bottom){LinearLayout.LayoutParams value=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT);value.bottomMargin=bottom;return value;}
    private LinearLayout.LayoutParams weight(int height,int right){LinearLayout.LayoutParams value=new LinearLayout.LayoutParams(0,height,1);value.rightMargin=right;return value;}
    private LinearLayout.LayoutParams weightWrap(int right){LinearLayout.LayoutParams value=new LinearLayout.LayoutParams(0,ViewGroup.LayoutParams.WRAP_CONTENT,1);value.rightMargin=right;return value;}
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}

    private static final class HttpFailure extends IOException{final int status;HttpFailure(int status,String message){super(message);this.status=status;}}
}
