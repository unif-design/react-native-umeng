package com.unif.reactnativeumeng

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule
import com.umeng.analytics.MobclickAgent

@ReactModule(name = UmengAnalyticsModule.NAME)
class UmengAnalyticsModule(reactContext: ReactApplicationContext) :
  NativeUmengAnalyticsSpec(reactContext) {

  init {
    UmengBootstrap.ensurePreInit(reactContext)
  }

  override fun getName(): String = NAME

  override fun onEvent(eventId: String, params: ReadableMap?) {
    // JS 端已 stringify 所有 value，这里 toHashMap 拿到 Map<String, Any>
    val map: MutableMap<String, Any> = params?.toHashMap()?.toMutableMap() ?: mutableMapOf()
    MobclickAgent.onEventObject(reactApplicationContext, eventId, map)
  }

  override fun signIn(userId: String, provider: String?) {
    if (provider.isNullOrEmpty()) {
      MobclickAgent.onProfileSignIn(userId)
    } else {
      // 友盟 API: onProfileSignIn(provider, ID) — provider 在前
      MobclickAgent.onProfileSignIn(provider, userId)
    }
  }

  override fun signOut() {
    MobclickAgent.onProfileSignOff()
  }

  companion object {
    const val NAME = "UmengAnalytics"
  }
}
