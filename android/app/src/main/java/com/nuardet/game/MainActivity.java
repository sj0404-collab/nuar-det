package com.nuardet.game;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

import androidx.webkit.WebViewCompat;

/**
 * Нуар-Дет оболочка: загружает игру с GitHub Pages и умеет само-обновляться,
 * сверяя version.json на Pages с локальной версией APK.
 */
public class MainActivity extends Activity {

    private static final String GAME_URL = "https://sj0404-collab.github.io/nuar-det/";
    private static final String VERSION_URL = GAME_URL + "version.json";
    private static final String APK_FILENAME = "nuar-det.apk";
    private static final int REQ_INSTALL = 1001;
    private static final String CHANNEL_ID = "nuar-det-update";

    private WebView web;
    private long lastDownloadId = -1;
    private boolean askedUpdate = false;
    private boolean isDownloading = false;
    private boolean pageReady = false;
    private String remoteVersion = "";

    private final BroadcastReceiver downloadReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context ctx, Intent intent) {
            long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
            if (id == lastDownloadId) {
                Cursor c = null;
                try {
                    DownloadManager dm = (DownloadManager) ctx.getSystemService(Context.DOWNLOAD_SERVICE);
                    c = dm.query(new DownloadManager.Query().setFilterById(id));
                    if (c != null && c.moveToFirst()) {
                        int st = c.getColumnIndex(DownloadManager.COLUMN_STATUS);
                        if (c.getInt(st) == DownloadManager.STATUS_SUCCESSFUL) {
                            int idx = c.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI);
                            Uri uri = Uri.parse(c.getString(idx));
                            File f = new File(uri.getPath());
                            File out = new File(ctx.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), APK_FILENAME);
                            out.getParentFile().mkdirs();
                            copy(f, out);
                            promptInstall(out);
                        }
                    }
                } catch (Throwable t) {
                    t.printStackTrace();
                } finally {
                    if (c != null) c.close();
                }
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        // рисуем под вырезом/жестовой полосой, отступы учитывает CSS env(safe-area-inset-*)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                    android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        hideSystemUi();

        web = new WebView(this);
        web.setBackgroundColor(0xFF05080D);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        CookieManager.getInstance().setAcceptCookie(true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    if (url.contains("github.com/sj0404-collab/nuar-det")
                            || url.contains("sj0404-collab.github.io/nuar-det")
                            || url.equals(GAME_URL)
                            || url.startsWith(GAME_URL)) {
                        return false; // keep in-app
                    }
                }
                try {
                    view.getContext().startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl()));
                } catch (Throwable ignored) {}
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pageReady = true;
                // проверяем обновления только когда игра уже загрузилась и
                // точно не блокируем титульный экран
                maybeCheckForUpdate();
            }
        });

        setContentView(web);
        web.loadUrl(GAME_URL);
        registerReceiver(downloadReceiver, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemUi();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    private void hideSystemUi() {
        View decor = getWindow().getDecorView();
        decor.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        try {
            unregisterReceiver(downloadReceiver);
        } catch (Throwable ignored) {}
        super.onDestroy();
    }

    // ---------------- auto-update ----------------

    /** Спрашивает про обновление, но только когда страница уже загружена. */
    private void maybeCheckForUpdate() {
        if (!pageReady || askedUpdate) return;
        new Thread(() -> {
            try {
                String json = fetch(VERSION_URL);
                JSONObject o = new JSONObject(json);
                String remote = o.optString("version", "");
                String apkUrl = o.optString("apk", "");
                String notes = o.optString("notes", "Доступно обновление.");
                String local = BuildConfig.VERSION_NAME;
                if (remote.isEmpty() || !isNewer(remote, local)) return;

                // не мучаем игрока одним и тем же предложением при каждом запуске
                String shown = getSharedPreferences("nuar", MODE_PRIVATE).getString("update_prompted", "");
                if (remote.equals(shown)) return;

                runOnUiThread(() -> new Handler(Looper.getMainLooper()).postDelayed(() -> {
                    if (askedUpdate) return;
                    showUpdateDialog(apkUrl, notes, remote);
                }, 4000));
            } catch (Throwable t) {
                // offline / first run — молча пропускаем
            }
        }).start();
    }

    private boolean isNewer(String remote, String local) {
        try {
            String[] r = remote.split("\\.");
            String[] l = local.split("\\.");
            int n = Math.max(r.length, l.length);
            for (int i = 0; i < n; i++) {
                int a = i < r.length ? Integer.parseInt(r[i]) : 0;
                int b = i < l.length ? Integer.parseInt(l[i]) : 0;
                if (a > b) return true;
                if (a < b) return false;
            }
        } catch (Throwable ignored) {}
        return false;
    }

    private void showUpdateDialog(String apkUrl, String notes, String version) {
        if (askedUpdate) return;
        askedUpdate = true;
        getSharedPreferences("nuar", MODE_PRIVATE).edit().putString("update_prompted", version).apply();
        String base = GAME_URL;
        String fullUrl = apkUrl.startsWith("http") ? apkUrl : base.replaceAll("/+$", "") + "/" + apkUrl.replaceAll("^/+", "");
        new AlertDialog.Builder(this)
                .setTitle("Доступно обновление")
                .setMessage(notes + "\n\nСкачать новую версию Нуар-Дет?")
                .setPositiveButton("Обновить", (d, w) -> downloadApk(fullUrl))
                .setNegativeButton("Позже", (d, w) -> {})
                .setOnCancelListener(d -> {})
                .show();
    }

    private void downloadApk(String url) {
        if (isDownloading) return;
        isDownloading = true;
        try {
            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
            req.setTitle("Нуар-Дет обновление");
            req.setDescription("Скачивание новой версии…");
            req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            req.setMimeType("application/vnd.android.package-archive");
            lastDownloadId = dm.enqueue(req);
        } catch (Throwable t) {
            t.printStackTrace();
            isDownloading = false;
        }
    }

    private void promptInstall(final File apk) {
        isDownloading = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getPackageManager().canRequestPackageInstalls()) {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getPackageName()));
            startActivityForResult(i, REQ_INSTALL);
            // повторная попытка после возврата
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> tryInstall(apk), 1200);
        } else {
            tryInstall(apk);
        }
    }

    private void tryInstall(File apk) {
        try {
            Uri uri = androidx.core.content.FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", apk);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Throwable t) {
            // смонтируем через DownloadManager URI
            try {
                Uri uri = Uri.fromFile(apk);
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(uri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (Throwable t2) {
                t2.printStackTrace();
            }
        }
    }

    private static String fetch(String urlStr) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(urlStr).openConnection();
        c.setConnectTimeout(8000);
        c.setReadTimeout(8000);
        c.setRequestProperty("User-Agent", "NuarDet-APK");
        InputStream in = c.getInputStream();
        BufferedReader r = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = r.readLine()) != null) sb.append(line);
        r.close();
        return sb.toString();
    }

    private static void copy(File from, File to) throws Exception {
        try (FileOutputStream fos = new FileOutputStream(to);
             InputStream in = new java.io.FileInputStream(from)) {
            byte[] buf = new byte[65536];
            int n;
            while ((n = in.read(buf)) > 0) fos.write(buf, 0, n);
        }
    }
}