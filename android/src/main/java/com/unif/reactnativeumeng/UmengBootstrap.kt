package com.unif.reactnativeumeng

import android.content.Context
import com.umeng.commonsdk.UMConfigure
import com.umeng.socialize.PlatformConfig

/**
 * Umeng 初始化共享单例。
 *
 * preInit / setPlatform 在任一 TurboModule 构造期就跑（无差别、不上报）。
 * init 由 JS Common.init() 触发，必须在用户同意《隐私协议》后才能进。
 *
 * 配置 key 从宿主 App 的 AndroidManifest meta-data 读：
 *   - UMENG_APPKEY        必需
 *   - UMENG_CHANNEL       缺省 "default"
 *   - UMENG_WECHAT_APPID  + UMENG_WECHAT_APPSECRET  缺省 null 则跳过 setWeixin
 *   - UMENG_DINGTALK_APPID  缺省 null 则跳过 setDing
 */
object UmengBootstrap {
  @Volatile private var preInited = false
  @Volatile private var inited = false
  private val lock = Any()

  /** Module 构造期调用；多次调只执行一次。 */
  fun ensurePreInit(context: Context) {
    if (preInited) return
    synchronized(lock) {
      if (preInited) return
      val cfg = readConfig(context)
      UMConfigure.preInit(context.applicationContext, cfg.appkey, cfg.channel)
      preInited = true
    }
  }

  /** Common.init() 调用；多次调只执行一次。 */
  fun ensureInit(context: Context) {
    if (inited) return
    synchronized(lock) {
      if (inited) return
      ensurePreInit(context)
      val cfg = readConfig(context)
      UMConfigure.init(
        context.applicationContext,
        cfg.appkey,
        cfg.channel,
        UMConfigure.DEVICE_TYPE_PHONE,
        ""
      )
      if (cfg.wechatAppid != null && cfg.wechatSecret != null) {
        PlatformConfig.setWeixin(cfg.wechatAppid, cfg.wechatSecret)
      }
      if (cfg.dingtalkAppid != null) {
        PlatformConfig.setDing(cfg.dingtalkAppid)
      }
      PlatformConfig.setFileProvider(cfg.fileProvider)
      inited = true
    }
  }

  fun isInited(): Boolean = inited

  private data class Config(
    val appkey: String,
    val channel: String,
    val wechatAppid: String?,
    val wechatSecret: String?,
    val dingtalkAppid: String?,
    val fileProvider: String,
  )

  private fun readConfig(context: Context): Config {
    val app = context.applicationContext
    val ai = app.packageManager.getApplicationInfo(
      app.packageName,
      android.content.pm.PackageManager.GET_META_DATA
    )
    val md = ai.metaData ?: throw IllegalStateException(
      "AndroidManifest meta-data missing; expected UMENG_APPKEY etc."
    )
    val appkey = md.getString("UMENG_APPKEY")
      ?: throw IllegalStateException(
        "AndroidManifest meta-data UMENG_APPKEY is required"
      )
    return Config(
      appkey = appkey,
      channel = md.getString("UMENG_CHANNEL") ?: "default",
      wechatAppid = md.getString("UMENG_WECHAT_APPID"),
      wechatSecret = md.getString("UMENG_WECHAT_APPSECRET"),
      dingtalkAppid = md.getString("UMENG_DINGTALK_APPID"),
      fileProvider = "${app.packageName}.fileprovider",
    )
  }
}
