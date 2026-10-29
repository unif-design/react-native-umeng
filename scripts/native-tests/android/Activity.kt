package android.app

import android.os.Bundle

open class Activity : android.content.Context() {
  var isChangingConfigurations = false
}

class Application : android.content.Context() {
  interface ActivityLifecycleCallbacks {
    fun onActivityCreated(activity: Activity, state: Bundle?)
    fun onActivityStarted(activity: Activity)
    fun onActivityResumed(activity: Activity)
    fun onActivityPaused(activity: Activity)
    fun onActivityStopped(activity: Activity)
    fun onActivitySaveInstanceState(activity: Activity, state: Bundle)
    fun onActivityDestroyed(activity: Activity)
  }
  val callbacks = linkedSetOf<ActivityLifecycleCallbacks>()
  fun registerActivityLifecycleCallbacks(callback: ActivityLifecycleCallbacks) { callbacks.add(callback) }
  fun unregisterActivityLifecycleCallbacks(callback: ActivityLifecycleCallbacks) { callbacks.remove(callback) }
}
