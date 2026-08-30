package com.lcars.padd;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.role.RoleManager;
import android.appwidget.AppWidgetHost;
import android.appwidget.AppWidgetHostView;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.LauncherActivityInfo;
import android.content.pm.LauncherApps;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.StatFs;
import android.os.UserHandle;
import android.os.UserManager;
import android.provider.Settings;
import android.text.Editable;
import android.text.TextUtils;
import android.text.TextWatcher;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.EditText;
import android.widget.GridLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.text.Collator;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Version 30.1 Development Android Home surface with an integrated native Companion page. */
public final class HomeActivity extends Activity {
    private static final String PREFS="lcars-home-v29", FAVORITES="favorite-components";
    private static final String DECKS="decks-json", FOLDERS="folders-json", WIDGET_IDS="widget-ids";
    private static final int HOME_ROLE_REQUEST=291, PICK_WIDGET_REQUEST=292, CONFIGURE_WIDGET_REQUEST=293;
    private static final int EXPORT_BACKUP_REQUEST=294, IMPORT_BACKUP_REQUEST=295, APP_WIDGET_HOST_ID=2902;

    private int BLACK=Color.BLACK,PANEL=Color.rgb(18,16,22),DIM=Color.rgb(40,35,46),GOLD=Color.rgb(255,224,92);
    private int ORANGE=Color.rgb(255,152,104),PEACH=Color.rgb(244,182,107),PINK=Color.rgb(233,155,197);
    private int BLUE=Color.rgb(130,154,241),VIOLET=Color.rgb(182,157,232),outerRadius=28,innerRadius=3,panelStroke=2;
    private final Handler clockHandler=new Handler(Looper.getMainLooper());
    private final ArrayList<LaunchEntry> allApps=new ArrayList<>();
    private final HashMap<String,Drawable> iconCache=new HashMap<>();
    private final ExecutorService appLoader=Executors.newSingleThreadExecutor();
    private SharedPreferences preferences;
    private LauncherApps launcherApps;
    private UserManager userManager;
    private AppWidgetHost appWidgetHost;
    private AppWidgetManager appWidgetManager;
    private LinearLayout sidebar,pageContent;
    private ScrollView pageScroll;
    private TextView pageEyebrow,pageTitle,pageBadge,clock;
    private TextView updateStatus;
    private EditText search;
    private GridLayout applicationGrid;
    private SecureStationStore stationStore;
    private CompanionDock companionDock;
    private int pendingWidgetId=AppWidgetManager.INVALID_APPWIDGET_ID;
    private int visibleAppLimit=60;
    private String activePage,activeDeckId,activeFolderId;
    private Calendar calendarMonth=Calendar.getInstance(),selectedDate=Calendar.getInstance();

    private final Runnable updateClock=new Runnable(){
        @Override public void run(){
            if(clock!=null)clock.setText(new SimpleDateFormat("h:mm a",Locale.getDefault()).format(System.currentTimeMillis()).toUpperCase(Locale.ROOT));
            clockHandler.postDelayed(this,30000);
        }
    };
    private final LauncherApps.Callback packageCallback=new LauncherApps.Callback(){
        @Override public void onPackageRemoved(String name,UserHandle user){reloadApps();}
        @Override public void onPackageAdded(String name,UserHandle user){reloadApps();}
        @Override public void onPackageChanged(String name,UserHandle user){reloadApps();}
        @Override public void onPackagesAvailable(String[] names,UserHandle user,boolean replacing){reloadApps();}
        @Override public void onPackagesUnavailable(String[] names,UserHandle user,boolean replacing){reloadApps();}
    };

