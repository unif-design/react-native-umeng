package com.unif.reactnativeumeng

import java.util.concurrent.atomic.AtomicBoolean

internal interface ShareRequestPromise {
  fun resolve(value: Any?)

  fun reject(
    code: String,
    message: String,
    cause: Throwable?,
  )
}

internal class ShareRequestRegistry {
  private val lock = Any()
  private val active = linkedSetOf<ShareRequest>()

  fun register(promise: ShareRequestPromise): ShareRequest {
    val request = ShareRequest(this, promise)
    synchronized(lock) {
      active += request
    }
    return request
  }

  fun rejectAll(
    code: String,
    message: String,
  ) {
    val snapshot =
      synchronized(lock) {
        active.toList().also { active.clear() }
      }
    snapshot.forEach { request ->
      request.reject(code, message, null)
    }
  }

  internal fun remove(request: ShareRequest) {
    synchronized(lock) {
      active -= request
    }
  }
}

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
