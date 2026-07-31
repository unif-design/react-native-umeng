package com.unif.reactnativeumeng

import android.content.Context

internal enum class UmengBootstrapStage {
  NOT_STARTED,
  PRE_INITIALIZED,
  PLATFORMS_CONFIGURED,
  INITIALIZED,
  INDETERMINATE_FAILURE,
}

internal class UmengIndeterminateInitializationException(
  cause: Throwable,
) : RuntimeException(
    "Umeng initialization is indeterminate; restart is required",
    cause,
  ) {
  val restartRequired: Boolean = true
}

internal class UmengBootstrapStateMachine(
  private val adapter: UmengBootstrapAdapter,
  private val callbackComponentsFactory: (Context) -> UmengCallbackController,
) {
  private val lock = Any()
  private var acceptedConfig: UmengNativeConfig? = null
  private var terminalError: UmengIndeterminateInitializationException? = null

  @Volatile
  var stage: UmengBootstrapStage = UmengBootstrapStage.NOT_STARTED
    private set

  fun initialize(
    context: Context,
    config: UmengNativeConfig,
  ) {
    // 完整校验必须发生在保存 config 或触达任何第三方 API 之前。
    config.validate()

    synchronized(lock) {
      terminalError?.let { throw it }
      val existingConfig = acceptedConfig
      if (existingConfig != null && existingConfig != config) {
        throw IllegalStateException(
          "Umeng initialization config cannot change after initialization starts",
        )
      }
      if (stage == UmengBootstrapStage.INITIALIZED) return

      acceptedConfig = config
      runVendorCall {
        adapter.preInit(context, config)
      }
      stage = UmengBootstrapStage.PRE_INITIALIZED

      if (config.hasWechat) {
        runVendorCall {
          adapter.setWeixin(
            requireNotNull(config.wechatAppId),
            requireNotNull(config.wechatAppSecret),
          )
        }
      }
      if (config.hasDingTalk) {
        runVendorCall {
          adapter.setDing(requireNotNull(config.dingtalkAppId))
        }
      }
      runVendorCall {
        adapter.setFileProvider("${context.packageName}.fileprovider")
      }
      stage = UmengBootstrapStage.PLATFORMS_CONFIGURED

      runVendorCall {
        adapter.init(context, config)
      }

      // callback 仅在全部 vendor 调用返回后启用；组件状态异常同样需要重启恢复。
      runVendorCall {
        callbackComponentsFactory(context).enableConfigured(config)
      }
      stage = UmengBootstrapStage.INITIALIZED
    }
  }

  fun isInited(): Boolean = stage == UmengBootstrapStage.INITIALIZED

  private inline fun runVendorCall(call: () -> Unit) {
    try {
      call()
    } catch (throwable: Throwable) {
      val error = UmengIndeterminateInitializationException(throwable)
      terminalError = error
      stage = UmengBootstrapStage.INDETERMINATE_FAILURE
      throw error
    }
  }
}

object UmengBootstrap {
  private val stateMachine =
    UmengBootstrapStateMachine(
      adapter = ProductionUmengBootstrapAdapter(),
      callbackComponentsFactory = ::UmengCallbackComponents,
    )

  fun initialize(
    context: Context,
    config: UmengNativeConfig,
  ) {
    stateMachine.initialize(context, config)
  }

  fun isInited(): Boolean = stateMachine.isInited()
}
