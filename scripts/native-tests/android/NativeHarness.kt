package com.unif.reactnativeumeng

import android.app.Activity
import android.content.Intent
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.*
import com.umeng.analytics.MobclickAgent
import com.umeng.commonsdk.UMConfigure
import com.umeng.socialize.*
import com.umeng.socialize.bean.SHARE_MEDIA
import com.umeng.socialize.media.*

private class CapturedPromise : Promise {
  var resolved: Any? = Unit
  var code: String? = null
  var message: String? = null
  var metadata: WritableMap? = null
  var count = 0

  override fun resolve(value: Any?) {
    resolved = value
    count++
  }

  override fun reject(code: String, message: String?) {
    this.code = code
    this.message = message
    count++
  }

  override fun reject(code: String, message: String?, error: Throwable) {
    reject(code, message)
  }

  override fun reject(code: String, message: String?, error: Throwable, metadata: WritableMap) {
    this.metadata = metadata
    reject(code, message)
  }
}

private fun config() =
  JavaOnlyMap().apply {
    putString("appkey", "app")
    putString("wechatAppId", "wx")
    putString("wechatAppSecret", "secret")
    putString("dingtalkAppId", "ding")
  }

private fun expectInvalid(block: () -> Unit) {
  try {
    block()
    error("Expected invalid input")
  } catch (expected: IllegalArgumentException) {
    check(expected.message != null)
  }
}

private fun invalidConfigCoverage() {
  val valid = UmengNativeConfig("app", null, null, null, null, null)
  for (input in
    listOf(
      valid.copy(appkey = " "),
      valid.copy(channel = ""),
      valid.copy(wechatAppId = ""),
      valid.copy(wechatAppSecret = ""),
      valid.copy(wechatUniversalLink = ""),
      valid.copy(dingtalkAppId = ""),
      valid.copy(wechatAppSecret = "secret"),
      valid.copy(wechatUniversalLink = "https://example.com"),
    )) expectInvalid { input.validate() }
  for (url in listOf("https://[", "https:/path", "http://example.com", "https://")) expectInvalid {
    valid.copy(wechatAppId = "wx", wechatAppSecret = "secret", wechatUniversalLink = url).validate()
  }
  val accepted =
    valid.copy(
      wechatAppId = "wx",
      wechatAppSecret = "secret",
      wechatUniversalLink = "HTTPS://example.com/path",
      channel = "channel",
      dingtalkAppId = "ding",
    )
  accepted.validate()
  check(accepted.hasWechat && accepted.hasDingTalk)
  expectInvalid { UmengNativeConfig.fromReadableMap(JavaOnlyMap()) }
  expectInvalid { UmengNativeConfig.fromReadableMap(JavaOnlyMap().apply { putNull("appkey") }) }
  expectInvalid {
    UmengNativeConfig.fromReadableMap(JavaOnlyMap().apply { putDouble("appkey", 4.0) })
  }
  expectInvalid {
    UmengNativeConfig.fromReadableMap(JavaOnlyMap().apply { putString("appkey", " ") })
  }
  expectInvalid {
    UmengNativeConfig.fromReadableMap(
      object : JavaOnlyMap() {
        override fun hasKey(key: String) = true

        override fun isNull(key: String) = false

        override fun getType(key: String) = ReadableType.String

        override fun getString(key: String): String? = null
      }
    )
  }
  val parsed =
    UmengNativeConfig.fromReadableMap(
      config().apply {
        putString("channel", "  channel  ")
        putString("wechatUniversalLink", "https://example.com")
      }
    )
  check(parsed.channel == "channel" && parsed.wechatUniversalLink == "https://example.com")
}

