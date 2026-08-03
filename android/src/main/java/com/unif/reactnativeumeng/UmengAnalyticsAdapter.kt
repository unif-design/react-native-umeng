package com.unif.reactnativeumeng

import android.content.Context
import com.umeng.analytics.MobclickAgent

internal interface UmengAnalyticsAdapter {
  fun onEvent(
    eventId: String,
    params: Map<String, Any?>,
  )

  fun signIn(
    userId: String,
    provider: String?,
  )

  fun signOut()
}

/**
 * 只有 production adapter 知道友盟类型。构造函数只保存 Context，不触达 SDK。
 */
internal class ProductionUmengAnalyticsAdapter(
  context: Context,
) : UmengAnalyticsAdapter {
  private val applicationContext = context.applicationContext

  override fun onEvent(
    eventId: String,
    params: Map<String, Any?>,
  ) {
    MobclickAgent.onEventObject(applicationContext, eventId, params)
  }

  override fun signIn(
    userId: String,
    provider: String?,
  ) {
    if (provider.isNullOrEmpty()) {
      MobclickAgent.onProfileSignIn(userId)
    } else {
      // 友盟 API 的参数顺序是 provider 在前、userId 在后。
      MobclickAgent.onProfileSignIn(provider, userId)
    }
  }

  override fun signOut() {
    MobclickAgent.onProfileSignOff()
  }
}

internal class UmengAnalyticsController<Host>(
  private val isInitialized: () -> Boolean,
  private val adapterFactory: (Host) -> UmengAnalyticsAdapter,
) {
  fun onEvent(
    host: Host,
    eventId: String,
    params: Map<String, Any?>,
  ) {
    withInitializedAdapter(host) { adapter ->
      adapter.onEvent(eventId, params)
    }
  }

  fun signIn(
    host: Host,
    userId: String,
    provider: String?,
  ) {
    withInitializedAdapter(host) { adapter ->
      adapter.signIn(userId, provider)
    }
  }

  fun signOut(host: Host) {
    withInitializedAdapter(host, UmengAnalyticsAdapter::signOut)
  }

  private inline fun withInitializedAdapter(
    host: Host,
    call: (UmengAnalyticsAdapter) -> Unit,
  ) {
    // PIPL gate 必须早于 production adapter 的取得。
    if (!isInitialized()) return
    call(adapterFactory(host))
  }
}
