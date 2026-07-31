package com.unif.reactnativeumeng

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = UmengAnalyticsModule.NAME)
class UmengAnalyticsModule(
  reactContext: ReactApplicationContext,
) : NativeUmengAnalyticsSpec(reactContext) {
  private val controller =
    UmengAnalyticsController<ReactApplicationContext>(
      isInitialized = UmengBootstrap::isInited,
      adapterFactory = ::ProductionUmengAnalyticsAdapter,
    )

  override fun getName(): String = NAME

  override fun onEvent(
    eventId: String,
    params: ReadableMap?,
  ) {
    val map: Map<String, Any?> = params?.toHashMap() ?: emptyMap()
    controller.onEvent(reactApplicationContext, eventId, map)
  }

  override fun signIn(
    userId: String,
    provider: String?,
  ) {
    controller.signIn(reactApplicationContext, userId, provider)
  }

  override fun signOut() {
    controller.signOut(reactApplicationContext)
  }

  companion object {
    const val NAME = "UmengAnalytics"
  }
}
