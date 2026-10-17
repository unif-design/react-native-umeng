package com.unif.reactnativeumeng

import com.facebook.react.bridge.*

abstract class NativeUmengCommonSpec(val reactApplicationContext: ReactApplicationContext) :
  NativeModule {
  abstract fun getName(): String

  abstract fun initialize(config: ReadableMap, promise: Promise)

  abstract fun isInited(promise: Promise)

  abstract fun getConfiguredShareTargets(promise: Promise)
}

abstract class NativeUmengAnalyticsSpec(val reactApplicationContext: ReactApplicationContext) :
  NativeModule {
  abstract fun getName(): String

  abstract fun onEvent(eventId: String, params: ReadableMap?)

  abstract fun signIn(userId: String, provider: String?)

  abstract fun signOut()
}

abstract class NativeUmengShareSpec(val reactApplicationContext: ReactApplicationContext) :
  NativeModule {
  var invalidated = false

  open fun invalidate() {
    invalidated = true
  }

  abstract fun getName(): String

  abstract fun shareText(platform: String, text: String, promise: Promise)

  abstract fun shareImage(platform: String, image: String, thumb: String?, promise: Promise)

  abstract fun shareLink(
    platform: String,
    title: String,
    url: String,
    description: String?,
    thumb: String?,
    promise: Promise,
  )

  abstract fun isInstalled(platform: String, promise: Promise)
}
