package com.unif.reactnativeumeng

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.umeng.socialize.ShareAction
import com.umeng.socialize.UMShareAPI
import com.umeng.socialize.UMShareListener
import com.umeng.socialize.bean.SHARE_MEDIA
import com.umeng.socialize.media.UMImage
import com.umeng.socialize.media.UMWeb

@ReactModule(name = UmengShareModule.NAME)
class UmengShareModule(reactContext: ReactApplicationContext) :
  NativeUmengShareSpec(reactContext),
  ActivityEventListener,
  LifecycleEventListener {

  // PIPL: Module 构造期不调任何友盟 API。等 JS Common.init(config)
  // 触发 UmengBootstrap.ensureInit() 才会注册微信/钉钉平台。本 module 的
  // share* 方法依赖 PlatformConfig.setWeixin / setDing 已经调过 — 没 init
  // 时调 share* 会失败,JS 层应该在 init 之后才调 share。

  init {
    // 自动接管宿主 Activity 的 onActivityResult 回调,转发给 UMShareAPI。
    // 避免宿主 MainActivity 自己 override onActivityResult 手动转发。
    reactContext.addActivityEventListener(this)

    // 监听宿主 Activity 生命周期,onHostDestroy 时 release UMShareAPI 缓存
    // (友盟 UMShareAPI.get(activity) 按 activity 缓存 instance,如果不显式
    // release 而 Activity 销毁,会泄漏 Activity 引用)。
    // 这是 invalidate() 之外的兜底:invalidate 只在 catalyst instance
    // destroy 时调,但宿主 Activity 在 JS 不重启时也可能销毁。
    reactContext.addLifecycleEventListener(this)
  }

  override fun invalidate() {
    super.invalidate()
    reactApplicationContext.removeActivityEventListener(this)
    reactApplicationContext.removeLifecycleEventListener(this)
    currentActivity?.let { UMShareAPI.get(it).release() }
  }

  override fun onActivityResult(
    activity: Activity?,
    requestCode: Int,
    resultCode: Int,
    data: Intent?
  ) {
    activity?.let { UMShareAPI.get(it).onActivityResult(requestCode, resultCode, data) }
  }

  // ActivityEventListener 接口强制实现,我们不处理 onNewIntent (微信/钉钉
  // 回跳走 Activity result 路径,不走 newIntent)
  override fun onNewIntent(intent: Intent?) {}

  // ── LifecycleEventListener ────────────────────────────────

  override fun onHostResume() {}
  override fun onHostPause() {}
  override fun onHostDestroy() {
    // 宿主 Activity 销毁时同步 release,避免友盟 UMShareAPI 缓存持有
    // 已销毁 Activity 引用 (内存泄漏 / ActivityNotFoundException)
    currentActivity?.let { UMShareAPI.get(it).release() }
  }

  override fun getName(): String = NAME

  override fun shareText(platform: String, text: String, promise: Promise) {
    runOnUi {
      val activity = currentActivity ?: run {
        promise.reject("E_UNKNOWN", "No current Activity; cannot invoke share")
        return@runOnUi
      }
      val media = mapPlatform(platform, promise) ?: return@runOnUi
      ShareAction(activity)
        .withText(text)
        .setPlatform(media)
        .setCallback(buildListener(platform, promise))
        .share()
    }
  }

  override fun shareImage(platform: String, image: String, thumb: String?, promise: Promise) {
    runOnUi {
      val activity = currentActivity ?: run {
        promise.reject("E_UNKNOWN", "No current Activity; cannot invoke share")
        return@runOnUi
      }
      val media = mapPlatform(platform, promise) ?: return@runOnUi
      val img = UMImage(activity, image)
      if (!thumb.isNullOrEmpty()) img.setThumb(UMImage(activity, thumb))
      ShareAction(activity)
        .withMedia(img)
        .setPlatform(media)
        .setCallback(buildListener(platform, promise))
        .share()
    }
  }

  override fun shareLink(
    platform: String,
    title: String,
    url: String,
    description: String?,
    thumb: String?,
    promise: Promise
  ) {
    runOnUi {
      val activity = currentActivity ?: run {
        promise.reject("E_UNKNOWN", "No current Activity; cannot invoke share")
        return@runOnUi
      }
      val media = mapPlatform(platform, promise) ?: return@runOnUi
      val web = UMWeb(url)
      web.title = title
      if (!description.isNullOrEmpty()) web.description = description
      if (!thumb.isNullOrEmpty()) web.setThumb(UMImage(activity, thumb))
      ShareAction(activity)
        .withMedia(web)
        .setPlatform(media)
        .setCallback(buildListener(platform, promise))
        .share()
    }
  }

  override fun isInstalled(platform: String, promise: Promise) {
    val media = mapPlatform(platform, promise) ?: return
    val activity = currentActivity
    if (activity == null) {
      // 无 Activity 时友盟 isInstall 无法可靠判断，保守返回 false
      promise.resolve(false)
      return
    }
    promise.resolve(UMShareAPI.get(activity).isInstall(activity, media))
  }

  // ── helpers ──────────────────────────────────────────────

  private fun mapPlatform(p: String, promise: Promise): SHARE_MEDIA? {
    return when (p) {
      "wechat_session" -> SHARE_MEDIA.WEIXIN
      "dingtalk" -> SHARE_MEDIA.DINGTALK
      else -> {
        promise.reject("E_PLATFORM_NOT_SUPPORTED", "Platform '$p' is not supported")
        null
      }
    }
  }

  private fun runOnUi(block: () -> Unit) {
    val mainLooper = android.os.Looper.getMainLooper()
    if (android.os.Looper.myLooper() == mainLooper) block()
    else android.os.Handler(mainLooper).post(block)
  }

  private fun buildListener(platform: String, promise: Promise): UMShareListener {
    return object : UMShareListener {
      override fun onStart(p0: SHARE_MEDIA?) {}
      override fun onResult(p0: SHARE_MEDIA?) {
        val map = Arguments.createMap()
        map.putString("code", "success")
        map.putString("platform", platform)
        promise.resolve(map)
      }
      override fun onError(p0: SHARE_MEDIA?, t: Throwable?) {
        val map = Arguments.createMap()
        map.putString("code", "failed")
        map.putString("message", t?.message ?: "unknown error")
        map.putString("platform", platform)
        promise.resolve(map)
      }
      override fun onCancel(p0: SHARE_MEDIA?) {
        val map = Arguments.createMap()
        map.putString("code", "cancel")
        map.putString("platform", platform)
        promise.resolve(map)
      }
    }
  }

  companion object {
    const val NAME = "UmengShare"
  }
}
