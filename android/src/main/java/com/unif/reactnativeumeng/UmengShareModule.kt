package com.unif.reactnativeumeng

import android.app.Activity
import com.facebook.react.bridge.Arguments
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
  NativeUmengShareSpec(reactContext) {

  init {
    UmengBootstrap.ensurePreInit(reactContext)
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
