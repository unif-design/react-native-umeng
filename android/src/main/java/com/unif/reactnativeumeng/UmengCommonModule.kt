package com.unif.reactnativeumeng

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule

// 注：NativeUmengCommonSpec 由 RN codegen 在宿主 App build 时生成自 src/NativeUmengCommon.ts
@ReactModule(name = UmengCommonModule.NAME)
class UmengCommonModule(reactContext: ReactApplicationContext) :
  NativeUmengCommonSpec(reactContext) {

  init {
    // 任一 module 构造期调一次 preInit
    UmengBootstrap.ensurePreInit(reactContext)
  }

  override fun getName(): String = NAME

  override fun init(promise: Promise) {
    try {
      UmengBootstrap.ensureInit(reactApplicationContext)
      promise.resolve(null)
    } catch (t: Throwable) {
      promise.reject("E_UNKNOWN", t.message ?: "init failed", t)
    }
  }

  override fun isInited(promise: Promise) {
    promise.resolve(UmengBootstrap.isInited())
  }

  companion object {
    const val NAME = "UmengCommon"
  }
}
