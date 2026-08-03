package com.unif.reactnativeumeng

import android.content.Context
import com.umeng.commonsdk.UMConfigure
import com.umeng.socialize.PlatformConfig

internal interface UmengBootstrapAdapter {
  fun preInit(
    context: Context,
    config: UmengNativeConfig,
  )

  fun setWeixin(
    appId: String,
    appSecret: String,
  )

  fun setDing(appId: String)

  fun setFileProvider(authority: String)

  fun init(
    context: Context,
    config: UmengNativeConfig,
  )
}

/**
 * 只有 production adapter 知道友盟类型，阶段机和测试只依赖本仓接口。
 * 构造函数不触发任何第三方调用。
 */
internal class ProductionUmengBootstrapAdapter : UmengBootstrapAdapter {
  override fun preInit(
    context: Context,
    config: UmengNativeConfig,
  ) {
    UMConfigure.preInit(
      context.applicationContext,
      config.appkey,
      config.channel ?: DEFAULT_CHANNEL,
    )
  }

  override fun setWeixin(
    appId: String,
    appSecret: String,
  ) {
    PlatformConfig.setWeixin(appId, appSecret)
  }

  override fun setDing(appId: String) {
    PlatformConfig.setDing(appId)
  }

  override fun setFileProvider(authority: String) {
    PlatformConfig.setFileProvider(authority)
  }

  override fun init(
    context: Context,
    config: UmengNativeConfig,
  ) {
    UMConfigure.init(
      context.applicationContext,
      config.appkey,
      config.channel ?: DEFAULT_CHANNEL,
      UMConfigure.DEVICE_TYPE_PHONE,
      "",
    )
  }

  private companion object {
    const val DEFAULT_CHANNEL = "default"
  }
}