fun main(args: Array<String>) {
  val context = ReactApplicationContext()
  val common = UmengCommonModule(context)
  if (args.firstOrNull() == "terminal") {
    UMConfigure.failure = IllegalStateException("vendor failed")
    val p = CapturedPromise()
    common.initialize(config(), p)
    check(p.code == "E_UNKNOWN" && p.metadata?.entries?.get("restartRequired") == true)
    val again = CapturedPromise()
    common.initialize(JavaOnlyMap(), again)
    check(again.code == "E_UNKNOWN")
    return
  }
  invalidConfigCoverage()
  for (error in
    listOf(
      IllegalArgumentException(),
      IllegalArgumentException("bad"),
      IllegalStateException(),
      IllegalStateException("locked"),
      RuntimeException(),
      RuntimeException("bridge failure"),
    )) {
    val map =
      object : JavaOnlyMap() {
        override fun hasKey(key: String): Boolean = throw error
      }
    val p = CapturedPromise()
    common.initialize(map, p)
    check(p.count == 1 && p.code != null && !p.message.isNullOrEmpty())
  }
  val missing = CapturedPromise()
  common.initialize(JavaOnlyMap(), missing)
  check(missing.code == "E_INVALID_OPTIONS")
  val unready = CapturedPromise()
  common.isInited(unready)
  check(unready.resolved == false)
  val unavailable = CapturedPromise()
  common.getConfiguredShareTargets(unavailable)
  check(unavailable.code == "E_NOT_INITIALIZED")
  val analytics = UmengAnalyticsModule(context)
  analytics.onEvent("before", null)
  analytics.signIn("before", null)
  analytics.signOut()
  check(MobclickAgent.calls.isEmpty())
  val packageEntry = ReactNativeUmengPackage()
  val names = listOf("UmengCommon", "UmengShare", "UmengAnalytics")
  check(packageEntry.getModule("missing", context) == null)
  check(names.all { packageEntry.getModule(it, context) != null })
  val info = packageEntry.getReactModuleInfoProvider().getReactModuleInfos()
  check(
    info.keys == names.toSet() &&
      info.values.all { it.isTurboModule && !it.needsEagerInit && !it.isCxxModule }
  )
  check(common.getName() == "UmengCommon" && analytics.getName() == "UmengAnalytics")
  val ready = CapturedPromise()
  common.initialize(config(), ready)
  check(ready.count == 1 && ready.code == null)
  val repeated = CapturedPromise()
  common.initialize(config(), repeated)
  check(repeated.count == 1)
  val locked = CapturedPromise()
  common.initialize(config().apply { putString("channel", "other") }, locked)
  check(locked.code == "E_CONFIGURATION_LOCKED")
  val state = CapturedPromise()
  common.isInited(state)
  check(state.resolved == true)
  val targets = CapturedPromise()
  common.getConfiguredShareTargets(targets)
  check((targets.resolved as WritableArray).entries == listOf("wechat_session", "dingtalk"))
  check(context.manager.writes.map { it.substringAfterLast(':') } == listOf("1", "1"))
  val adapter = ProductionUmengBootstrapAdapter()
  val nativeConfig = UmengNativeConfig.fromReadableMap(config())
  adapter.preInit(context, nativeConfig)
  adapter.init(context, nativeConfig)
  adapter.preInit(context, nativeConfig.copy(channel = "custom"))
  adapter.init(context, nativeConfig.copy(channel = "custom"))
  check(UMConfigure.calls.takeLast(2).all { it[3] == "custom" })
  analytics.onEvent("empty", null)
  analytics.onEvent("purchase", JavaOnlyMap().apply { putString("currency", "CNY") })
  analytics.signIn("u1", null)
  analytics.signIn("u2", "")
  analytics.signIn("u3", "wechat")
  analytics.signOut()
  check(
    MobclickAgent.calls.takeLast(4) ==
      listOf(
        listOf("user", "u1"),
        listOf("user", "u2"),
        listOf("user", "wechat", "u3"),
        listOf("clear"),
      )
  )
  val activity = Activity()
  context.currentActivity = activity
  val share = UmengShareModule(context)
  check(share.getName() == "UmengShare")
  val text = CapturedPromise()
  share.shareText("wechat_session", "hello", text)
  val textAction = ShareAction.actions.last()
  check(textAction.text == "hello" && textAction.platform == SHARE_MEDIA.WEIXIN)
  textAction.callback!!.onStart(null)
  textAction.callback!!.onResult(null)
  check(
    (text.resolved as WritableMap).entries ==
      mapOf("code" to "success", "platform" to "wechat_session")
  )
  textAction.callback!!.onCancel(null)
  check(text.count == 1)
  for (thumb in listOf(null, "https://image/thumb")) {
    val p = CapturedPromise()
    share.shareImage("dingtalk", "https://image/full", thumb, p)
    val action = ShareAction.actions.last()
    val image = action.media as UMImage
    check(
      image.url == "https://image/full" &&
        image.thumbnail?.url == thumb &&
        action.platform == SHARE_MEDIA.DINGTALK
    )
    action.callback!!.onCancel(null)
    check(p.code == "E_USER_CANCEL")
  }
  for (value in listOf(null, "description")) {
    val p = CapturedPromise()
    share.shareLink("wechat_session", "title", "https://target", value, value, p)
    val action = ShareAction.actions.last()
    val web = action.media as UMWeb
    check(
      web.title == "title" &&
        web.url == "https://target" &&
        web.description == value &&
        web.thumbnail?.url == value
    )
    action.callback!!.onError(null, RuntimeException(value))
    check(p.code == "E_SHARE_FAILED")
  }
  val noError = CapturedPromise()
  share.shareText("wechat_session", "x", noError)
  ShareAction.actions.last().callback!!.onError(null, null)
  check(noError.message == "Share failed")
  for (installed in listOf(false, true)) {
    UMShareAPI.instance.installed = installed
    val p = CapturedPromise()
    share.isInstalled("dingtalk", p)
    check(p.resolved == installed)
  }
  for (error in listOf(RuntimeException(), RuntimeException("query"))) {
    UMShareAPI.instance.failure = error
    val p = CapturedPromise()
    share.isInstalled("wechat_session", p)
    check(p.code == "E_UNKNOWN")
  }
  UMShareAPI.instance.failure = null
  val bad = CapturedPromise()
  share.shareText("unknown", "x", bad)
  check(bad.code == "E_PLATFORM_NOT_SUPPORTED")
  val badQuery = CapturedPromise()
  share.isInstalled("unknown", badQuery)
  check(badQuery.code == "E_PLATFORM_NOT_SUPPORTED")
  context.currentActivity = null
  val noHost = CapturedPromise()
  share.shareText("wechat_session", "x", noHost)
  check(noHost.code == "E_UNAVAILABLE")
  val noQueryHost = CapturedPromise()
  share.isInstalled("wechat_session", noQueryHost)
  check(noQueryHost.code == "E_UNAVAILABLE")
  context.currentActivity = activity
  val intent = Intent()
  share.onActivityResult(activity, 11, 12, intent)
  check(UMShareAPI.instance.results.last() == listOf(11, 12, intent))
  UMShareAPI.instance.failure = RuntimeException("result")
  share.onActivityResult(activity, 1, 2, null)
  check(android.util.Log.failures.size == 1)
  UMShareAPI.instance.failure = null
  share.onNewIntent(intent)
  share.onHostPause()
  share.onHostResume()
  Looper.current = null
  Handler.accept = false
  val rejected = CapturedPromise()
  share.shareText("wechat_session", "x", rejected)
  check(rejected.code == "E_SHARE_FAILED")
  Handler.accept = true
  val queued = CapturedPromise()
  share.shareText("wechat_session", "queued", queued)
  check(queued.count == 0)
  Handler.drain()
  ShareAction.actions.last().callback!!.onResult(null)
  check(queued.count == 1)
  Looper.current = Looper.main
  share.onHostDestroy()
  share.onHostResume()
  val pending = CapturedPromise()
  share.shareText("wechat_session", "late", pending)
  share.invalidate()
  check(
    pending.code == "E_SHARE_FAILED" &&
      share.invalidated &&
      !context.activities.contains(share) &&
      !context.lifecycles.contains(share)
  )
  val after = CapturedPromise()
  share.isInstalled("dingtalk", after)
  check(after.code == "E_SHARE_FAILED")
  share.invalidate()
  println("Production bridges and SDK payload/settlement/lifecycle contracts passed")
}
