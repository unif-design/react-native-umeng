package com.unif.reactnativeumeng

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager

internal data class ComponentStateWrite(
  val className: String,
  val newState: Int,
  val flags: Int,
)

internal fun interface ComponentStateWriter {
  fun write(state: ComponentStateWrite)
}

internal interface UmengCallbackController {
  fun enableConfigured(config: UmengNativeConfig)

  fun disableAll()
}

internal class UmengCallbackComponents internal constructor(
  private val packageName: String,
  private val stateWriter: ComponentStateWriter,
) : UmengCallbackController {
  constructor(context: Context) : this(
    packageName = context.packageName,
    stateWriter = ComponentStateWriter { state ->
      context.packageManager.setComponentEnabledSetting(
        ComponentName(context.packageName, state.className),
        state.newState,
        state.flags,
      )
    },
  )

  override fun enableConfigured(config: UmengNativeConfig) {
    if (config.hasWechat) {
      write(WECHAT_ACTIVITY_SUFFIX, PackageManager.COMPONENT_ENABLED_STATE_ENABLED)
    }
    if (config.hasDingTalk) {
      write(DINGTALK_ACTIVITY_SUFFIX, PackageManager.COMPONENT_ENABLED_STATE_ENABLED)
    }
  }

  /**
   * 撤回同意时复用同一入口禁用回调组件；DONT_KILL_APP 后仍要求业务安排重启，
   * 避免已加载的第三方进程状态继续留在内存中。
   */
  override fun disableAll() {
    write(WECHAT_ACTIVITY_SUFFIX, PackageManager.COMPONENT_ENABLED_STATE_DISABLED)
    write(DINGTALK_ACTIVITY_SUFFIX, PackageManager.COMPONENT_ENABLED_STATE_DISABLED)
  }

  private fun write(
    classNameSuffix: String,
    state: Int,
  ) {
    stateWriter.write(
      ComponentStateWrite(
        className = "$packageName$classNameSuffix",
        newState = state,
        flags = PackageManager.DONT_KILL_APP,
      ),
    )
  }

  private companion object {
    const val WECHAT_ACTIVITY_SUFFIX = ".wxapi.WXEntryActivity"
    const val DINGTALK_ACTIVITY_SUFFIX = ".ddshare.DDShareActivity"
  }
}
