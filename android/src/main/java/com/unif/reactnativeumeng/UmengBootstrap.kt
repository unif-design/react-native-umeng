package com.unif.reactnativeumeng

import android.content.Context
import com.facebook.react.bridge.ReadableMap
import com.umeng.commonsdk.UMConfigure
import com.umeng.socialize.PlatformConfig

/**
 * Umeng 初始化共享单例。两步初始化(对齐友盟官方推荐):
 *   1. ensurePreInit(context, config) — App 启动后立刻调,可在 user 同意
 *      《隐私协议》之前。调 `UMConfigure.preInit` + `PlatformConfig.setWeixin
 *      / setDing` 注册微信/钉钉平台,**不上报数据**。
 *   2. ensureInit(context) — user 同意后调,调 `UMConfigure.init` 真正开始
 *      统计 + 上报。`ensurePreInit` 必须先调过。
 *
 * config 字段:
 *   - appkey (String,必填)
 *   - channel (String,可选,默认 "default")
 *   - wechatAppId (String,可选) + wechatAppSecret (String,可选)
 *   - dingtalkAppId (String,可选)
 */
object UmengBootstrap {
  @Volatile private var preInited = false

  @Volatile private var inited = false
  private val lock = Any()

  // 缓存 preInit 时传的 appkey + channel,init 时用
  @Volatile private var appkey: String? = null

  @Volatile private var channel: String = "default"

  /**
   * 预初始化:友盟 SDK preInit + 微信/钉钉平台 setPlatform。**不上报**。
   * idempotent — 重复调只执行一次。
   *
   * @throws IllegalArgumentException 当 appkey 缺失或为空
   */
  fun ensurePreInit(
    context: Context,
    config: ReadableMap,
  ) {
    if (preInited) return
    synchronized(lock) {
      if (preInited) return

      val ak = config.getStringOrNull("appkey")
      require(!ak.isNullOrEmpty()) {
        "`appkey` is required for Common.preInit"
      }

      val ch = config.getStringOrNull("channel") ?: "default"
      val wxId = config.getStringOrNull("wechatAppId")
      val wxSecret = config.getStringOrNull("wechatAppSecret")
      val ddId = config.getStringOrNull("dingtalkAppId")

      val app = context.applicationContext
      appkey = ak
      channel = ch

      UMConfigure.preInit(app, ak, ch)

      // PlatformConfig.setWeixin/setDing 只写 SDK 内部静态 dict[platform→appKey/secret],
      // 无网络/上报副作用(友盟官方:平台密钥配置非个人信息采集),preInit 阶段(同意前)调合规。
      if (!wxId.isNullOrEmpty() && !wxSecret.isNullOrEmpty()) {
        PlatformConfig.setWeixin(wxId, wxSecret)
      }
      if (!ddId.isNullOrEmpty()) {
        PlatformConfig.setDing(ddId)
      }
      // 友盟图片分享(本地图)需要 FileProvider authority,固定按宿主包名 + .fileprovider
      PlatformConfig.setFileProvider("${app.packageName}.fileprovider")

      preInited = true
    }
  }

  /**
   * 正式初始化:友盟 SDK init 开始上报。idempotent — 重复调只执行一次。
   *
   * @throws IllegalStateException 当 ensurePreInit 没调过
   */
  fun ensureInit(context: Context) {
    if (inited) return
    synchronized(lock) {
      if (inited) return
      check(preInited) {
        "`Common.preInit(config)` must be called before `Common.init()`"
      }

      val ak = appkey
      requireNotNull(ak) { "appkey lost between preInit and init" }

      UMConfigure.init(
        context.applicationContext,
        ak,
        channel,
        UMConfigure.DEVICE_TYPE_PHONE,
        "",
      )

      inited = true
    }
  }

  fun isInited(): Boolean = inited

  private fun ReadableMap.getStringOrNull(key: String): String? = if (hasKey(key) && !isNull(key)) getString(key) else null
}
