package com.unif.reactnativeumeng

import android.content.Context
import android.test.mock.MockContext
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class UmengBootstrapTest {
  private val context: Context =
    object : MockContext() {
      override fun getPackageName(): String = "com.example.app"
    }

  @Test
  fun `construction does not call the vendor adapter`() {
    val calls = mutableListOf<String>()

    UmengBootstrapStateMachine(
      adapter = RecordingAdapter(calls),
      callbackComponentsFactory = { RecordingCallbacks(calls) },
    )

    assertEquals(emptyList<String>(), calls)
  }

  @Test
  fun `initialize executes the complete vendor sequence before callbacks`() {
    val calls = mutableListOf<String>()
    val bootstrap =
      UmengBootstrapStateMachine(
        adapter = RecordingAdapter(calls),
        callbackComponentsFactory = { RecordingCallbacks(calls) },
      )

    bootstrap.initialize(context, completeConfig)

    assertEquals(
      listOf(
        "preInit",
        "setWeixin",
        "setDing",
        "setFileProvider",
        "init",
        "enableCallbacks:wechat=true,ding=true",
      ),
      calls,
    )
    assertEquals(UmengBootstrapStage.INITIALIZED, bootstrap.stage)
    assertTrue(bootstrap.isInited())
  }

  @Test
  fun `same config is idempotent after initialization`() {
    val calls = mutableListOf<String>()
    val bootstrap =
      UmengBootstrapStateMachine(
        adapter = RecordingAdapter(calls),
        callbackComponentsFactory = { RecordingCallbacks(calls) },
      )

    bootstrap.initialize(context, completeConfig)
    bootstrap.initialize(context, completeConfig.copy())

    assertEquals(6, calls.size)
  }

  @Test
  fun `different config is rejected without another vendor call`() {
    val calls = mutableListOf<String>()
    val bootstrap =
      UmengBootstrapStateMachine(
        adapter = RecordingAdapter(calls),
        callbackComponentsFactory = { RecordingCallbacks(calls) },
      )
    bootstrap.initialize(context, completeConfig)

    val error =
      expectThrows<IllegalStateException> {
        bootstrap.initialize(context, completeConfig.copy(channel = "other"))
      }

    assertTrue(error.message.orEmpty().contains("cannot change"))
    assertEquals(6, calls.size)
  }

  @Test
  fun `invalid platform config fails before any vendor registration`() {
    val calls = mutableListOf<String>()
    val bootstrap =
      UmengBootstrapStateMachine(
        adapter = RecordingAdapter(calls),
        callbackComponentsFactory = { RecordingCallbacks(calls) },
      )

    expectThrows<IllegalArgumentException> {
      bootstrap.initialize(
        context,
        completeConfig.copy(wechatAppSecret = null),
      )
    }

    assertEquals(emptyList<String>(), calls)
    assertEquals(UmengBootstrapStage.NOT_STARTED, bootstrap.stage)
    assertFalse(bootstrap.isInited())
  }

  @Test
  fun `uncertain vendor failure becomes terminal and requires restart`() {
    val calls = mutableListOf<String>()
    val adapter = RecordingAdapter(calls, failAt = "setDing")
    val bootstrap =
      UmengBootstrapStateMachine(
        adapter = adapter,
        callbackComponentsFactory = { RecordingCallbacks(calls) },
      )

    val first =
      expectThrows<UmengIndeterminateInitializationException> {
        bootstrap.initialize(context, completeConfig)
      }
    val second =
      expectThrows<UmengIndeterminateInitializationException> {
        bootstrap.initialize(context, completeConfig)
      }

    assertTrue(first.restartRequired)
    assertSame(first, second)
    assertEquals(
      listOf("preInit", "setWeixin", "setDing"),
      calls,
    )
    assertEquals(UmengBootstrapStage.INDETERMINATE_FAILURE, bootstrap.stage)
    assertFalse(bootstrap.isInited())
  }

  @Test
  fun `initialization failure never enables callbacks`() {
    val calls = mutableListOf<String>()
    val bootstrap =
      UmengBootstrapStateMachine(
        adapter = RecordingAdapter(calls, failAt = "init"),
        callbackComponentsFactory = { RecordingCallbacks(calls) },
      )

    expectThrows<UmengIndeterminateInitializationException> {
      bootstrap.initialize(context, completeConfig)
    }

    assertEquals(
      listOf("preInit", "setWeixin", "setDing", "setFileProvider", "init"),
      calls,
    )
    assertFalse(calls.any { it.startsWith("enableCallbacks") })
  }

  @Test
  fun `only configured platform is registered and enabled`() {
    val calls = mutableListOf<String>()
    val bootstrap =
      UmengBootstrapStateMachine(
        adapter = RecordingAdapter(calls),
        callbackComponentsFactory = { RecordingCallbacks(calls) },
      )
    val wechatOnly = completeConfig.copy(dingtalkAppId = null)

    bootstrap.initialize(context, wechatOnly)

    assertEquals(
      listOf(
        "preInit",
        "setWeixin",
        "setFileProvider",
        "init",
        "enableCallbacks:wechat=true,ding=false",
      ),
      calls,
    )
  }

  @Test
  fun `callback activation failure is terminal and not initialized`() {
    val calls = mutableListOf<String>()
    val bootstrap =
      UmengBootstrapStateMachine(
        adapter = RecordingAdapter(calls),
        callbackComponentsFactory = { ThrowingCallbacks(calls) },
      )

    val error =
      expectThrows<UmengIndeterminateInitializationException> {
        bootstrap.initialize(context, completeConfig)
      }

    assertTrue(error.restartRequired)
    assertEquals(UmengBootstrapStage.INDETERMINATE_FAILURE, bootstrap.stage)
    assertFalse(bootstrap.isInited())
    assertEquals("enableCallbacks", calls.last())
  }

  private class RecordingAdapter(
    private val calls: MutableList<String>,
    private val failAt: String? = null,
  ) : UmengBootstrapAdapter {
    override fun preInit(
      context: Context,
      config: UmengNativeConfig,
    ) = record("preInit")

    override fun setWeixin(
      appId: String,
      appSecret: String,
    ) = record("setWeixin")

    override fun setDing(appId: String) = record("setDing")

    override fun setFileProvider(authority: String) = record("setFileProvider")

    override fun init(
      context: Context,
      config: UmengNativeConfig,
    ) = record("init")

    private fun record(call: String) {
      calls += call
      if (call == failAt) {
        error("uncertain $call failure")
      }
    }
  }

  private class RecordingCallbacks(
    private val calls: MutableList<String>,
  ) : UmengCallbackController {
    override fun enableConfigured(config: UmengNativeConfig) {
      calls +=
        "enableCallbacks:wechat=${config.hasWechat},ding=${config.hasDingTalk}"
    }

    override fun disableAll() = Unit
  }

  private class ThrowingCallbacks(
    private val calls: MutableList<String>,
  ) : UmengCallbackController {
    override fun enableConfigured(config: UmengNativeConfig) {
      calls += "enableCallbacks"
      error("component state is uncertain")
    }

    override fun disableAll() = Unit
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
    val completeConfig =
      UmengNativeConfig(
        appkey = "app-key",
        channel = "release",
        wechatAppId = "wechat-id",
        wechatAppSecret = "wechat-secret",
        wechatUniversalLink = "https://example.com/wechat/",
        dingtalkAppId = "ding-id",
      )
  }
}
