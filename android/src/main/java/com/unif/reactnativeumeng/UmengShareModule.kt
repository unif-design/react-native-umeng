package com.unif.reactnativeumeng

import android.app.Activity
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule

internal data class UmengShareSuccess(
  val platform: String,
)

internal interface ShareUiDispatcher {
  fun isOnUiThread(): Boolean

  fun post(block: () -> Unit): Boolean
}

internal class AndroidShareUiDispatcher : ShareUiDispatcher {
  override fun isOnUiThread(): Boolean = Looper.myLooper() == Looper.getMainLooper()

  override fun post(block: () -> Unit): Boolean = Handler(Looper.getMainLooper()).post(block)
}

internal class UmengShareController<Host>(
  private val isInitialized: () -> Boolean,
  private val currentHost: () -> Host?,
  private val adapterFactory: (Host) -> UmengShareAdapter,
  private val uiDispatcher: ShareUiDispatcher,
  private val requests: ShareRequestRegistry = ShareRequestRegistry(),
  private val reportLifecycleError: (Throwable) -> Unit,
) {
  fun shareText(
    platform: String,
    text: String,
    promise: ShareRequestPromise,
  ) {
    startShare(platform, UmengSharePayload.Text(text), promise)
  }

  fun shareImage(
    platform: String,
    image: String,
    thumb: String?,
    promise: ShareRequestPromise,
  ) {
    startShare(platform, UmengSharePayload.Image(image, thumb), promise)
  }

  fun shareLink(
    platform: String,
    title: String,
    url: String,
    description: String?,
    thumb: String?,
    promise: ShareRequestPromise,
  ) {
    startShare(
      platform,
      UmengSharePayload.Link(title, url, description, thumb),
      promise,
    )
  }

  fun isInstalled(
    platform: String,
    promise: ShareRequestPromise,
  ) {
    val request = requests.register(promise)
    if (request.isSettled) return
    if (!requireInitialized(request)) return
    val mappedPlatform = mapPlatform(platform, request) ?: return
    val host = currentHost()
    if (host == null) {
      request.resolve(false)
      return
    }

    try {
      requests.withActiveInvocation(request) {
        request.resolve(adapterFactory(host).isInstalled(mappedPlatform))
      }
    } catch (error: Throwable) {
      request.reject(
        "E_UNKNOWN",
        error.message ?: "Failed to query platform installation state",
        error,
      )
    }
  }

  fun onActivityResult(
    host: Host,
    requestCode: Int,
    resultCode: Int,
    data: Intent?,
  ) {
    try {
      requests.withActiveInvocation {
        // 宿主回调也必须先 gate，不能为了“转发一下”提前取得 UMShareAPI。
        if (!isInitialized()) return@withActiveInvocation
        if (currentHost() != host) return@withActiveInvocation
        adapterFactory(host).onActivityResult(requestCode, resultCode, data)
      }
    } catch (error: Throwable) {
      // Activity listener 不能把第三方 SDK 异常抛回 React Native 生命周期。
      try {
        reportLifecycleError(error)
      } catch (_: Throwable) {
        // 诊断回调失败也不能替换原始 lifecycle 边界。
      }
    }
  }

  fun onHostDestroy(host: Host?) {
    requests.destroyHost(
      "E_SHARE_FAILED",
      "Host Activity was destroyed during share",
    ) {
      cleanupVendor(host)
    }
  }

  fun onHostResume() {
    requests.resumeHost {
      cleanupVendor(currentHost())
    }
  }

  fun invalidate(host: Host?) {
    requests.invalidate(
      "E_SHARE_FAILED",
      "Umeng share module was invalidated",
    ) {
      cleanupVendor(host)
    }
  }

  private fun startShare(
    platform: String,
    payload: UmengSharePayload,
    promise: ShareRequestPromise,
  ) {
    val request = requests.register(promise)
    if (request.isSettled) return
    if (!requireInitialized(request)) return
    val mappedPlatform = mapPlatform(platform, request) ?: return
    val host =
      currentHost() ?: run {
        request.reject(
          "E_UNKNOWN",
          "No current Activity; cannot invoke share",
          null,
        )
        return
      }

    runOnUi(request) {
      requests.withActiveInvocation(request) {
        adapterFactory(host).share(
          mappedPlatform,
          payload,
          callbackFor(platform, request),
        )
      }
    }
  }

  private fun runOnUi(
    request: ShareRequest,
    block: () -> Unit,
  ) {
    val runnable = {
      if (!request.isSettled) {
        try {
          block()
        } catch (error: Throwable) {
          request.reject(
            "E_SHARE_FAILED",
            error.message ?: "Failed to invoke share",
            error,
          )
        }
      }
    }

    try {
      if (uiDispatcher.isOnUiThread()) {
        runnable()
      } else if (!uiDispatcher.post(runnable)) {
        // Handler.post(false) 表示任务根本没有入队，必须同步 settle。
        request.reject(
          "E_SHARE_FAILED",
          "Failed to enqueue share on the main thread",
          null,
        )
      }
    } catch (error: Throwable) {
      request.reject(
        "E_SHARE_FAILED",
        error.message ?: "Failed to enqueue share on the main thread",
        error,
      )
    }
  }

  private fun callbackFor(
    platform: String,
    request: ShareRequest,
  ): UmengShareCallback =
    object : UmengShareCallback {
      override fun onSuccess() {
        request.resolve(UmengShareSuccess(platform))
      }

      override fun onFailure(error: Throwable?) {
        request.reject(
          "E_SHARE_FAILED",
          error?.message ?: "Share failed",
          error,
        )
      }

      override fun onCancel() {
        request.reject("E_USER_CANCEL", "User cancelled", null)
      }
    }

  private fun requireInitialized(request: ShareRequest): Boolean {
    if (isInitialized()) return true
    request.reject(
      "E_NOT_INITIALIZED",
      "Umeng must be initialized before sharing",
      null,
    )
    return false
  }

  private fun mapPlatform(
    platform: String,
    request: ShareRequest,
  ): UmengSharePlatform? =
    when (platform) {
      "wechat_session" -> {
        UmengSharePlatform.WECHAT_SESSION
      }

      "dingtalk" -> {
        UmengSharePlatform.DINGTALK
      }

      else -> {
        request.reject(
          "E_PLATFORM_NOT_SUPPORTED",
          "Platform '$platform' is not supported",
          null,
        )
        null
      }
    }

  private fun cleanupVendor(host: Host?): Boolean {
    if (!isInitialized()) return true
    if (host == null) return false
    adapterFactory(host).release()
    return true
  }
}