    @Override protected void onCreate(Bundle state){
        super.onCreate(state);
        preferences=getSharedPreferences(PREFS,MODE_PRIVATE);
        launcherApps=(LauncherApps)getSystemService(Context.LAUNCHER_APPS_SERVICE);
        userManager=(UserManager)getSystemService(Context.USER_SERVICE);
        appWidgetManager=AppWidgetManager.getInstance(this);
        appWidgetHost=new AppWidgetHost(this,APP_WIDGET_HOST_ID);
        stationStore=new SecureStationStore(this);
        activePage=getIntent().getStringExtra("open-page");
        if(activePage==null||activePage.isEmpty())activePage=preferences.getString("active-page","status");
        applyDisplayMatrix();
        getWindow().setStatusBarColor(BLACK);
        getWindow().setNavigationBarColor(BLACK);
        if(Build.VERSION.SDK_INT>=29)getWindow().setNavigationBarContrastEnforced(false);
        if(Build.VERSION.SDK_INT>=30)getWindow().setDecorFitsSystemWindows(false);
        if(Build.VERSION.SDK_INT>=33&&checkSelfPermission("android.permission.POST_NOTIFICATIONS")!=android.content.pm.PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"},296);
        buildHome();
        if(launcherApps!=null)launcherApps.registerCallback(packageCallback,new Handler(Looper.getMainLooper()));
        reloadApps();
    }
    @Override protected void onStart(){super.onStart();try{appWidgetHost.startListening();}catch(RuntimeException ignored){}if(companionDock!=null)companionDock.start();}
    @Override protected void onResume(){super.onResume();clockHandler.removeCallbacks(updateClock);clockHandler.post(updateClock);if(updateStatus!=null)MobileUpdateManager.resumePendingInstall(this,(message,error)->{if(updateStatus!=null){updateStatus.setText(message);updateStatus.setTextColor(error?PINK:PEACH);}});}
    @Override protected void onStop(){if(companionDock!=null)companionDock.stop();try{appWidgetHost.stopListening();}catch(RuntimeException ignored){}super.onStop();}
    @Override protected void onDestroy(){if(launcherApps!=null)launcherApps.unregisterCallback(packageCallback);if(companionDock!=null)companionDock.destroy();appLoader.shutdownNow();clockHandler.removeCallbacks(updateClock);super.onDestroy();}
    @Override public void onConfigurationChanged(Configuration config){super.onConfigurationChanged(config);buildHome();}
    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);String requested=intent.getStringExtra("open-page");if(requested!=null&&!requested.isEmpty()){activePage=requested;preferences.edit().putString("active-page",activePage).apply();buildHome();}}

    private void buildHome(){
        LinearLayout root=column(BLACK);
        root.addView(buildMasthead(),matchWrap(dp(6)));
        LinearLayout shell=row(BLACK);
        sidebar=column(BLACK);
        buildSidebar();
        LinearLayout.LayoutParams side=new LinearLayout.LayoutParams(dp(sidebarWidth()),ViewGroup.LayoutParams.MATCH_PARENT);
        side.rightMargin=dp(7);
        shell.addView(sidebar,side);
        LinearLayout page=column(BLACK);
        page.addView(buildPageHeading(),matchWrap(dp(5)));
        pageScroll=new ScrollView(this);
        pageScroll.setFillViewport(true);pageScroll.setVerticalScrollBarEnabled(false);
        pageContent=column(BLACK);pageContent.setPadding(dp(contentInset()),dp(3),dp(contentInset()),dp(18));
        pageScroll.addView(pageContent,new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT));
        page.addView(pageScroll,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,0,1));
        shell.addView(page,new LinearLayout.LayoutParams(0,ViewGroup.LayoutParams.MATCH_PARENT,1));
        root.addView(shell,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,0,1));
        setInsetAwareContent(root,8,8,8,7);
        renderPage();
    }

    private View buildMasthead(){
        LinearLayout header=row(BLACK);
        LinearLayout brand=column(ORANGE);
        brand.setGravity(Gravity.CENTER_VERTICAL|Gravity.RIGHT);brand.setPadding(dp(8),dp(7),dp(10),dp(7));
        brand.setBackground(shape(ORANGE,34,3,3,34));
        TextView brandName=fittedLabel("LCARS",BLACK,13,19,true);brandName.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);
        TextView version=fittedLabel("30.1 DEV",BLACK,6,10,true);version.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);
        brand.addView(brandName,matchWrap(0));brand.addView(version,matchWrap(0));
        LinearLayout.LayoutParams brandParams=new LinearLayout.LayoutParams(dp(sidebarWidth()),dp(74));brandParams.rightMargin=dp(4);
        header.addView(brand,brandParams);
        LinearLayout titles=column(PANEL);
        titles.setGravity(Gravity.CENTER_VERTICAL);titles.setPadding(dp(11),dp(7),dp(8),dp(7));titles.setBackground(shape(PANEL,3,3,3,3));
        titles.addView(containedLabel("MOBILE OPERATING ENVIRONMENT",PEACH,6,10,true,1),matchWrap(dp(2)));
        titles.addView(containedLabel("ANDROID COMMAND INTERFACE",Color.WHITE,7,20,true,2),matchWrap(0));
        LinearLayout.LayoutParams titleParams=new LinearLayout.LayoutParams(0,dp(74),1);titleParams.rightMargin=dp(4);
        header.addView(titles,titleParams);
        clock=containedLabel("--:--",BLACK,8,18,true,1);clock.setGravity(Gravity.CENTER);clock.setBackground(shape(BLUE,3,34,34,3));clock.setContentDescription("Open LCARS calendar");clock.setOnClickListener(v->switchPage("calendar"));
        header.addView(clock,new LinearLayout.LayoutParams(dp(clockWidth()),dp(74)));
        return header;
    }

    private View buildPageHeading(){
        LinearLayout header=row(BLACK);
        View rail=new View(this);rail.setBackground(shape(ORANGE,18,3,3,18));
        LinearLayout.LayoutParams railParams=new LinearLayout.LayoutParams(dp(17),dp(62));railParams.rightMargin=dp(3);header.addView(rail,railParams);
        LinearLayout text=column(PANEL);text.setGravity(Gravity.CENTER_VERTICAL);text.setPadding(dp(10),dp(5),dp(7),dp(5));text.setBackground(shape(PANEL,3,3,3,3));
        pageEyebrow=containedLabel("LOCAL DEVICE",PEACH,6,10,true,1);pageTitle=containedLabel("STATUS",Color.WHITE,7,25,true,2);
        text.addView(pageEyebrow,matchWrap(0));text.addView(pageTitle,matchWrap(0));
        LinearLayout.LayoutParams textParams=new LinearLayout.LayoutParams(0,dp(62),1);textParams.rightMargin=dp(3);header.addView(text,textParams);
        pageBadge=containedLabel("HOME",BLUE,6,11,true,2);pageBadge.setGravity(Gravity.CENTER);pageBadge.setBackground(shape(PANEL,3,20,20,3));
        header.addView(pageBadge,new LinearLayout.LayoutParams(dp(74),dp(62)));
        return header;
    }

    private void buildSidebar(){
        if(sidebar==null)return;
        sidebar.removeAllViews();
        TextView elbow=fittedLabel("TRAY 09",BLACK,10,14,true);
        elbow.setGravity(Gravity.RIGHT|Gravity.BOTTOM);elbow.setPadding(dp(5),dp(5),dp(10),dp(8));elbow.setBackground(shape(ORANGE,3,3,3,34));
        sidebar.addView(elbow,matchHeight(dp(52),dp(5)));
        String[][] pages={{"status","01","STATUS"},{"applications","02","APPS"},{"favorites","03","FAVORITES"},{"decks","04","DECKS"},{"folders","05","FOLDERS"},{"widgets","06","WIDGETS"},{"display","07","DISPLAYS"},{"settings","08","SETTINGS"},{"companion","09","COMPANION"}};
        int[] colors={GOLD,PEACH,VIOLET,PINK,BLUE,ORANGE,GOLD,PEACH,VIOLET};
        for(int i=0;i<pages.length;i++)sidebar.addView(navButton(pages[i][1],pages[i][2],pages[i][0],colors[i]),matchHeight(dp(navHeight()),dp(2)));
        LinearLayout filler=row(BLACK);View space=new View(this),fillerRail=new View(this);fillerRail.setBackgroundColor(VIOLET);
        filler.addView(space,new LinearLayout.LayoutParams(0,ViewGroup.LayoutParams.MATCH_PARENT,1));
        filler.addView(fillerRail,new LinearLayout.LayoutParams(dp(compactLayout()?10:15),ViewGroup.LayoutParams.MATCH_PARENT));
        sidebar.addView(filler,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,0,1));
        Button exit=navButton("10","ANDROID HOME","android-home",Color.rgb(194,82,88));exit.setOnClickListener(v->openHomeSettings());
        sidebar.addView(exit,matchHeight(dp(navHeight()),dp(2)));
        View foot=new View(this);foot.setBackground(shape(VIOLET,3,3,3,24));sidebar.addView(foot,matchHeight(dp(25),0));
    }

    private Button navButton(String number,String title,String page,int color){
        boolean active=activePage.equals(page);
        Button button=button(number+"  "+title+(active?"  •":""),color);
        button.setTextSize(TypedValue.COMPLEX_UNIT_SP,compactLayout()?9:10);
        button.setGravity(Gravity.CENTER_VERTICAL|Gravity.RIGHT);button.setPadding(dp(4),dp(2),dp(7),dp(2));button.setAlpha(active?1f:.86f);
        button.setBackground(shape(color,18,3,3,18));button.setOnClickListener(v->switchPage(page));
        return button;
    }

    private void switchPage(String page){
        activePage=page;preferences.edit().putString("active-page",page).apply();buildSidebar();renderPage();
    }
    private void heading(String eyebrow,String title,String badge){pageEyebrow.setText(eyebrow);pageTitle.setText(title);pageBadge.setText(badge);}

    private void renderPage(){
        if(pageContent==null)return;
        if(companionDock!=null&&!activePage.equals("companion")){companionDock.destroy();companionDock=null;}
        pageContent.removeAllViews();search=null;applicationGrid=null;updateStatus=null;if(pageScroll!=null)pageScroll.scrollTo(0,0);
        if(activePage.equals("applications"))renderApplicationsPage();
        else if(activePage.equals("favorites"))renderFavoritesPage();
        else if(activePage.equals("decks"))renderDecksPage();
        else if(activePage.equals("folders"))renderFoldersPage();
        else if(activePage.equals("widgets"))renderWidgetsPage();
        else if(activePage.equals("display"))renderDisplayPage();
        else if(activePage.equals("settings"))renderSettingsPage();
        else if(activePage.equals("companion"))renderCompanionPage();
        else if(activePage.equals("calendar"))renderCalendarPage();
        else renderStatusPage();
    }

    private void renderStatusPage(){
        heading("LOCAL DEVICE OPERATIONS","STATUS",homeRoleHeld()?"HOME ACTIVE":"HOME READY");
        GridLayout grid=new GridLayout(this);grid.setColumnCount(statusColumns());
        int battery=batteryPercent();
        String batteryState=BatteryStatus.classify(battery,isCharging());
        addStatus(grid,"BATTERY",battery<0?"UNKNOWN":battery+"% · "+batteryState,batteryState.equals(BatteryStatus.CRITICAL)||batteryState.equals(BatteryStatus.LOW)?ORANGE:BLUE);
        addStatus(grid,"NETWORK",networkLabel(),VIOLET);addStatus(grid,"STORAGE FREE",storageFree(),PINK);addStatus(grid,"APPLICATIONS",Integer.toString(allApps.size()),ORANGE);
        pageContent.addView(grid,matchWrap(dp(6)));
        LinearLayout summary=panel(ORANGE);summary.addView(fieldLabel("VERSION 30.1 DEVELOPMENT HOME CONFIGURATION"),matchWrap(dp(4)));
        summary.addView(label(collections(DECKS,"PRIMARY").size()+" DECKS · "+collections(FOLDERS,null).size()+" FOLDERS · "+widgetIds().size()+" WIDGETS",Color.WHITE,16,true),matchWrap(dp(5)));
        summary.addView(label("DISPLAY MATRIX · "+themeLabel(preferences.getString("display-theme","enterprise-d"))+" · "+(compactLayout()?"COMPACT":"STANDARD")+" LAYOUT",PEACH,10,true),matchWrap(0));
        pageContent.addView(summary,matchWrap(dp(6)));
        LinearLayout controls=panel(BLUE);controls.addView(fieldLabel("HOME ROLE CONTROL"),matchWrap(dp(5)));
        Button home=button(homeRoleHeld()?"LCARS IS CURRENT HOME":"MAKE LCARS DEFAULT HOME",homeRoleHeld()?BLUE:ORANGE);home.setOnClickListener(v->requestHomeRole());
        Button companion=button("OPEN COMPANION PAGE",VIOLET);companion.setOnClickListener(v->switchPage("companion"));
        controls.addView(home,matchWrap(dp(4)));controls.addView(companion,matchWrap(0));pageContent.addView(controls,matchWrap(0));
    }

    private void addStatus(GridLayout grid,String title,String value,int color){
        LinearLayout card=panel(color);card.addView(label(title,PEACH,9,true),matchWrap(dp(3)));card.addView(fittedLabel(value,Color.WHITE,15,23,true),matchWrap(0));grid.addView(card,gridCell(dp(3)));
    }

    private void renderCalendarPage(){
        heading("TEMPORAL OPERATIONS","CALENDAR",new SimpleDateFormat("MMM yyyy",Locale.getDefault()).format(calendarMonth.getTime()).toUpperCase(Locale.ROOT));
        LinearLayout controls=row(BLACK);Button previous=button("‹ PREVIOUS",VIOLET),today=button("TODAY",ORANGE),next=button("NEXT ›",BLUE);
        previous.setOnClickListener(v->{calendarMonth.add(Calendar.MONTH,-1);renderPage();});today.setOnClickListener(v->{calendarMonth=Calendar.getInstance();selectedDate=Calendar.getInstance();renderPage();});next.setOnClickListener(v->{calendarMonth.add(Calendar.MONTH,1);renderPage();});
        controls.addView(previous,weightedHeight(1,dp(42),dp(3)));controls.addView(today,weightedHeight(1,dp(42),dp(3)));controls.addView(next,weightedHeight(1,dp(42),0));pageContent.addView(controls,matchWrap(dp(6)));
        LinearLayout month=panel(ORANGE);TextView monthName=containedLabel(new SimpleDateFormat("MMMM yyyy",Locale.getDefault()).format(calendarMonth.getTime()).toUpperCase(Locale.ROOT),Color.WHITE,10,24,true,1);monthName.setGravity(Gravity.CENTER);month.addView(monthName,matchWrap(dp(6)));
        GridLayout grid=new GridLayout(this);grid.setColumnCount(7);String[] weekdays={"SUN","MON","TUE","WED","THU","FRI","SAT"};for(String weekday:weekdays){TextView label=containedLabel(weekday,PEACH,6,9,true,1);label.setGravity(Gravity.CENTER);grid.addView(label,calendarCell(dp(28),dp(2)));}
        Calendar first=(Calendar)calendarMonth.clone();first.set(Calendar.DAY_OF_MONTH,1);int offset=first.get(Calendar.DAY_OF_WEEK)-Calendar.SUNDAY;for(int index=0;index<offset;index++)grid.addView(new View(this),calendarCell(dp(42),dp(2)));
        int maximum=first.getActualMaximum(Calendar.DAY_OF_MONTH);Calendar now=Calendar.getInstance();for(int day=1;day<=maximum;day++){Calendar date=(Calendar)first.clone();date.set(Calendar.DAY_OF_MONTH,day);boolean selected=sameDay(date,selectedDate),current=sameDay(date,now);Button cell=button(Integer.toString(day),selected?ORANGE:current?BLUE:DIM);cell.setTextColor(selected||current?BLACK:Color.LTGRAY);cell.setContentDescription(new SimpleDateFormat("EEEE, MMMM d, yyyy",Locale.getDefault()).format(date.getTime()));cell.setOnClickListener(v->{selectedDate=date;renderPage();});grid.addView(cell,calendarCell(dp(46),dp(2)));}
        month.addView(grid,matchWrap(0));pageContent.addView(month,matchWrap(dp(6)));
        LinearLayout selected=panel(BLUE);selected.addView(fieldLabel("SELECTED STARDATE"),matchWrap(dp(3)));selected.addView(containedLabel(new SimpleDateFormat("EEEE",Locale.getDefault()).format(selectedDate.getTime()).toUpperCase(Locale.ROOT),Color.WHITE,11,22,true,1),matchWrap(dp(2)));selected.addView(label(new SimpleDateFormat("MMMM d, yyyy",Locale.getDefault()).format(selectedDate.getTime()).toUpperCase(Locale.ROOT),PEACH,13,true),matchWrap(dp(3)));selected.addView(label("LOCAL TIME · "+new SimpleDateFormat("h:mm a · z",Locale.getDefault()).format(System.currentTimeMillis()).toUpperCase(Locale.ROOT),Color.LTGRAY,10,true),matchWrap(0));pageContent.addView(selected,matchWrap(0));
    }

    private boolean sameDay(Calendar first,Calendar second){return first.get(Calendar.ERA)==second.get(Calendar.ERA)&&first.get(Calendar.YEAR)==second.get(Calendar.YEAR)&&first.get(Calendar.DAY_OF_YEAR)==second.get(Calendar.DAY_OF_YEAR);}

    private void renderApplicationsPage(){
        heading("LOCAL LAUNCH SERVICE","APPLICATIONS",allApps.size()+" INSTALLED");
        Set<String> favorites=favoriteKeys();pageContent.addView(sectionHeader("FAVORITE APPLICATIONS",favorites.size()+" / 20"),matchWrap(dp(4)));
        GridLayout favoriteGrid=new GridLayout(this);favoriteGrid.setColumnCount(appColumns());int favoriteCount=0;for(LaunchEntry entry:allApps)if(favorites.contains(entry.key)&&favoriteCount++<20)favoriteGrid.addView(appCard(entry,true,true),gridCell(dp(3)));if(favoriteCount==0)favoriteGrid.addView(emptyState("NO FAVORITES YET · USE ☆ FAV ON ANY APPLICATION"),fullGridCell(appColumns()));pageContent.addView(favoriteGrid,matchWrap(dp(7)));
        ArrayList<CollectionEntry> folders=collections(FOLDERS,null);pageContent.addView(sectionHeader("APPLICATION FOLDERS",folders.size()+" FOLDERS"),matchWrap(dp(4)));
        if(folders.isEmpty()){Button create=button("+ CREATE FIRST FOLDER",VIOLET);create.setOnClickListener(v->createCollection(FOLDERS,"NEW FOLDER"));pageContent.addView(create,matchWrap(dp(7)));}
        else{LinearLayout folderList=column(BLACK);for(CollectionEntry folder:folders){Button open=button(folder.name+" · "+folder.apps.size()+" APPS",VIOLET);open.setOnClickListener(v->{activeFolderId=folder.id;switchPage("folders");});folderList.addView(open,matchWrap(dp(3)));}pageContent.addView(folderList,matchWrap(dp(7)));}
        LinearLayout searchDeck=panel(BLUE);searchDeck.addView(fieldLabel("UNIVERSAL APPLICATION SEARCH"),matchWrap(dp(4)));
        search=input("SEARCH INSTALLED APPLICATIONS…");search.setSingleLine(true);search.setImeOptions(EditorInfo.IME_ACTION_SEARCH);
        search.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence s,int a,int b,int c){}public void afterTextChanged(Editable s){}public void onTextChanged(CharSequence s,int a,int b,int c){visibleAppLimit=60;renderApplicationGrid(null);}});
        searchDeck.addView(search,matchWrap(0));pageContent.addView(searchDeck,matchWrap(dp(6)));
        applicationGrid=new GridLayout(this);pageContent.addView(applicationGrid,matchWrap(dp(16)));renderApplicationGrid(null);
    }
    private void renderFavoritesPage(){
        Set<String> keys=favoriteKeys();heading("PINNED APPLICATIONS","FAVORITES",keys.size()+" PINNED");
        pageContent.addView(instruction("Long-press an application or use its star control to add or remove it from Favorites."),matchWrap(dp(6)));
        applicationGrid=new GridLayout(this);pageContent.addView(applicationGrid,matchWrap(dp(16)));renderApplicationGrid(keys);
    }
    private void renderApplicationGrid(Set<String> filter){
        if(applicationGrid==null)return;
        String query=search==null?"":search.getText().toString().trim().toLowerCase(Locale.ROOT);
        Set<String> favorites=favoriteKeys();ArrayList<LaunchEntry> visible=new ArrayList<>();
        for(LaunchEntry entry:allApps){
            if(filter!=null&&!filter.contains(entry.key))continue;
            if(!query.isEmpty()&&!entry.label().toLowerCase(Locale.ROOT).contains(query)&&!entry.info.getComponentName().getPackageName().toLowerCase(Locale.ROOT).contains(query))continue;
            visible.add(entry);
        }
        int columns=appColumns();applicationGrid.removeAllViews();applicationGrid.setColumnCount(columns);
        if(visible.isEmpty())applicationGrid.addView(emptyState(filter==null?"NO APPLICATIONS MATCH THIS SEARCH":"NO FAVORITES YET · USE ☆ FAV ON AN APPLICATION"),fullGridCell(columns));
        else{int shown=Math.min(visible.size(),visibleAppLimit);for(int index=0;index<shown;index++){LaunchEntry entry=visible.get(index);applicationGrid.addView(appCard(entry,favorites.contains(entry.key),true),gridCell(dp(3)));}if(shown<visible.size()){Button more=button("SHOW "+Math.min(60,visible.size()-shown)+" MORE · "+shown+" / "+visible.size(),BLUE);more.setOnClickListener(v->{visibleAppLimit+=60;renderApplicationGrid(filter);});applicationGrid.addView(more,fullGridCell(columns));}}
    }

    private View appCard(LaunchEntry entry,boolean favorite,boolean folderControl){
        LinearLayout card=column(PANEL);card.setPadding(dp(cardInset()),dp(cardInset()),dp(cardInset()),dp(cardInset()));card.setBackground(shape(PANEL,22,3,22,22));card.setMinimumHeight(dp(compactLayout()?126:146));
        card.setContentDescription("Open "+entry.label());card.setOnClickListener(v->launch(entry));card.setOnLongClickListener(v->{toggleFavorite(entry);return true;});
        ImageView icon=new ImageView(this);try{Drawable drawable=iconCache.get(entry.key);if(drawable==null){drawable=entry.info.getBadgedIcon(getResources().getDisplayMetrics().densityDpi);if(drawable!=null)iconCache.put(entry.key,drawable);}icon.setImageDrawable(drawable);}catch(RuntimeException ignored){}
        LinearLayout.LayoutParams iconParams=new LinearLayout.LayoutParams(dp(compactLayout()?36:42),dp(compactLayout()?36:42));iconParams.gravity=Gravity.CENTER_HORIZONTAL;card.addView(icon,iconParams);
        TextView name=fittedLabel(entry.label().toUpperCase(Locale.ROOT),Color.WHITE,9,13,true);name.setGravity(Gravity.CENTER);card.addView(name,matchWrap(dp(2)));
        TextView profile=label(entry.serial==currentUserSerial()?"PERSONAL":"PROFILE",PEACH,8,true);profile.setGravity(Gravity.CENTER);card.addView(profile,matchWrap(dp(4)));
        LinearLayout actions=row(PANEL);Button star=button(favorite?"★ FAV":"☆ FAV",favorite?ORANGE:DIM);star.setOnClickListener(v->toggleFavorite(entry));
        actions.addView(star,weightedHeight(1,dp(34),folderControl?dp(2):0));
        if(folderControl){Button folder=button("FOLDER",VIOLET);folder.setOnClickListener(v->chooseFolder(entry));actions.addView(folder,weightedHeight(1,dp(34),0));}
        card.addView(actions,matchWrap(0));return card;
    }

    private void renderDecksPage(){
        ArrayList<CollectionEntry> decks=collections(DECKS,"PRIMARY");CollectionEntry active=selectedCollection(decks,activeDeckId);if(active!=null)activeDeckId=active.id;
        heading("CUSTOM LAUNCH SURFACES","LCARS DECKS",decks.size()+" DECKS");pageContent.addView(collectionSelector(decks,active,DECKS),matchWrap(dp(6)));if(active==null)return;
        LinearLayout tools=panel(ORANGE);tools.addView(fieldLabel(active.name+" DECK"),matchWrap(dp(4)));tools.addView(label("Add applications from the matrix below. Decks are independent of Favorites and folders.",Color.LTGRAY,11,false),matchWrap(dp(6)));
        LinearLayout actions=row(PANEL);Button create=button("NEW DECK",BLUE);create.setOnClickListener(v->createCollection(DECKS,"NEW DECK"));
        Button remove=button("DELETE DECK",PINK);remove.setEnabled(decks.size()>1);remove.setOnClickListener(v->deleteCollection(DECKS,active.id));
        actions.addView(create,weightedHeight(1,dp(42),dp(3)));actions.addView(remove,weightedHeight(1,dp(42),0));tools.addView(actions,matchWrap(0));pageContent.addView(tools,matchWrap(dp(6)));
        GridLayout selected=new GridLayout(this);selected.setColumnCount(appColumns());
        for(LaunchEntry entry:allApps)if(active.apps.contains(entry.key))selected.addView(appCard(entry,favoriteKeys().contains(entry.key),false),gridCell(dp(3)));
        if(active.apps.isEmpty())selected.addView(emptyState("THIS DECK IS EMPTY · ADD APPLICATIONS BELOW"),fullGridCell(appColumns()));pageContent.addView(selected,matchWrap(dp(7)));
        pageContent.addView(sectionHeader("APPLICATION MATRIX","TOGGLE MEMBERSHIP"),matchWrap(dp(4)));
        GridLayout matrix=new GridLayout(this);matrix.setColumnCount(appColumns());
        for(LaunchEntry entry:allApps)matrix.addView(collectionToggleCard(entry,active,DECKS),gridCell(dp(3)));pageContent.addView(matrix,matchWrap(dp(16)));
    }

    private void renderFoldersPage(){
        ArrayList<CollectionEntry> folders=collections(FOLDERS,null);CollectionEntry active=selectedCollection(folders,activeFolderId);if(active!=null)activeFolderId=active.id;
        heading("GROUPED APPLICATIONS","FOLDERS",folders.size()+" FOLDERS");
        Button create=button("+ CREATE APPLICATION FOLDER",ORANGE);create.setOnClickListener(v->createCollection(FOLDERS,"NEW FOLDER"));pageContent.addView(create,matchWrap(dp(5)));
        if(folders.isEmpty()){pageContent.addView(emptyState("NO FOLDERS YET · CREATE ONE, THEN USE F+ ON AN APPLICATION"),matchWrap(0));return;}
        pageContent.addView(collectionSelector(folders,active,FOLDERS),matchWrap(dp(6)));if(active==null)return;
        LinearLayout title=panel(VIOLET);title.addView(fieldLabel(active.name),matchWrap(dp(3)));title.addView(label(active.apps.size()+" APPLICATIONS",Color.WHITE,17,true),matchWrap(dp(5)));
        Button remove=button("DELETE FOLDER",PINK);remove.setOnClickListener(v->deleteCollection(FOLDERS,active.id));title.addView(remove,matchWrap(0));pageContent.addView(title,matchWrap(dp(6)));
        GridLayout grid=new GridLayout(this);grid.setColumnCount(appColumns());for(LaunchEntry app:allApps)if(active.apps.contains(app.key))grid.addView(appCard(app,favoriteKeys().contains(app.key),true),gridCell(dp(3)));
        if(active.apps.isEmpty())grid.addView(emptyState("FOLDER EMPTY · USE F+ IN APPLICATIONS"),fullGridCell(appColumns()));pageContent.addView(grid,matchWrap(dp(16)));
    }

    private View collectionSelector(ArrayList<CollectionEntry> entries,CollectionEntry active,String key){
        LinearLayout selector=column(BLACK);
        for(int i=0;i<entries.size();i++){CollectionEntry entry=entries.get(i);boolean selected=active!=null&&active.id.equals(entry.id);
            Button button=button(String.format(Locale.ROOT,"%02d · %s · %d APPS",i+1,entry.name,entry.apps.size()),selected?ORANGE:DIM);button.setTextColor(selected?BLACK:Color.LTGRAY);button.setGravity(Gravity.CENTER_VERTICAL|Gravity.LEFT);
            button.setOnClickListener(v->{if(key.equals(DECKS))activeDeckId=entry.id;else activeFolderId=entry.id;renderPage();});selector.addView(button,matchWrap(dp(3)));
        }return selector;
    }
    private View collectionToggleCard(LaunchEntry app,CollectionEntry collection,String key){
        boolean member=collection.apps.contains(app.key);Button button=button((member?"✓ ":"+ ")+app.label().toUpperCase(Locale.ROOT),member?BLUE:DIM);button.setTextColor(member?BLACK:Color.LTGRAY);button.setMinHeight(dp(compactLayout()?58:68));
        button.setOnClickListener(v->{if(!collection.apps.add(app.key))collection.apps.remove(app.key);saveCollections(key,collectionsWithReplacement(key,collection));renderPage();});return button;
    }

    private void renderWidgetsPage(){
        Set<Integer> ids=widgetIds();heading("ANDROID APPWIDGET HOST","WIDGETS",ids.size()+" ACTIVE");
        LinearLayout intro=panel(BLUE);intro.addView(fieldLabel("NATIVE HOME WIDGETS"),matchWrap(dp(3)));intro.addView(label("Select any widget installed on this device. Android controls binding and configuration permissions.",Color.LTGRAY,11,false),matchWrap(dp(6)));
        Button add=button("+ ADD ANDROID WIDGET",ORANGE);add.setOnClickListener(v->pickWidget());intro.addView(add,matchWrap(0));pageContent.addView(intro,matchWrap(dp(6)));
        if(ids.isEmpty()){pageContent.addView(emptyState("NO WIDGETS HOSTED · ADD ONE TO THIS LCARS HOME"),matchWrap(0));return;}for(int id:ids)addHostedWidget(id);
    }
    private void pickWidget(){
        pendingWidgetId=appWidgetHost.allocateAppWidgetId();Intent pick=new Intent(AppWidgetManager.ACTION_APPWIDGET_PICK);pick.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,pendingWidgetId);
        try{startActivityForResult(pick,PICK_WIDGET_REQUEST);}catch(RuntimeException error){appWidgetHost.deleteAppWidgetId(pendingWidgetId);pendingWidgetId=AppWidgetManager.INVALID_APPWIDGET_ID;Toast.makeText(this,"ANDROID WIDGET PICKER UNAVAILABLE",Toast.LENGTH_LONG).show();}
    }
    private void addHostedWidget(int id){
        AppWidgetProviderInfo info=appWidgetManager.getAppWidgetInfo(id);if(info==null){removeWidget(id);return;}
        LinearLayout frame=panel(VIOLET),top=row(PANEL);CharSequence widgetLabel=info.loadLabel(getPackageManager());TextView title=fittedLabel((widgetLabel==null?"ANDROID WIDGET":widgetLabel.toString()).toUpperCase(Locale.ROOT),PEACH,9,13,true);top.addView(title,new LinearLayout.LayoutParams(0,dp(38),1));
        Button remove=button("REMOVE",PINK);remove.setOnClickListener(v->removeWidget(id));top.addView(remove,new LinearLayout.LayoutParams(dp(78),dp(38)));frame.addView(top,matchWrap(dp(5)));
        AppWidgetHostView host=appWidgetHost.createView(this,id,info);host.setAppWidget(id,info);int height=Math.max(dp(120),Math.min(dp(320),dp(Math.max(120,info.minHeight))));
        frame.addView(host,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,height));pageContent.addView(frame,matchWrap(dp(6)));
    }
    private void removeWidget(int id){Set<Integer> ids=widgetIds();ids.remove(id);saveWidgetIds(ids);try{appWidgetHost.deleteAppWidgetId(id);}catch(RuntimeException ignored){}renderPage();}

    private void renderDisplayPage(){
        String selected=preferences.getString("display-theme","enterprise-d");heading("VERIFIED LCARS FAMILIES","DISPLAY MATRIX",themeLabel(selected));
        pageContent.addView(instruction("Each matrix changes palette, corner geometry, borders, navigation, and panel density—not only color."),matchWrap(dp(6)));
        String[][] themes={{"enterprise-d","ENTERPRISE-D","TNG GALAXY-CLASS · 2364–2370"},{"voyager","VOYAGER","INTREPID-CLASS · 2371–2378"},{"nemesis","ENTERPRISE-E","NEMESIS LCARS · 2379"},{"picard","PICARD STARFLEET","TITAN-A / FLEET · 2401"},{"cerritos","CERRITOS","CALIFORNIA-CLASS · 2380s"},{"defiant","DEFIANT","TACTICAL LCARS · 2370s"}};
        for(String[] theme:themes){LinearLayout item=panel(themeAccent(theme[0]));item.addView(fieldLabel(theme[2]),matchWrap(dp(2)));item.addView(label(theme[1],Color.WHITE,18,true),matchWrap(dp(5)));
            Button select=button(selected.equals(theme[0])?"ACTIVE DISPLAY":"APPLY DISPLAY",selected.equals(theme[0])?BLUE:themeAccent(theme[0]));select.setOnClickListener(v->{preferences.edit().putString("display-theme",theme[0]).apply();recreate();});item.addView(select,matchWrap(0));pageContent.addView(item,matchWrap(dp(5)));}
    }

    private void renderSettingsPage(){
        heading("HOME CONFIGURATION","SETTINGS",compactLayout()?"COMPACT":"STANDARD");
        LinearLayout layout=panel(ORANGE);layout.addView(fieldLabel("LAYOUT CUSTOMIZATION"),matchWrap(dp(5)));
        layout.addView(choiceRow("SIDEBAR",new String[]{"STANDARD","COMPACT"},new String[]{"standard","compact"},preferences.getString("sidebar-size","standard"),"sidebar-size"),matchWrap(dp(5)));
        layout.addView(choiceRow("DENSITY",new String[]{"COMFORTABLE","COMPACT"},new String[]{"comfortable","compact"},preferences.getString("layout-density","comfortable"),"layout-density"),matchWrap(dp(5)));
        layout.addView(choiceRow("APP COLUMNS",new String[]{"AUTO","2","3","4"},new String[]{"auto","2","3","4"},preferences.getString("app-columns","auto"),"app-columns"),matchWrap(0));pageContent.addView(layout,matchWrap(dp(6)));
        LinearLayout backup=panel(VIOLET);backup.addView(fieldLabel("CONFIGURATION BACKUP"),matchWrap(dp(3)));backup.addView(label("Export or restore Display Matrix, layout, favorites, decks, and folders. Android widget bindings remain device-specific.",Color.LTGRAY,11,false),matchWrap(dp(6)));
        LinearLayout backupActions=row(PANEL);Button export=button("EXPORT",BLUE);export.setOnClickListener(v->exportBackup());Button restore=button("RESTORE",VIOLET);restore.setOnClickListener(v->importBackup());
        backupActions.addView(export,weightedHeight(1,dp(44),dp(3)));backupActions.addView(restore,weightedHeight(1,dp(44),0));backup.addView(backupActions,matchWrap(0));pageContent.addView(backup,matchWrap(dp(6)));
        LinearLayout updates=panel(GOLD);updates.addView(fieldLabel("MOBILE UPDATE CONSOLE"),matchWrap(dp(3)));updates.addView(label("One tap checks GitHub, downloads the current Android package, verifies its published SHA-256 checksum, and opens Android's required installation confirmation.",Color.LTGRAY,11,false),matchWrap(dp(6)));
        updateStatus=containedLabel("UPDATE CHANNEL READY · VERSION 30.1 DEVELOPMENT",PEACH,7,11,true,2);updates.addView(updateStatus,matchWrap(dp(5)));Button check=button("CHECK + INSTALL MOBILE UPDATE",GOLD);check.setOnClickListener(v->{check.setEnabled(false);MobileUpdateManager.checkAndInstall(this,(message,error)->{if(updateStatus!=null){updateStatus.setText(message);updateStatus.setTextColor(error?PINK:PEACH);}check.setEnabled(true);});});updates.addView(check,matchWrap(0));pageContent.addView(updates,matchWrap(dp(6)));
        LinearLayout role=panel(BLUE);role.addView(fieldLabel("ANDROID HOME CONTROL"),matchWrap(dp(5)));
        Button home=button(homeRoleHeld()?"LCARS IS CURRENT HOME":"MAKE LCARS DEFAULT HOME",homeRoleHeld()?BLUE:ORANGE);home.setOnClickListener(v->requestHomeRole());role.addView(home,matchWrap(dp(4)));
        Button system=button("OPEN ANDROID HOME SETTINGS",VIOLET);system.setOnClickListener(v->openHomeSettings());role.addView(system,matchWrap(dp(4)));
        Button reset=button("RESET HOME LAYOUT",PINK);reset.setOnClickListener(v->confirmReset());role.addView(reset,matchWrap(0));pageContent.addView(role,matchWrap(0));
    }
    private View choiceRow(String title,String[] labels,String[] values,String current,String key){
        LinearLayout group=column(PANEL),choices=row(PANEL);group.addView(label(title,PEACH,9,true),matchWrap(dp(3)));
        for(int i=0;i<labels.length;i++){String value=values[i];Button option=button(labels[i],current.equals(value)?ORANGE:DIM);option.setTextColor(current.equals(value)?BLACK:Color.LTGRAY);option.setOnClickListener(v->{preferences.edit().putString(key,value).apply();buildHome();});choices.addView(option,weightedHeight(1,dp(40),i==labels.length-1?0:dp(2)));}
        group.addView(choices,matchWrap(0));return group;
    }

    private void renderCompanionPage(){
        heading("CONNECTED OPERATIONS","COMPANION",pairedStatus());
        if(companionDock!=null)companionDock.destroy();companionDock=new CompanionDock(this,stationStore);pageContent.addView(companionDock,matchWrap(dp(6)));companionDock.start();
    }

    private void reloadApps(){
        if(launcherApps==null||userManager==null)return;
        appLoader.execute(()->{ArrayList<LaunchEntry> discovered=new ArrayList<>();try{
            for(UserHandle profile:launcherApps.getProfiles()){long serial=userManager.getSerialNumberForUser(profile);for(LauncherActivityInfo info:launcherApps.getActivityList(null,profile)){ComponentName component=info.getComponentName();if(component.getPackageName().equals(getPackageName())&&(component.getClassName().equals(HomeActivity.class.getName())||component.getClassName().equals(MainActivity.class.getName())))continue;discovered.add(new LaunchEntry(info,serial+"|"+component.flattenToString(),serial));}}
            Collator collator=Collator.getInstance();discovered.sort((a,b)->collator.compare(a.label(),b.label()));
            runOnUiThread(()->{allApps.clear();allApps.addAll(discovered);iconCache.keySet().retainAll(new HashSet<>(applicationKeys(discovered)));if(activePage.equals("applications")||activePage.equals("favorites")||activePage.equals("decks")||activePage.equals("folders")||activePage.equals("status"))renderPage();});
        }catch(RuntimeException error){runOnUiThread(()->Toast.makeText(this,"APPLICATION LIBRARY UNAVAILABLE",Toast.LENGTH_LONG).show());}});
    }
    private ArrayList<String> applicationKeys(ArrayList<LaunchEntry> entries){ArrayList<String> keys=new ArrayList<>();for(LaunchEntry entry:entries)keys.add(entry.key);return keys;}
    private void launch(LaunchEntry entry){try{if(entry.info.getUser().equals(android.os.Process.myUserHandle())){Intent intent=Intent.makeMainActivity(entry.info.getComponentName());intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);startActivity(intent);overridePendingTransition(0,0);}else launcherApps.startMainActivity(entry.info.getComponentName(),entry.info.getUser(),null,null);}catch(RuntimeException error){Toast.makeText(this,"COULD NOT OPEN "+entry.label().toUpperCase(Locale.ROOT),Toast.LENGTH_SHORT).show();}}
    private void toggleFavorite(LaunchEntry entry){Set<String> values=favoriteKeys();if(values.contains(entry.key))values.remove(entry.key);else if(values.size()>=20){Toast.makeText(this,"FAVORITES FULL · REMOVE ONE OF 20 FIRST",Toast.LENGTH_LONG).show();return;}else values.add(entry.key);preferences.edit().putStringSet(FAVORITES,values).apply();renderPage();}

    private void chooseFolder(LaunchEntry app){
        ArrayList<CollectionEntry> folders=collections(FOLDERS,null);if(folders.isEmpty()){Toast.makeText(this,"CREATE A FOLDER FIRST",Toast.LENGTH_SHORT).show();switchPage("folders");return;}
        String[] names=new String[folders.size()];boolean[] checked=new boolean[folders.size()];for(int i=0;i<folders.size();i++){names[i]=folders.get(i).name;checked[i]=folders.get(i).apps.contains(app.key);}
        new AlertDialog.Builder(this).setTitle("APPLICATION FOLDERS").setMultiChoiceItems(names,checked,(dialog,which,value)->{if(value)folders.get(which).apps.add(app.key);else folders.get(which).apps.remove(app.key);}).setPositiveButton("SAVE",(dialog,which)->{saveCollections(FOLDERS,folders);renderPage();}).setNegativeButton("CANCEL",null).show();
    }
    private void createCollection(String key,String hint){
        EditText name=input(hint);name.setSingleLine(true);
        new AlertDialog.Builder(this).setTitle(key.equals(DECKS)?"NEW LCARS DECK":"NEW APPLICATION FOLDER").setView(name).setPositiveButton("CREATE",(dialog,which)->{
            String value=name.getText().toString().trim().toUpperCase(Locale.ROOT);if(value.isEmpty())return;ArrayList<CollectionEntry> entries=collections(key,key.equals(DECKS)?"PRIMARY":null);CollectionEntry entry=new CollectionEntry("collection-"+System.currentTimeMillis(),value,new HashSet<>());entries.add(entry);saveCollections(key,entries);if(key.equals(DECKS))activeDeckId=entry.id;else activeFolderId=entry.id;renderPage();
        }).setNegativeButton("CANCEL",null).show();
    }
    private void deleteCollection(String key,String id){
        new AlertDialog.Builder(this).setTitle("DELETE COLLECTION?").setMessage("Applications remain installed; only this LCARS collection is removed.").setPositiveButton("DELETE",(dialog,which)->{
            ArrayList<CollectionEntry> entries=collections(key,key.equals(DECKS)?"PRIMARY":null);entries.removeIf(entry->entry.id.equals(id));if(key.equals(DECKS)&&entries.isEmpty())entries.add(new CollectionEntry("deck-primary","PRIMARY",new HashSet<>()));saveCollections(key,entries);if(key.equals(DECKS))activeDeckId=null;else activeFolderId=null;renderPage();
        }).setNegativeButton("CANCEL",null).show();
    }
    private ArrayList<CollectionEntry> collections(String key,String defaultName){
        ArrayList<CollectionEntry> result=new ArrayList<>();try{JSONArray values=new JSONArray(preferences.getString(key,"[]"));
            for(int i=0;i<values.length();i++){JSONObject value=values.optJSONObject(i);if(value==null)continue;HashSet<String> apps=new HashSet<>();JSONArray list=value.optJSONArray("apps");if(list!=null)for(int j=0;j<list.length();j++)apps.add(list.optString(j));result.add(new CollectionEntry(value.optString("id","collection-"+i),value.optString("name","COLLECTION"),apps));}
        }catch(Exception ignored){}if(result.isEmpty()&&defaultName!=null)result.add(new CollectionEntry("deck-primary",defaultName,new HashSet<>()));return result;
    }
    private void saveCollections(String key,ArrayList<CollectionEntry> entries){
        JSONArray values=new JSONArray();try{for(CollectionEntry entry:entries){JSONObject value=new JSONObject();value.put("id",entry.id);value.put("name",entry.name);value.put("apps",new JSONArray(entry.apps));values.put(value);}}catch(Exception ignored){}preferences.edit().putString(key,values.toString()).apply();
    }
    private ArrayList<CollectionEntry> collectionsWithReplacement(String key,CollectionEntry replacement){ArrayList<CollectionEntry> entries=collections(key,key.equals(DECKS)?"PRIMARY":null);for(int i=0;i<entries.size();i++)if(entries.get(i).id.equals(replacement.id))entries.set(i,replacement);return entries;}
    private CollectionEntry selectedCollection(ArrayList<CollectionEntry> entries,String selected){if(selected!=null)for(CollectionEntry entry:entries)if(entry.id.equals(selected))return entry;return entries.isEmpty()?null:entries.get(0);}
    private Set<String> favoriteKeys(){return new HashSet<>(preferences.getStringSet(FAVORITES,new HashSet<>()));}
    private Set<Integer> widgetIds(){Set<Integer> ids=new HashSet<>();for(String value:preferences.getStringSet(WIDGET_IDS,new HashSet<>()))try{ids.add(Integer.parseInt(value));}catch(NumberFormatException ignored){}return ids;}
    private void saveWidgetIds(Set<Integer> ids){HashSet<String> values=new HashSet<>();for(int id:ids)values.add(Integer.toString(id));preferences.edit().putStringSet(WIDGET_IDS,values).apply();}

    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(request==HOME_ROLE_REQUEST){renderPage();return;}
        if(request==EXPORT_BACKUP_REQUEST){if(result==RESULT_OK&&data!=null)writeBackup(data.getData());return;}
        if(request==IMPORT_BACKUP_REQUEST){if(result==RESULT_OK&&data!=null)readBackup(data.getData());return;}
        if(request==PICK_WIDGET_REQUEST||request==CONFIGURE_WIDGET_REQUEST){
            int id=data==null?pendingWidgetId:data.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,pendingWidgetId);
            if(result!=RESULT_OK||id==AppWidgetManager.INVALID_APPWIDGET_ID){if(id!=AppWidgetManager.INVALID_APPWIDGET_ID)appWidgetHost.deleteAppWidgetId(id);pendingWidgetId=AppWidgetManager.INVALID_APPWIDGET_ID;return;}
            if(request==PICK_WIDGET_REQUEST){AppWidgetProviderInfo info=appWidgetManager.getAppWidgetInfo(id);if(info!=null&&info.configure!=null){Intent configure=new Intent(AppWidgetManager.ACTION_APPWIDGET_CONFIGURE);configure.setComponent(info.configure);configure.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,id);pendingWidgetId=id;try{startActivityForResult(configure,CONFIGURE_WIDGET_REQUEST);return;}catch(RuntimeException ignored){}}}
            Set<Integer> ids=widgetIds();ids.add(id);saveWidgetIds(ids);pendingWidgetId=AppWidgetManager.INVALID_APPWIDGET_ID;renderPage();
        }
    }

    private void exportBackup(){Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("application/json");intent.putExtra(Intent.EXTRA_TITLE,"LCARS-Home-v30-1-backup.json");startActivityForResult(intent,EXPORT_BACKUP_REQUEST);}
    private void importBackup(){Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("application/json");startActivityForResult(intent,IMPORT_BACKUP_REQUEST);}
    private void writeBackup(Uri target){
        if(target==null)return;try(OutputStream stream=getContentResolver().openOutputStream(target)){if(stream==null)throw new IllegalStateException("Document unavailable");JSONObject backup=new JSONObject();
            backup.put("format","lcars-home-backup");backup.put("version","29");backup.put("favorites",new JSONArray(favoriteKeys()));backup.put("decks",new JSONArray(preferences.getString(DECKS,"[]")));backup.put("folders",new JSONArray(preferences.getString(FOLDERS,"[]")));
            backup.put("displayTheme",preferences.getString("display-theme","enterprise-d"));backup.put("sidebarSize",preferences.getString("sidebar-size","standard"));backup.put("layoutDensity",preferences.getString("layout-density","comfortable"));backup.put("appColumns",preferences.getString("app-columns","auto"));
            stream.write(backup.toString(2).getBytes(StandardCharsets.UTF_8));Toast.makeText(this,"LCARS HOME BACKUP EXPORTED",Toast.LENGTH_LONG).show();
        }catch(Exception error){Toast.makeText(this,"BACKUP FAILED · "+error.getMessage(),Toast.LENGTH_LONG).show();}
    }
    private void readBackup(Uri source){
        if(source==null)return;try(InputStream stream=getContentResolver().openInputStream(source);BufferedReader reader=new BufferedReader(new InputStreamReader(stream,StandardCharsets.UTF_8))){
            StringBuilder text=new StringBuilder();for(String line;(line=reader.readLine())!=null;)text.append(line);JSONObject backup=new JSONObject(text.toString());if(!"lcars-home-backup".equals(backup.optString("format")))throw new IllegalArgumentException("Not an LCARS Home backup");
            HashSet<String> favorites=new HashSet<>();JSONArray values=backup.optJSONArray("favorites");if(values!=null)for(int i=0;i<values.length();i++)favorites.add(values.optString(i));
            preferences.edit().putStringSet(FAVORITES,favorites).putString(DECKS,jsonArrayText(backup,"decks")).putString(FOLDERS,jsonArrayText(backup,"folders")).putString("display-theme",backup.optString("displayTheme","enterprise-d")).putString("sidebar-size",backup.optString("sidebarSize","standard")).putString("layout-density",backup.optString("layoutDensity","comfortable")).putString("app-columns",backup.optString("appColumns","auto")).apply();
            Toast.makeText(this,"LCARS HOME CONFIGURATION RESTORED",Toast.LENGTH_LONG).show();recreate();
        }catch(Exception error){Toast.makeText(this,"RESTORE FAILED · "+error.getMessage(),Toast.LENGTH_LONG).show();}
    }
    private String jsonArrayText(JSONObject value,String key){JSONArray array=value.optJSONArray(key);return array==null?"[]":array.toString();}
    private void confirmReset(){new AlertDialog.Builder(this).setTitle("RESET HOME LAYOUT?").setMessage("Display, layout, decks, folders, and favorites return to defaults. Android widget bindings are preserved.").setPositiveButton("RESET",(dialog,which)->{Set<String> widgets=new HashSet<>(preferences.getStringSet(WIDGET_IDS,new HashSet<>()));preferences.edit().clear().putStringSet(WIDGET_IDS,widgets).apply();recreate();}).setNegativeButton("CANCEL",null).show();}

    private void requestHomeRole(){
        if(Build.VERSION.SDK_INT>=29){RoleManager roles=getSystemService(RoleManager.class);if(roles!=null&&roles.isRoleAvailable(RoleManager.ROLE_HOME)&&!roles.isRoleHeld(RoleManager.ROLE_HOME)){startActivityForResult(roles.createRequestRoleIntent(RoleManager.ROLE_HOME),HOME_ROLE_REQUEST);return;}}openHomeSettings();
    }
    private boolean homeRoleHeld(){if(Build.VERSION.SDK_INT<29)return false;RoleManager roles=getSystemService(RoleManager.class);return roles!=null&&roles.isRoleHeld(RoleManager.ROLE_HOME);}
    private void openHomeSettings(){try{startActivity(new Intent(Settings.ACTION_HOME_SETTINGS));}catch(RuntimeException ignored){startActivity(new Intent(Settings.ACTION_SETTINGS));}}
    private String pairedStatus(){return stationStore==null||stationStore.active()==null?"NOT PAIRED":stationStore.all().size()+" STATION"+(stationStore.all().size()==1?"":"S");}
    private int batteryPercent(){BatteryManager manager=(BatteryManager)getSystemService(BATTERY_SERVICE);return manager==null?-1:manager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);}
    private boolean isCharging(){BatteryManager manager=(BatteryManager)getSystemService(BATTERY_SERVICE);return manager!=null&&manager.isCharging();}
    private String networkLabel(){ConnectivityManager manager=(ConnectivityManager)getSystemService(CONNECTIVITY_SERVICE);if(manager==null)return"OFFLINE";Network network=manager.getActiveNetwork();NetworkCapabilities caps=network==null?null:manager.getNetworkCapabilities(network);if(caps==null)return"OFFLINE";if(caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI))return"WI-FI";if(caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR))return"CELLULAR";if(caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET))return"ETHERNET";return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)?"ONLINE":"LOCAL";}
    private String storageFree(){StatFs stats=new StatFs(Environment.getDataDirectory().getAbsolutePath());long bytes=stats.getAvailableBytes();if(bytes>=1024L*1024L*1024L)return String.format(Locale.ROOT,"%.1f GB",bytes/(1024d*1024d*1024d));return Math.max(0,bytes/(1024L*1024L))+" MB";}
    private long currentUserSerial(){return userManager==null?-1:userManager.getSerialNumberForUser(android.os.Process.myUserHandle());}

    private int appColumns(){String value=preferences.getString("app-columns","auto");if(!value.equals("auto"))try{return Math.max(2,Math.min(4,Integer.parseInt(value)));}catch(NumberFormatException ignored){}int available=getResources().getConfiguration().screenWidthDp-sidebarWidth();if(available>=720)return 6;if(available>=520)return 4;if(available>=350)return 3;return 2;}
    private int statusColumns(){return getResources().getConfiguration().screenWidthDp-sidebarWidth()>=430?4:2;}
    private boolean compactLayout(){return preferences.getString("layout-density","comfortable").equals("compact");}
    private int sidebarWidth(){return preferences.getString("sidebar-size","standard").equals("compact")?78:98;}
    private int navHeight(){return compactLayout()?37:43;}private int contentInset(){return compactLayout()?3:6;}private int cardInset(){return compactLayout()?5:8;}
    private int clockWidth(){return getResources().getConfiguration().screenWidthDp<390?72:86;}

    private void applyDisplayMatrix(){
        String theme=preferences.getString("display-theme","enterprise-d");
        if(theme.equals("voyager")){PANEL=Color.rgb(11,14,20);DIM=Color.rgb(25,35,49);GOLD=Color.rgb(255,204,102);ORANGE=Color.rgb(217,122,87);PEACH=Color.rgb(216,154,122);PINK=Color.rgb(216,110,138);VIOLET=Color.rgb(154,141,201);BLUE=Color.rgb(101,142,199);outerRadius=16;innerRadius=2;panelStroke=1;}
        else if(theme.equals("nemesis")){PANEL=Color.rgb(3,10,19);DIM=Color.rgb(7,28,50);GOLD=Color.rgb(143,199,238);ORANGE=Color.rgb(56,133,193);PEACH=Color.rgb(112,177,223);PINK=Color.rgb(120,110,196);VIOLET=Color.rgb(90,121,202);BLUE=Color.rgb(43,112,184);outerRadius=3;innerRadius=1;panelStroke=1;}
        else if(theme.equals("picard")){PANEL=Color.rgb(8,7,5);DIM=Color.rgb(35,24,15);GOLD=Color.rgb(221,185,113);ORANGE=Color.rgb(157,89,62);PEACH=Color.rgb(217,180,124);PINK=Color.rgb(150,77,94);VIOLET=Color.rgb(86,93,134);BLUE=Color.rgb(55,103,124);outerRadius=3;innerRadius=1;panelStroke=1;}
        else if(theme.equals("cerritos")){PANEL=Color.rgb(24,19,28);DIM=Color.rgb(55,40,59);GOLD=Color.rgb(255,226,78);ORANGE=Color.rgb(255,157,70);PEACH=Color.rgb(255,196,155);PINK=Color.rgb(255,111,181);VIOLET=Color.rgb(185,139,242);BLUE=Color.rgb(95,169,255);outerRadius=42;innerRadius=4;panelStroke=3;}
        else if(theme.equals("defiant")){PANEL=Color.rgb(10,10,14);DIM=Color.rgb(35,29,34);GOLD=Color.rgb(215,184,109);ORANGE=Color.rgb(185,104,77);PEACH=Color.rgb(214,154,119);PINK=Color.rgb(181,109,131);VIOLET=Color.rgb(126,120,165);BLUE=Color.rgb(104,127,169);outerRadius=8;innerRadius=2;panelStroke=2;}
    }
    private String themeLabel(String theme){if(theme.equals("voyager"))return"VOYAGER";if(theme.equals("nemesis"))return"ENTERPRISE-E";if(theme.equals("picard"))return"PICARD STARFLEET";if(theme.equals("cerritos"))return"CERRITOS";if(theme.equals("defiant"))return"DEFIANT";return"ENTERPRISE-D";}
    private int themeAccent(String theme){if(theme.equals("voyager"))return Color.rgb(101,142,199);if(theme.equals("nemesis"))return Color.rgb(43,112,184);if(theme.equals("picard"))return Color.rgb(221,185,113);if(theme.equals("cerritos"))return Color.rgb(255,111,181);if(theme.equals("defiant"))return Color.rgb(185,104,77);return Color.rgb(255,152,104);}

    private TextView sectionHeader(String title,String detail){TextView view=label(title+"\n"+detail,BLACK,12,true);view.setBackground(shape(ORANGE,26,3,3,26));view.setPadding(dp(12),dp(7),dp(12),dp(7));return view;}
    private TextView instruction(String text){TextView view=label(text,Color.LTGRAY,11,false);view.setLineSpacing(0,1.12f);view.setPadding(dp(10),dp(9),dp(10),dp(9));view.setBackground(shape(PANEL,20,3,20,20));return view;}
    private TextView emptyState(String text){TextView view=label(text,PEACH,10,true);view.setGravity(Gravity.CENTER);view.setBackground(shape(PANEL,22,3,22,22));view.setPadding(dp(10),dp(16),dp(10),dp(16));return view;}
    private LinearLayout panel(int accent){LinearLayout view=column(PANEL);view.setPadding(dp(compactLayout()?8:11),dp(compactLayout()?7:9),dp(compactLayout()?8:11),dp(compactLayout()?7:9));GradientDrawable background=shape(PANEL,22,3,22,22);background.setStroke(dp(panelStroke),accent);view.setBackground(background);return view;}
    private EditText input(String hint){EditText view=new EditText(this);view.setHint(hint);view.setHintTextColor(Color.rgb(132,126,139));view.setTextColor(Color.WHITE);view.setTextSize(TypedValue.COMPLEX_UNIT_SP,14);view.setPadding(dp(10),dp(8),dp(10),dp(8));view.setBackground(shape(DIM,20,3,20,20));return view;}
    private Button button(String text,int color){Button view=new Button(this);view.setAllCaps(false);view.setText(text);view.setTextColor(BLACK);view.setTextSize(TypedValue.COMPLEX_UNIT_SP,10);view.setTypeface(Typeface.create("sans-serif-condensed",Typeface.BOLD));view.setPadding(dp(6),dp(4),dp(6),dp(4));view.setMinHeight(dp(34));view.setMinimumHeight(0);view.setMinimumWidth(0);view.setElevation(0);view.setStateListAnimator(null);view.setBackground(shape(color,22,3,22,22));return view;}
    private TextView fieldLabel(String text){return label(text,PEACH,10,true);}
    private TextView label(String text,int color,int size,boolean bold){TextView view=new TextView(this);view.setText(text);view.setTextColor(color);view.setTextSize(TypedValue.COMPLEX_UNIT_SP,size);view.setTypeface(Typeface.create("sans-serif-condensed",bold?Typeface.BOLD:Typeface.NORMAL));view.setGravity(Gravity.CENTER_VERTICAL);return view;}
    private TextView fittedLabel(String text,int color,int minimum,int maximum,boolean bold){TextView view=label(text,color,maximum,bold);view.setSingleLine(true);view.setEllipsize(TextUtils.TruncateAt.END);if(Build.VERSION.SDK_INT>=26)view.setAutoSizeTextTypeUniformWithConfiguration(minimum,maximum,1,TypedValue.COMPLEX_UNIT_SP);return view;}
    private TextView containedLabel(String text,int color,int minimum,int maximum,boolean bold,int lines){TextView view=label(text,color,maximum,bold);view.setMaxLines(lines);view.setEllipsize(TextUtils.TruncateAt.END);view.setBreakStrategy(android.text.Layout.BREAK_STRATEGY_SIMPLE);view.setHyphenationFrequency(android.text.Layout.HYPHENATION_FREQUENCY_NONE);view.setIncludeFontPadding(false);view.setGravity(Gravity.CENTER_VERTICAL);if(Build.VERSION.SDK_INT>=26)view.setAutoSizeTextTypeUniformWithConfiguration(minimum,maximum,1,TypedValue.COMPLEX_UNIT_SP);return view;}
    private LinearLayout row(int color){LinearLayout view=new LinearLayout(this);view.setOrientation(LinearLayout.HORIZONTAL);view.setGravity(Gravity.CENTER_VERTICAL);view.setBackgroundColor(color);return view;}
    private LinearLayout column(int color){LinearLayout view=new LinearLayout(this);view.setOrientation(LinearLayout.VERTICAL);view.setBackgroundColor(color);return view;}
    private GradientDrawable shape(int color,int tl,int tr,int br,int bl){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadii(new float[]{radius(tl),radius(tl),radius(tr),radius(tr),radius(br),radius(br),radius(bl),radius(bl)});return d;}
    private float radius(int requested){return dp(requested<=3?innerRadius:Math.min(requested,outerRadius));}

    private void setInsetAwareContent(View content,int left,int top,int right,int bottom){
        final int baseLeft=dp(left),baseTop=dp(top),baseRight=dp(right),baseBottom=dp(bottom);content.setBackgroundColor(BLACK);
        content.setOnApplyWindowInsetsListener((view,insets)->{int l,t,r,b;if(Build.VERSION.SDK_INT>=30){android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout()|WindowInsets.Type.ime());l=bars.left;t=bars.top;r=bars.right;b=bars.bottom;}else{l=insets.getSystemWindowInsetLeft();t=insets.getSystemWindowInsetTop();r=insets.getSystemWindowInsetRight();b=insets.getSystemWindowInsetBottom();}view.setPadding(baseLeft+l,baseTop+t,baseRight+r,baseBottom+b);return insets;});
        setContentView(content);content.requestApplyInsets();
    }
    private LinearLayout.LayoutParams matchWrap(int bottom){LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.WRAP_CONTENT);p.bottomMargin=bottom;return p;}
    private LinearLayout.LayoutParams matchHeight(int height,int bottom){LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,height);p.bottomMargin=bottom;return p;}
    private LinearLayout.LayoutParams weightedHeight(float weight,int height,int right){LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,height,weight);p.rightMargin=right;return p;}
    private GridLayout.LayoutParams gridCell(int margin){GridLayout.LayoutParams p=new GridLayout.LayoutParams();p.width=0;p.height=ViewGroup.LayoutParams.WRAP_CONTENT;p.columnSpec=GridLayout.spec(GridLayout.UNDEFINED,1f);p.setGravity(Gravity.FILL);p.setMargins(0,0,margin,margin);return p;}
    private GridLayout.LayoutParams calendarCell(int height,int margin){GridLayout.LayoutParams p=new GridLayout.LayoutParams();p.width=0;p.height=height;p.columnSpec=GridLayout.spec(GridLayout.UNDEFINED,1f);p.setGravity(Gravity.FILL);p.setMargins(0,0,margin,margin);return p;}
    private GridLayout.LayoutParams fullGridCell(int columns){GridLayout.LayoutParams p=new GridLayout.LayoutParams();p.width=0;p.columnSpec=GridLayout.spec(0,columns,1f);p.setGravity(Gravity.FILL);p.bottomMargin=dp(4);return p;}
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}

    private static final class LaunchEntry{
        final LauncherActivityInfo info;final String key;final long serial;
        LaunchEntry(LauncherActivityInfo info,String key,long serial){this.info=info;this.key=key;this.serial=serial;}
        String label(){return info.getLabel()==null?info.getComponentName().getPackageName():info.getLabel().toString();}
    }
    private static final class CollectionEntry{
        final String id,name;final HashSet<String> apps;
        CollectionEntry(String id,String name,HashSet<String> apps){this.id=id;this.name=name;this.apps=apps;}
    }
}
