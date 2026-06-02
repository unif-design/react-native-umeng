package com.unif.reactnativeumeng

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class ReactNativeUmengPackage : BaseReactPackage() {
  override fun getModule(
    name: String,
    reactContext: ReactApplicationContext,
  ): NativeModule? =
    when (name) {
      UmengCommonModule.NAME -> UmengCommonModule(reactContext)
      UmengShareModule.NAME -> UmengShareModule(reactContext)
      UmengAnalyticsModule.NAME -> UmengAnalyticsModule(reactContext)
      else -> null
    }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
    ReactModuleInfoProvider {
      mapOf(
        UmengCommonModule.NAME to
          ReactModuleInfo(
            UmengCommonModule.NAME,
            UmengCommonModule::class.java.name,
            false, // canOverrideExistingModule
            false, // needsEagerInit
            false, // isCxxModule
            true, // isTurboModule
          ),
        UmengShareModule.NAME to
          ReactModuleInfo(
            UmengShareModule.NAME,
            UmengShareModule::class.java.name,
            false,
            false,
            false,
            true,
          ),
        UmengAnalyticsModule.NAME to
          ReactModuleInfo(
            UmengAnalyticsModule.NAME,
            UmengAnalyticsModule::class.java.name,
            false,
            false,
            false,
            true,
          ),
      )
    }
}
