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
    stateWriter =
      ComponentStateWriter { state ->
        context.packageManager.setComponentEnabledSetting(
          ComponentName(context.packageName, state.className),
          state.newState,
          state.flags,
        )
      },
  )

  override fun enableConfigured(config: UmengNativeConfig) {
    try {
      write(WECHAT_ACTIVITY_SUFFIX, desiredState(config.hasWechat))
      write(DINGTALK_ACTIVITY_SUFFIX, desiredState(config.hasDingTalk))
    } catch (failure: Throwable) {
      try {
        disableAll()
      } catch (rollbackFailure: Throwable) {
        addSuppressedSafely(failure, rollbackFailure)
      }
      throw failure
    }
  }

  /**
   * 撤回同意时复用同一入口禁用回调组件；DONT_KILL_APP 后仍要求业务安排重启，
   * 避免已加载的第三方进程状态继续留在内存中。
   */
  override fun disableAll() {
    var firstFailure: Throwable? = null
    for (activitySuffix in listOf(WECHAT_ACTIVITY_SUFFIX, DINGTALK_ACTIVITY_SUFFIX)) {
      try {
        write(activitySuffix, PackageManager.COMPONENT_ENABLED_STATE_DISABLED)
      } catch (failure: Throwable) {
        if (firstFailure == null) {
          firstFailure = failure
        } else {
          addSuppressedSafely(requireNotNull(firstFailure), failure)
        }
      }
    }
    firstFailure?.let { throw it }
  }

  private fun desiredState(configured: Boolean): Int =
    if (configured) {
      PackageManager.COMPONENT_ENABLED_STATE_ENABLED
    } else {
      PackageManager.COMPONENT_ENABLED_STATE_DISABLED
    }

  private fun addSuppressedSafely(
    original: Throwable,
    secondary: Throwable,
  ) {
    if (original === secondary) return
    try {
      original.addSuppressed(secondary)
    } catch (_: Throwable) {
      // 保留原始失败优先于补充诊断，不能让 rollback 覆盖初始化根因。
    }
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
