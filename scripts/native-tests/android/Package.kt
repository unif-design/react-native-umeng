package com.facebook.react

import com.facebook.react.bridge.*
import com.facebook.react.module.model.*

abstract class BaseReactPackage {
  abstract fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule?

  abstract fun getReactModuleInfoProvider(): ReactModuleInfoProvider
}
