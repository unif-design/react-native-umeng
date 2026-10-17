package android.content;
public class Context {
  public String getPackageName() { return "com.example.umeng"; }
  public Context getApplicationContext() { return this; }
  public android.content.pm.PackageManager getPackageManager() { return manager; }
  public final android.content.pm.PackageManager manager = new android.content.pm.PackageManager();
}
