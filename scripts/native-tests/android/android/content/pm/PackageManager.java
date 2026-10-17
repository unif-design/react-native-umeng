package android.content.pm;
import android.content.ComponentName;
import java.util.*;
public class PackageManager {
  public static final int COMPONENT_ENABLED_STATE_DEFAULT = 0, COMPONENT_ENABLED_STATE_ENABLED = 1,
                          COMPONENT_ENABLED_STATE_DISABLED = 2, DONT_KILL_APP = 1;
  public final List<String> writes = new ArrayList<>();
  public void setComponentEnabledSetting(ComponentName c, int s, int f) { writes.add(c.className + ":" + s + ":" + f); }
}