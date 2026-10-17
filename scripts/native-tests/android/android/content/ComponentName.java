package android.content;
public class ComponentName {
  public final String packageName;
  public final String className;
  public ComponentName(String p, String c) {
    packageName = p;
    className = c;
  }
}
