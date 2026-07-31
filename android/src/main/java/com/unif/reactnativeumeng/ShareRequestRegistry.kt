package com.unif.reactnativeumeng

import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

internal interface ShareRequestPromise {
  fun resolve(value: Any?)

  fun reject(
    code: String,
    message: String,
    cause: Throwable?,
  )
}

internal class ShareRequestRegistry {
  private val lock = ReentrantLock()
  private val noInvocations = lock.newCondition()
  private val active = linkedSetOf<ShareRequest>()
  private var termination: ShareRequestTermination? = null
  private var inFlightInvocations = 0

  fun register(promise: ShareRequestPromise): ShareRequest {
    val request = ShareRequest(this, promise)
    val terminalState =
      lock.withLock {
        termination.also { state ->
          if (state == null) active += request
        }
      }
    terminalState?.let { state ->
      request.reject(state.code, state.message, null)
    }
    return request
  }

  fun withActiveInvocation(
    request: ShareRequest? = null,
    block: () -> Unit,
  ) {
    val terminalState =
      lock.withLock {
        // invocation 进入与 termination 关闭共用此线性化点，不能靠 Promise guard 代替。
        termination.also { state ->
          if (state == null) inFlightInvocations += 1
        }
      }
    if (terminalState != null) {
      request?.reject(terminalState.code, terminalState.message, null)
      return
    }

    try {
      block()
    } finally {
      lock.withLock {
        inFlightInvocations -= 1
        if (inFlightInvocations == 0) noInvocations.signalAll()
      }
    }
  }

  fun terminate(
    code: String,
    message: String,
    release: () -> Unit,
  ) {
    val snapshot =
      lock.withLock {
        if (termination != null) return
        // 先关入口再取 active snapshot，之后注册或 queued invocation 都只能失败。
        termination = ShareRequestTermination(code, message)
        active.toList().also { active.clear() }
      }
    snapshot.forEach { request ->
      request.reject(code, message, null)
    }

    lock.withLock {
      // 已进入的 vendor 调用可完成，但 release 必须在它们全部退出之后。
      while (inFlightInvocations > 0) {
        noInvocations.awaitUninterruptibly()
      }
    }

    try {
      release()
    } catch (_: Throwable) {
      // lifecycle cleanup 不能因 vendor release 失败而中断 RN listener/super 清理。
    }
  }

  internal fun remove(request: ShareRequest) {
    lock.withLock {
      active -= request
    }
  }
}

private data class ShareRequestTermination(
  val code: String,
  val message: String,
)

internal class ShareRequest(
  private val registry: ShareRequestRegistry,
  private val promise: ShareRequestPromise,
) {
  private val settled = AtomicBoolean(false)

  val isSettled: Boolean
    get() = settled.get()

  fun resolve(value: Any?): Boolean =
    settle {
      promise.resolve(value)
    }

  fun reject(
    code: String,
    message: String,
    cause: Throwable?,
  ): Boolean =
    settle {
      promise.reject(code, message, cause)
    }

  private inline fun settle(deliver: () -> Unit): Boolean {
    if (!settled.compareAndSet(false, true)) return false
    registry.remove(this)
    deliver()
    return true
  }
}
