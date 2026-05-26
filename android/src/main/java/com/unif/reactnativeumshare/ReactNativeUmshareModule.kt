package com.unif.reactnativeumshare

import com.facebook.react.bridge.ReactApplicationContext

class ReactNativeUmshareModule(reactContext: ReactApplicationContext) :
  NativeReactNativeUmshareSpec(reactContext) {

  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = NativeReactNativeUmshareSpec.NAME
  }
}
