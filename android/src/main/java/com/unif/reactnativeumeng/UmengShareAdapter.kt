package com.unif.reactnativeumeng

import android.app.Activity
import android.content.Intent
import com.umeng.socialize.ShareAction
import com.umeng.socialize.UMShareAPI
import com.umeng.socialize.UMShareListener
import com.umeng.socialize.bean.SHARE_MEDIA
import com.umeng.socialize.media.UMImage
import com.umeng.socialize.media.UMWeb

internal enum class UmengSharePlatform {
  WECHAT_SESSION,
  DINGTALK,
}

internal sealed interface UmengSharePayload {
  data class Text(
    val text: String,
  ) : UmengSharePayload

  data class Image(
    val image: String,
    val thumb: String?,
  ) : UmengSharePayload

  data class Link(
    val title: String,
    val url: String,
    val description: String?,
    val thumb: String?,
  ) : UmengSharePayload
}

internal interface UmengShareCallback {
  fun onSuccess()

  fun onFailure(error: Throwable?)

  fun onCancel()
}

internal interface UmengShareAdapter {
  fun share(
    platform: UmengSharePlatform,
    payload: UmengSharePayload,
    callback: UmengShareCallback,
  )

  fun isInstalled(platform: UmengSharePlatform): Boolean

  fun onActivityResult(
    requestCode: Int,
    resultCode: Int,
    data: Intent?,
  )

  fun release()
}

/**
 * 构造函数只保存 Activity；UMShareAPI 与 ShareAction 均在 gate 后的方法内取得。
 */
internal class ProductionUmengShareAdapter(
  private val activity: Activity,
) : UmengShareAdapter {
  override fun share(
    platform: UmengSharePlatform,
    payload: UmengSharePayload,
    callback: UmengShareCallback,
  ) {
    val action = ShareAction(activity)
    when (payload) {
      is UmengSharePayload.Text -> {
        action.withText(payload.text)
      }

      is UmengSharePayload.Image -> {
        val image = UMImage(activity, payload.image)
        payload.thumb?.let { image.setThumb(UMImage(activity, it)) }
        action.withMedia(image)
      }

      is UmengSharePayload.Link -> {
        val web = UMWeb(payload.url)
        web.title = payload.title
        payload.description?.let { web.description = it }
        payload.thumb?.let { web.setThumb(UMImage(activity, it)) }
        action.withMedia(web)
      }
    }

    action
      .setPlatform(platform.toVendorPlatform())
      .setCallback(callback.toVendorCallback())
      .share()
  }

  override fun isInstalled(platform: UmengSharePlatform): Boolean =
    UMShareAPI
      .get(activity)
      .isInstall(activity, platform.toVendorPlatform())

  override fun onActivityResult(
    requestCode: Int,
    resultCode: Int,
    data: Intent?,
  ) {
    UMShareAPI.get(activity).onActivityResult(requestCode, resultCode, data)
  }

  override fun release() {
    UMShareAPI.get(activity).release()
  }

  private fun UmengSharePlatform.toVendorPlatform(): SHARE_MEDIA =
    when (this) {
      UmengSharePlatform.WECHAT_SESSION -> SHARE_MEDIA.WEIXIN
      UmengSharePlatform.DINGTALK -> SHARE_MEDIA.DINGTALK
    }

  private fun UmengShareCallback.toVendorCallback(): UMShareListener {
    val callback = this
    return object : UMShareListener {
      override fun onStart(platform: SHARE_MEDIA?) = Unit

      override fun onResult(platform: SHARE_MEDIA?) {
        callback.onSuccess()
      }

      override fun onError(
        platform: SHARE_MEDIA?,
        error: Throwable?,
      ) {
        callback.onFailure(error)
      }

      override fun onCancel(platform: SHARE_MEDIA?) {
        callback.onCancel()
      }
    }
  }
}
