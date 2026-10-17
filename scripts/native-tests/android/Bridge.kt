package com.facebook.react.bridge
interface NativeModule

interface Promise {
  fun resolve(value: Any?)

  fun reject(code: String, message: String?)

  fun reject(code: String, message: String?, error: Throwable)

  fun reject(code: String, message: String?, error: Throwable, metadata: WritableMap)
}

interface ActivityEventListener {
  fun onActivityResult(
    activity: android.app.Activity,
    requestCode: Int,
    resultCode: Int,
    data: android.content.Intent?,
  )

  fun onNewIntent(intent: android.content.Intent)
}

interface LifecycleEventListener {
  fun onHostResume()

  fun onHostPause()

  fun onHostDestroy()
}

open class ReactApplicationContext : android.content.Context() {
  var currentActivity: android.app.Activity? = null
  val activities = linkedSetOf<ActivityEventListener>()
  val lifecycles = linkedSetOf<LifecycleEventListener>()

  fun addActivityEventListener(listener: ActivityEventListener) {
    activities.add(listener)
  }

  fun removeActivityEventListener(listener: ActivityEventListener) {
    activities.remove(listener)
  }

  fun addLifecycleEventListener(listener: LifecycleEventListener) {
    lifecycles.add(listener)
  }

  fun removeLifecycleEventListener(listener: LifecycleEventListener) {
    lifecycles.remove(listener)
  }
}

enum class ReadableType {
  Null,
  Boolean,
  Number,
  String,
  Map,
  Array,
}

interface ReadableMap {
  fun hasKey(key: String): Boolean

  fun isNull(key: String): Boolean

  fun getType(key: String): ReadableType

  fun getString(key: String): String?

  fun toHashMap(): HashMap<String, Any?>
}

open class JavaOnlyMap : ReadableMap {
  val entries = linkedMapOf<String, Any?>()

  override fun hasKey(key: String) = entries.containsKey(key)

  override fun isNull(key: String) = entries[key] == null

  override fun getType(key: String) =
    when (entries[key]) {
      null -> ReadableType.Null
      is String -> ReadableType.String
      is Boolean -> ReadableType.Boolean
      is Number -> ReadableType.Number
      else -> ReadableType.Map
    }

  override fun getString(key: String) = entries[key] as String?

  override fun toHashMap() = HashMap(entries)

  fun putString(key: String, value: String?) {
    entries[key] = value
  }

  fun putBoolean(key: String, value: Boolean) {
    entries[key] = value
  }

  fun putDouble(key: String, value: Double) {
    entries[key] = value
  }

  fun putNull(key: String) {
    entries[key] = null
  }
}

class WritableMap : JavaOnlyMap()

class WritableArray {
  val entries = mutableListOf<String>()

  fun pushString(value: String) {
    entries.add(value)
  }
}

object Arguments {
  fun createMap() = WritableMap()

  fun createArray() = WritableArray()
}
