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
  private var state = ShareLifecycleState.ACTIVE
  private var generation = 0L
  private var terminalFailure: ShareRequestFailure? = null
  private var inFlightInvocations = 0
  private var cleanupPending = false
  private var resumeRequested = false
  private var resumeCleanup: (() -> Boolean)? = null
  private var permanentCleanup: (() -> Boolean)? = null

  fun register(promise: ShareRequestPromise): ShareRequest {
    val registration =
      lock.withLock {
        val request = ShareRequest(this, promise, generation)
        ShareRequestRegistration(
          request = request,
          failure =
            if (state == ShareLifecycleState.ACTIVE) {
              active += request
              null
            } else {
              checkNotNull(terminalFailure)
            },
        )
      }
    registration.failure?.let { failure ->
      registration.request.reject(failure.code, failure.message, null)
    }
    return registration.request
  }

  fun withActiveInvocation(
    request: ShareRequest? = null,
    block: () -> Unit,
  ) {
    val admission =
      lock.withLock {
        when {
          state != ShareLifecycleState.ACTIVE -> {
            ShareInvocationAdmission(
              admitted = false,
              failure = checkNotNull(terminalFailure),
            )
          }

          request != null && (request.isSettled || request.generation != generation) -> {
            ShareInvocationAdmission(admitted = false, failure = null)
          }

          else -> {
            inFlightInvocations += 1
            ShareInvocationAdmission(admitted = true, failure = null)
          }
        }
      }
    if (!admission.admitted) {
      admission.failure?.let { failure ->
        request?.reject(failure.code, failure.message, null)
      }
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

  fun destroyHost(
    code: String,
    message: String,
    cleanup: () -> Boolean,
  ) {
    val failure = ShareRequestFailure(code, message)
    val snapshot =
      lock.withLock {
        if (state != ShareLifecycleState.ACTIVE) return
        // host teardown 先关本代入口；只有 cleanup 完成后的 resume 才能开下一代。
        state = ShareLifecycleState.HOST_TEARING_DOWN
        terminalFailure = failure
        cleanupPending = true
        active.toList().also { active.clear() }
      }
    snapshot.forEach { request ->
      request.reject(code, message, null)
    }

    awaitInvocations()
    finishHostTeardown(attemptCleanup(cleanup))
  }

  fun resumeHost(cleanup: () -> Boolean) {
    val shouldCleanup =
      lock.withLock {
        when (state) {
          ShareLifecycleState.ACTIVE,
          ShareLifecycleState.PERMANENT_INVALIDATED,
          -> {
            return
          }

          ShareLifecycleState.HOST_TEARING_DOWN -> {
            resumeRequested = true
            resumeCleanup = cleanup
            return
          }

          ShareLifecycleState.HOST_DESTROYED -> {
            if (!cleanupPending) {
              reopen()
              return
            }
            state = ShareLifecycleState.HOST_TEARING_DOWN
            resumeRequested = true
            resumeCleanup = null
            true
          }
        }
      }

    if (shouldCleanup) {
      finishHostTeardown(attemptCleanup(cleanup))
    }
  }

  fun invalidate(
    code: String,
    message: String,
    cleanup: () -> Boolean,
  ) {
    val failure = ShareRequestFailure(code, message)
    val transition =
      lock.withLock {
        when (state) {
          ShareLifecycleState.PERMANENT_INVALIDATED -> {
            return
          }

          ShareLifecycleState.HOST_TEARING_DOWN -> {
            // 永久终态在线性化点立即压过 pending resume，由 teardown owner 收尾 cleanup。
            state = ShareLifecycleState.PERMANENT_INVALIDATED
            terminalFailure = failure
            resumeRequested = false
            resumeCleanup = null
            permanentCleanup = cleanup
            return
          }

          ShareLifecycleState.HOST_DESTROYED -> {
            state = ShareLifecycleState.PERMANENT_INVALIDATED
            terminalFailure = failure
            val shouldCleanup = cleanupPending
            ShareInvalidationTransition(emptyList(), shouldCleanup)
          }

          ShareLifecycleState.ACTIVE -> {
            state = ShareLifecycleState.PERMANENT_INVALIDATED
            terminalFailure = failure
            cleanupPending = true
            ShareInvalidationTransition(
              active.toList().also { active.clear() },
              shouldCleanup = true,
            )
          }
        }
      }
    transition.requests.forEach { request ->
      request.reject(code, message, null)
    }
    if (!transition.shouldCleanup) return

    awaitInvocations()
    val cleaned = attemptCleanup(cleanup)
    lock.withLock {
      cleanupPending = !cleaned
    }
  }

  internal fun remove(request: ShareRequest) {
    lock.withLock {
      active -= request
    }
  }

  private fun finishHostTeardown(initialCleanupSucceeded: Boolean) {
    var cleanupSucceeded = initialCleanupSucceeded
    while (true) {
      val nextCleanup =
        lock.withLock {
          cleanupPending = !cleanupSucceeded
          when (state) {
            ShareLifecycleState.PERMANENT_INVALIDATED -> {
              if (!cleanupPending) {
                permanentCleanup = null
                return
              }
              permanentCleanup.also { permanentCleanup = null } ?: return
            }

            ShareLifecycleState.HOST_TEARING_DOWN -> {
              when {
                !resumeRequested -> {
                  state = ShareLifecycleState.HOST_DESTROYED
                  return
                }

                !cleanupPending -> {
                  reopen()
                  return
                }

                else -> {
                  resumeCleanup.also { resumeCleanup = null } ?: run {
                    resumeRequested = false
                    state = ShareLifecycleState.HOST_DESTROYED
                    return
                  }
                }
              }
            }

            ShareLifecycleState.ACTIVE,
            ShareLifecycleState.HOST_DESTROYED,
            -> {
              return
            }
          }
        }
      cleanupSucceeded = attemptCleanup(nextCleanup)
    }
  }

  private fun awaitInvocations() {
    lock.withLock {
      // 已进入的 vendor 调用可完成，但 cleanup 必须在它们全部退出之后。
      while (inFlightInvocations > 0) {
        noInvocations.awaitUninterruptibly()
      }
    }
  }

  private fun attemptCleanup(cleanup: () -> Boolean): Boolean =
    try {
      cleanup()
    } catch (_: Throwable) {
      // lifecycle cleanup 不能因 vendor release 失败而中断 RN listener/super 清理。
      false
    }

  private fun reopen() {
    generation += 1
    state = ShareLifecycleState.ACTIVE
    terminalFailure = null
    cleanupPending = false
    resumeRequested = false
    resumeCleanup = null
    permanentCleanup = null
  }
}

private enum class ShareLifecycleState {
  ACTIVE,
  HOST_TEARING_DOWN,
  HOST_DESTROYED,
  PERMANENT_INVALIDATED,
}

private data class ShareRequestFailure(
  val code: String,
  val message: String,
)

private data class ShareRequestRegistration(
  val request: ShareRequest,
  val failure: ShareRequestFailure?,
)

private data class ShareInvocationAdmission(
  val admitted: Boolean,
  val failure: ShareRequestFailure?,
)

private data class ShareInvalidationTransition(
  val requests: List<ShareRequest>,
  val shouldCleanup: Boolean,
)

internal class ShareRequest(
  private val registry: ShareRequestRegistry,
  private val promise: ShareRequestPromise,
  internal val generation: Long,
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
