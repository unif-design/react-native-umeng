package com.unif.reactnativeumeng

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule
import com.umeng.analytics.MobclickAgent

@ReactModule(name = UmengAnalyticsModule.NAME)
class UmengAnalyticsModule(reactContext: ReactApplicationContext) :
  NativeUmengAnalyticsSpec(reactContext) {

  // PIPL: Module 构造期不调任何友盟 API。等 JS Common.init(config)
  // 触发 UmengBootstrap.ensureInit() 才会激活友盟。本 module 的 onEvent /
  // signIn / signOut 在 init 之前调是 no-op 安全的 (MobclickAgent 未 init
  // 状态下静默吞调用)。

  override fun getName(): String = NAME

  override fun onEvent(eventId: String, params: ReadableMap?) {
    // ReadableMap.toHashMap() 在 RN 0.85 返回 HashMap<String, Any?>(value 可空)。
    // 友盟 MobclickAgent.onEventObject 是 Java Map<String, Object>,接受 Any?。
    // JS 层 src/analytics.ts onEvent 已经 stringify 了所有 value(num→string),
    // 实际 null 不会进来,但类型上保留 Any? 才能编过。
    val map: MutableMap<String, Any?> = params?.toHashMap()?.toMutableMap() ?: mutableMapOf()
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
