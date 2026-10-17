package com.unif.reactnativeumeng

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ShareRequestRegistryTest {
  @Test
  fun `settled and invalidated requests never reenter the vendor`() {
    val registry = ShareRequestRegistry()
    val promise = RecordingPromise()
    val request = registry.register(promise)
    assertTrue(request.resolve("done"))

    registry.withActiveInvocation(request) { error("settled request invoked vendor") }
    registry.invalidate("closed", "invalidated") { true }
    registry.withActiveInvocation(request) { error("invalidated request invoked vendor") }
    registry.withActiveInvocation { error("invalidated callback invoked vendor") }

    assertEquals(listOf("done"), promise.settlements)
    assertFalse(request.reject("late", "late callback", null))
  }

  @Test
  fun `nested vendor invocation leaves its outer invocation active until return`() {
    val registry = ShareRequestRegistry()
    val events = mutableListOf<String>()

    registry.withActiveInvocation {
      events += "outer started"
      registry.withActiveInvocation { events += "inner returned" }
      events += "outer returned"
    }
    registry.invalidate("closed", "invalidated") {
      events += "cleanup"
      true
    }

    assertEquals(listOf("outer started", "inner returned", "outer returned", "cleanup"), events)
  }

  @Test
  fun `duplicate destroy and invalidation do not repeat successful cleanup`() {
    val registry = ShareRequestRegistry()
    var cleanups = 0

    registry.destroyHost("closed", "destroyed") {
      cleanups++
      true
    }
    registry.destroyHost("closed", "destroyed again") { error("duplicate cleanup") }
    registry.invalidate("final", "invalidated") { error("already cleaned") }
    registry.invalidate("final", "invalidated again") { error("duplicate invalidation") }

    assertEquals(1, cleanups)
    val promise = RecordingPromise()
    registry.register(promise)
    assertEquals(listOf("final"), promise.settlements)
  }

  @Test
  fun `permanent invalidation during failing teardown retries cleanup once and stays final`() {
    for (retrySucceeded in listOf(false, true)) {
      val registry = ShareRequestRegistry()
      var cleanups = 0
      registry.destroyHost("closed", "destroyed") {
        cleanups++
        registry.invalidate("final", "invalidated") {
          cleanups++
          retrySucceeded
        }
        false
      }

      registry.resumeHost { error("permanent invalidation must not resume") }
      val promise = RecordingPromise()
      registry.register(promise)

      assertEquals(2, cleanups)
      assertEquals(listOf("final"), promise.settlements)
    }
  }

  private class RecordingPromise : ShareRequestPromise {
    val settlements = mutableListOf<Any?>()

    override fun resolve(value: Any?) {
      settlements += value
    }

    override fun reject(code: String, message: String, cause: Throwable?) {
      settlements += code
    }
  }
}
