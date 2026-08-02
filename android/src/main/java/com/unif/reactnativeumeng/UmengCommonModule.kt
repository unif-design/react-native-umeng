package com.unif.reactnativeumeng

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = UmengCommonModule.NAME)
class UmengCommonModule(
  reactContext: ReactApplicationContext,
) : NativeUmengCommonSpec(reactContext) {
  override fun getName(): String = NAME

  override fun initialize(
    config: ReadableMap,
    promise: Promise,
  ) {
    try {
      UmengBootstrap.initialize(reactApplicationContext, config)
      promise.resolve(null)
    } catch (error: UmengIndeterminateInitializationException) {
      val metadata =
        Arguments.createMap().apply {
          putBoolean("restartRequired", error.restartRequired)
        }
      promise.reject(
        "E_UNKNOWN",
        error.message ?: "Umeng initialization failed",
        error,
        metadata,
      )
    } catch (error: IllegalArgumentException) {
      promise.reject(
        "E_INVALID_OPTIONS",
        error.message ?: "Invalid Umeng config",
        error,
      )
    } catch (error: IllegalStateException) {
      promise.reject(
        "E_INVALID_OPTIONS",
        error.message ?: "Umeng config cannot change",
        error,
      )
    } catch (throwable: Throwable) {
      promise.reject(
        "E_UNKNOWN",
        throwable.message ?: "Umeng initialization failed",
        throwable,
      )
    }
  }

  override fun isInited(promise: Promise) {
    promise.resolve(UmengBootstrap.isInited())
  }

  companion object {
    const val NAME = "UmengCommon"
  }
}
