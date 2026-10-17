package com.umeng.socialize

import android.app.Activity
import android.content.Intent
import com.umeng.socialize.bean.SHARE_MEDIA

object PlatformConfig {
  val calls = mutableListOf<List<String>>()

  fun setWeixin(id: String, secret: String) {
    calls.add(listOf("wechat", id, secret))
  }

  fun setDing(id: String) {
    calls.add(listOf("ding", id))
  }

  fun setFileProvider(authority: String) {
    calls.add(listOf("file", authority))
  }
}

interface UMShareListener {
  fun onStart(platform: SHARE_MEDIA?)

  fun onResult(platform: SHARE_MEDIA?)

  fun onError(platform: SHARE_MEDIA?, error: Throwable?)

  fun onCancel(platform: SHARE_MEDIA?)
}

class ShareAction(val activity: Activity) {
  var text: String? = null
  var media: Any? = null
  var platform: SHARE_MEDIA? = null
  var callback: UMShareListener? = null

  fun withText(value: String): ShareAction {
    text = value
    return this
  }

  fun withMedia(value: Any): ShareAction {
    media = value
    return this
  }

  fun setPlatform(value: SHARE_MEDIA): ShareAction {
    platform = value
    return this
  }

  fun setCallback(value: UMShareListener): ShareAction {
    callback = value
    return this
  }

  fun share() {
    actions.add(this)
    failure?.let { throw it }
  }

  companion object {
    val actions = mutableListOf<ShareAction>()
    var failure: Throwable? = null
  }
}

class UMShareAPI {
  var installed = true
  var failure: Throwable? = null
  var releases = 0
  val results = mutableListOf<List<Any?>>()

  fun isInstall(activity: Activity, platform: SHARE_MEDIA): Boolean {
    failure?.let { throw it }
    return installed
  }

  fun onActivityResult(request: Int, result: Int, data: Intent?) {
    failure?.let { throw it }
    results.add(listOf(request, result, data))
  }

  fun release() {
    releases++
    failure?.let { throw it }
  }

  companion object {
    val instance = UMShareAPI()

    fun get(activity: Activity) = instance
  }
}