@ReactModule(name = UmengShareModule.NAME)
class UmengShareModule(
  reactContext: ReactApplicationContext,
) : NativeUmengShareSpec(reactContext),
  ActivityEventListener,
  LifecycleEventListener {
  private val controller =
    UmengShareController<Activity>(
      isInitialized = UmengBootstrap::isInited,
      currentHost = { currentActivity },
      adapterFactory = ::ProductionUmengShareAdapter,
      uiDispatcher = AndroidShareUiDispatcher(),
      reportLifecycleError = { error ->
        Log.e(NAME, "Failed to forward Umeng activity result", error)
      },
    )

  init {
    // 注册 React Native listener 不触达任何友盟 API。
    reactContext.addActivityEventListener(this)
    reactContext.addLifecycleEventListener(this)
  }

  override fun invalidate() {
    try {
      controller.invalidate(currentActivity)
    } finally {
      try {
        reactApplicationContext.removeActivityEventListener(this)
      } finally {
        try {
          reactApplicationContext.removeLifecycleEventListener(this)
        } finally {
          super.invalidate()
        }
      }
    }
  }

  override fun onActivityResult(
    activity: Activity,
    requestCode: Int,
    resultCode: Int,
    data: Intent?,
  ) {
    controller.onActivityResult(activity, requestCode, resultCode, data)
  }

  override fun onNewIntent(intent: Intent) = Unit

  override fun onHostResume() {
    controller.onHostResume()
  }

  override fun onHostPause() = Unit

  override fun onHostDestroy() {
    controller.onHostDestroy(currentActivity)
  }

  override fun getName(): String = NAME

  override fun shareText(
    platform: String,
    text: String,
    promise: Promise,
  ) {
    controller.shareText(platform, text, promise.asShareRequestPromise())
  }

  override fun shareImage(
    platform: String,
    image: String,
    thumb: String?,
    promise: Promise,
  ) {
    controller.shareImage(
      platform,
      image,
      thumb,
      promise.asShareRequestPromise(),
    )
  }

  override fun shareLink(
    platform: String,
    title: String,
    url: String,
    description: String?,
    thumb: String?,
    promise: Promise,
  ) {
    controller.shareLink(
      platform,
      title,
      url,
      description,
      thumb,
      promise.asShareRequestPromise(),
    )
  }

  override fun isInstalled(
    platform: String,
    promise: Promise,
  ) {
    controller.isInstalled(platform, promise.asShareRequestPromise())
  }

  private fun Promise.asShareRequestPromise(): ShareRequestPromise =
    object : ShareRequestPromise {
      override fun resolve(value: Any?) {
        if (value is UmengShareSuccess) {
          val result =
            Arguments.createMap().apply {
              putString("code", "success")
              putString("platform", value.platform)
            }
          this@asShareRequestPromise.resolve(result)
        } else {
          this@asShareRequestPromise.resolve(value)
        }
      }

      override fun reject(
        code: String,
        message: String,
        cause: Throwable?,
      ) {
        if (cause == null) {
          this@asShareRequestPromise.reject(code, message)
        } else {
          this@asShareRequestPromise.reject(code, message, cause)
        }
      }
    }

  companion object {
    const val NAME = "UmengShare"
  }
}
