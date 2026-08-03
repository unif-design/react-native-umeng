package com.unif.reactnativeumeng

import org.junit.Assert.assertEquals
import org.junit.Test

class UmengAnalyticsModuleTest {
  @Test
  fun `analytics is a no-op before initialization without acquiring the adapter`() {
    val calls = mutableListOf<AnalyticsCall>()
    var adapterAcquisitions = 0
    val controller =
      UmengAnalyticsController<String>(
        isInitialized = { false },
        adapterFactory = {
          adapterAcquisitions += 1
          RecordingAnalyticsAdapter(calls)
        },
      )

    controller.onEvent("context", "checkout", mapOf("amount" to "12.50"))
    controller.signIn("context", "user-1", null)
    controller.signOut("context")

    assertEquals(0, adapterAcquisitions)
    assertEquals(emptyList<AnalyticsCall>(), calls)
  }

  @Test
  fun `analytics forwards exact arguments after initialization`() {
    val calls = mutableListOf<AnalyticsCall>()
    val controller =
      UmengAnalyticsController<String>(
        isInitialized = { true },
        adapterFactory = { RecordingAnalyticsAdapter(calls) },
      )

    controller.onEvent(
      "context",
      "checkout",
      linkedMapOf("amount" to "12.50", "currency" to "CNY"),
    )
    controller.signIn("context", "user-1", null)
    controller.signIn("context", "user-2", "wechat")
    controller.signOut("context")

    assertEquals(
      listOf(
        AnalyticsCall.Event(
          "checkout",
          linkedMapOf("amount" to "12.50", "currency" to "CNY"),
        ),
        AnalyticsCall.SignIn("user-1", null),
        AnalyticsCall.SignIn("user-2", "wechat"),
        AnalyticsCall.SignOut,
      ),
      calls,
    )
  }

  private sealed interface AnalyticsCall {
    data class Event(
      val eventId: String,
      val params: Map<String, Any?>,
    ) : AnalyticsCall

    data class SignIn(
      val userId: String,
      val provider: String?,
    ) : AnalyticsCall

    data object SignOut : AnalyticsCall
  }

  private class RecordingAnalyticsAdapter(
    private val calls: MutableList<AnalyticsCall>,
  ) : UmengAnalyticsAdapter {
    override fun onEvent(
      eventId: String,
      params: Map<String, Any?>,
    ) {
      calls += AnalyticsCall.Event(eventId, params)
    }

    override fun signIn(
      userId: String,
      provider: String?,
    ) {
      calls += AnalyticsCall.SignIn(userId, provider)
    }

    override fun signOut() {
      calls += AnalyticsCall.SignOut
    }
  }
}
