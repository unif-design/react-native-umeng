package com.unif.reactnativeumeng

import com.facebook.react.bridge.JavaOnlyMap
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class UmengNativeConfigTest {
  @Test
  fun `explicit null optional fields are rejected`() {
    listOf(
      "channel",
      "wechatAppId",
      "wechatAppSecret",
      "wechatUniversalLink",
      "dingtalkAppId",
    ).forEach { key ->
      val config =
        JavaOnlyMap().apply {
          putString("appkey", "app-key")
          putNull(key)
        }

      val error =
        expectThrows<IllegalArgumentException> {
          UmengNativeConfig.fromReadableMap(config)
        }

      assertTrue(error.message.orEmpty().contains("`$key`"))
    }
  }

  private inline fun <reified T : Throwable> expectThrows(block: () -> Unit): T {
    try {
      block()
      fail("Expected ${T::class.java.simpleName}")
    } catch (error: Throwable) {
      if (error is T) return error
      throw error
    }
    error("unreachable")
  }
}
