package com.unif.reactnativeumeng

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule

// 注:NativeUmengCommonSpec 由 RN codegen 在宿主 App build 时生成自
// src/NativeUmengCommon.ts。signature: preInit(config: Object): Promise<void>
//                                     init(): Promise<void>
@ReactModule(name = UmengCommonModule.NAME)
class UmengCommonModule(reactContext: ReactApplicationContext) :
  NativeUmengCommonSpec(reactContext) {

  // PIPL 合规:Module 构造期不调任何友盟 API。等 JS Common.preInit(config)
  // 触发,把 appkey 等配置传过来才开始 preInit。user 同意后再调 Common.init()
  // 真正开始上报。

  override fun getName(): String = NAME

  override fun preInit(config: ReadableMap, promise: Promise) {
    try {
      UmengBootstrap.ensurePreInit(reactApplicationContext, config)
      promise.resolve(null)
    } catch (e: IllegalArgumentException) {
      promise.reject("E_INVALID_OPTIONS", e.message ?: "invalid config", e)
    } catch (t: Throwable) {
      promise.reject("E_UNKNOWN", t.message ?: "preInit failed", t)
    }
  }

  override fun init(promise: Promise) {
    try {
      UmengBootstrap.ensureInit(reactApplicationContext)
      promise.resolve(null)
    } catch (e: IllegalStateException) {
      // preInit 没调过
      promise.reject("E_INVALID_OPTIONS", e.message ?: "preInit required", e)
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
