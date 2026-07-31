package com.unif.reactnativeumeng

import android.content.pm.PackageManager
import org.junit.Assert.assertEquals
import org.junit.Test

class UmengCallbackComponentsTest {
  @Test
  fun `enableConfigured enables only callbacks for configured platforms`() {
    val writes = mutableListOf<ComponentStateWrite>()
    val components =
      UmengCallbackComponents(
        packageName = "com.example.app",
        stateWriter = ComponentStateWriter { writes += it },
      )

    components.enableConfigured(config.copy(dingtalkAppId = null))

    assertEquals(
      listOf(
        ComponentStateWrite(
          className = "com.example.app.wxapi.WXEntryActivity",
          newState = PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
          flags = PackageManager.DONT_KILL_APP,
        ),
      ),
      writes,
    )
  }

  @Test
  fun `enableConfigured enables both callbacks after both platforms are configured`() {
    val writes = mutableListOf<ComponentStateWrite>()
    val components =
      UmengCallbackComponents(
        packageName = "com.example.app",
        stateWriter = ComponentStateWriter { writes += it },
      )

    components.enableConfigured(config)

    assertEquals(
      listOf(
        ComponentStateWrite(
          className = "com.example.app.wxapi.WXEntryActivity",
          newState = PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
          flags = PackageManager.DONT_KILL_APP,
        ),
        ComponentStateWrite(
          className = "com.example.app.ddshare.DDShareActivity",
          newState = PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
          flags = PackageManager.DONT_KILL_APP,
        ),
      ),
      writes,
    )
  }

  @Test
  fun `disableAll disables both callbacks without killing the app`() {
    val writes = mutableListOf<ComponentStateWrite>()
    val components =
      UmengCallbackComponents(
        packageName = "com.example.app",
        stateWriter = ComponentStateWriter { writes += it },
      )

    components.disableAll()

    assertEquals(
      listOf(
        ComponentStateWrite(
          className = "com.example.app.wxapi.WXEntryActivity",
          newState = PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
          flags = PackageManager.DONT_KILL_APP,
        ),
        ComponentStateWrite(
          className = "com.example.app.ddshare.DDShareActivity",
          newState = PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
          flags = PackageManager.DONT_KILL_APP,
        ),
      ),
      writes,
    )
  }

  private companion object {
    val config =
      UmengNativeConfig(
        appkey = "app-key",
        channel = null,
        wechatAppId = "wechat-id",
        wechatAppSecret = "wechat-secret",
        wechatUniversalLink = null,
        dingtalkAppId = "ding-id",
      )
  }
}
