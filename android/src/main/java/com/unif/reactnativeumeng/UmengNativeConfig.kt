package com.unif.reactnativeumeng

import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import java.net.URI

data class UmengNativeConfig(
  val appkey: String,
  val channel: String?,
  val wechatAppId: String?,
  val wechatAppSecret: String?,
  val wechatUniversalLink: String?,
  val dingtalkAppId: String?,
) {
  val hasWechat: Boolean
    get() = wechatAppId != null && wechatAppSecret != null

  val hasDingTalk: Boolean
    get() = dingtalkAppId != null

  internal fun validate() {
    require(appkey.isNotBlank()) { "`appkey` is required" }
    require(channel == null || channel.isNotBlank()) {
      "`channel` must not be empty"
    }
    require(wechatAppId == null || wechatAppId.isNotBlank()) {
      "`wechatAppId` must not be empty"
    }
    require(wechatAppSecret == null || wechatAppSecret.isNotBlank()) {
      "`wechatAppSecret` must not be empty"
    }
    require(wechatUniversalLink == null || wechatUniversalLink.isNotBlank()) {
      "`wechatUniversalLink` must not be empty"
    }
    require(dingtalkAppId == null || dingtalkAppId.isNotBlank()) {
      "`dingtalkAppId` must not be empty"
    }

    val hasAnyWechatField =
      wechatAppId != null ||
        wechatAppSecret != null ||
        wechatUniversalLink != null
    require(!hasAnyWechatField || hasWechat) {
      "`wechatAppId` and `wechatAppSecret` must be provided together"
    }

    if (wechatUniversalLink != null) {
      val uri =
        try {
          URI(wechatUniversalLink)
        } catch (_: Exception) {
          null
        }
      require(
        uri?.scheme.equals("https", ignoreCase = true) &&
          !uri?.host.isNullOrBlank(),
      ) {
        "`wechatUniversalLink` must be an absolute HTTPS URL with a host"
      }
    }
  }

  companion object {
    fun fromReadableMap(config: ReadableMap): UmengNativeConfig {
      val appkey =
        readString(config, "appkey", required = true)
          ?: throw IllegalArgumentException("`appkey` is required")
      val parsed =
        UmengNativeConfig(
          appkey = appkey,
          channel = readString(config, "channel"),
          wechatAppId = readString(config, "wechatAppId"),
          wechatAppSecret = readString(config, "wechatAppSecret"),
          wechatUniversalLink = readString(config, "wechatUniversalLink"),
          dingtalkAppId = readString(config, "dingtalkAppId"),
        )
      parsed.validate()
      return parsed
    }

    private fun readString(
      config: ReadableMap,
      key: String,
      required: Boolean = false,
    ): String? {
      if (!config.hasKey(key) || config.isNull(key)) {
        if (required) {
          throw IllegalArgumentException("`$key` is required")
        }
        return null
      }
      require(config.getType(key) == ReadableType.String) {
        "`$key` must be a string"
      }
      val value =
        config.getString(key)?.trim()
          ?: throw IllegalArgumentException("`$key` must be a string")
      require(value.isNotEmpty()) { "`$key` must not be empty" }
      return value
    }
  }
}
