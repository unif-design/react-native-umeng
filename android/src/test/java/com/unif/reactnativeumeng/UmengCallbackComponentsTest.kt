package com.unif.reactnativeumeng

import android.content.pm.PackageManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.fail
import org.junit.Test

class UmengCallbackComponentsTest {
  @Test
  fun `enableConfigured disables a persisted callback for an unconfigured platform`() {
    val writer =
      StatefulComponentWriter(
        initialStates =
          mapOf(
            WECHAT_ACTIVITY to PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
            DINGTALK_ACTIVITY to PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
          ),
      )
    val components =
      UmengCallbackComponents(
        packageName = "com.example.app",
        stateWriter = writer,
      )

    components.enableConfigured(config.copy(dingtalkAppId = null))

    assertEquals(
      PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
      writer.stateOf(WECHAT_ACTIVITY),
    )
    assertEquals(
      PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
      writer.stateOf(DINGTALK_ACTIVITY),
    )
    assertEquals(
      listOf(WECHAT_ACTIVITY, DINGTALK_ACTIVITY),
      writer.writes.map(ComponentStateWrite::className),
    )
  }

  @Test
  fun `enableConfigured enables both callbacks after both platforms are configured`() {
    val writer = StatefulComponentWriter()
    val components =
      UmengCallbackComponents(
        packageName = "com.example.app",
        stateWriter = writer,
      )

    components.enableConfigured(config)

    assertEquals(
      PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
      writer.stateOf(WECHAT_ACTIVITY),
    )
    assertEquals(
      PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
      writer.stateOf(DINGTALK_ACTIVITY),
    )
    assertEquals(
      listOf(PackageManager.DONT_KILL_APP, PackageManager.DONT_KILL_APP),
      writer.writes.map(ComponentStateWrite::flags),
    )
  }

  @Test
  fun `disableAll disables both callbacks without killing the app`() {
    val writer =
      StatefulComponentWriter(
        initialStates =
          mapOf(
            WECHAT_ACTIVITY to PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
            DINGTALK_ACTIVITY to PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
          ),
      )
    val components =
      UmengCallbackComponents(
        packageName = "com.example.app",
        stateWriter = writer,
      )

    components.disableAll()

    assertEquals(
      PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
      writer.stateOf(WECHAT_ACTIVITY),
    )
    assertEquals(
      PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
      writer.stateOf(DINGTALK_ACTIVITY),
    )
    assertEquals(
      listOf(PackageManager.DONT_KILL_APP, PackageManager.DONT_KILL_APP),
      writer.writes.map(ComponentStateWrite::flags),
    )
  }

  @Test
  fun `second enable failure rolls back the first enabled callback`() {
    val originalFailure = IllegalStateException("DingTalk enable failed")
    val writer =
      StatefulComponentWriter(
        failureFor = { write ->
          originalFailure.takeIf {
            write.className == DINGTALK_ACTIVITY &&
              write.newState == PackageManager.COMPONENT_ENABLED_STATE_ENABLED
          }
        },
      )
    val components =
      UmengCallbackComponents(
        packageName = "com.example.app",
        stateWriter = writer,
      )

    val thrown =
      expectThrows<IllegalStateException> {
        components.enableConfigured(config)
      }

    assertSame(originalFailure, thrown)
    assertEquals(
      PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
      writer.stateOf(WECHAT_ACTIVITY),
    )
    assertEquals(
      PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
      writer.stateOf(DINGTALK_ACTIVITY),
    )
    assertEquals(
      listOf(
        WECHAT_ACTIVITY to PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
        DINGTALK_ACTIVITY to PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
        WECHAT_ACTIVITY to PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
        DINGTALK_ACTIVITY to PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
      ),
      writer.writes.map { it.className to it.newState },
    )
  }

  @Test
  fun `rollback keeps the original failure and attempts every disable`() {
    val originalFailure = IllegalStateException("DingTalk enable failed")
    val rollbackFailure = IllegalStateException("WeChat disable failed")
    val writer =
      StatefulComponentWriter(
        failureFor = { write ->
          when {
            write.className == DINGTALK_ACTIVITY &&
              write.newState == PackageManager.COMPONENT_ENABLED_STATE_ENABLED ->
              originalFailure
            write.className == WECHAT_ACTIVITY &&
              write.newState == PackageManager.COMPONENT_ENABLED_STATE_DISABLED ->
              rollbackFailure
            else -> null
          }
        },
      )
    val components =
      UmengCallbackComponents(
        packageName = "com.example.app",
        stateWriter = writer,
      )

    val thrown =
      expectThrows<IllegalStateException> {
        components.enableConfigured(config)
      }

    assertSame(originalFailure, thrown)
    assertEquals(listOf(rollbackFailure), thrown.suppressed.toList())
    assertEquals(
      PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
      writer.stateOf(DINGTALK_ACTIVITY),
    )
    assertEquals(
      DINGTALK_ACTIVITY to PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
      writer.writes.last().let { it.className to it.newState },
    )
  }

  private class StatefulComponentWriter(
    initialStates: Map<String, Int> = emptyMap(),
    private val failureFor: (ComponentStateWrite) -> Throwable? = { null },
  ) : ComponentStateWriter {
    val writes = mutableListOf<ComponentStateWrite>()
    private val states = initialStates.toMutableMap()

    override fun write(state: ComponentStateWrite) {
      writes += state
      failureFor(state)?.let { throw it }
      states[state.className] = state.newState
    }

    fun stateOf(className: String): Int =
      states[className] ?: PackageManager.COMPONENT_ENABLED_STATE_DEFAULT
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

  private companion object {
    const val WECHAT_ACTIVITY = "com.example.app.wxapi.WXEntryActivity"
    const val DINGTALK_ACTIVITY = "com.example.app.ddshare.DDShareActivity"

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
