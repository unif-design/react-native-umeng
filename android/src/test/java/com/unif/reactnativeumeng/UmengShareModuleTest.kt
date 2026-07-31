package com.unif.reactnativeumeng

import android.content.Intent
import org.junit.Assert.assertEquals
import org.junit.Assert.fail
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

class UmengShareModuleTest {
  @Test
  fun `share entry points reject before initialization without acquiring the adapter`() {
    val adapter = RecordingShareAdapter()
    var adapterAcquisitions = 0
    val controller =
      controller(
        initialized = false,
        adapter = adapter,
        onAdapterAcquired = { adapterAcquisitions += 1 },
      )
    val promises = List(4) { RecordingPromise() }

    controller.shareText("wechat_session", "hello", promises[0])
    controller.shareImage(
      "dingtalk",
      "https://example.com/image.png",
      null,
      promises[1],
    )
    controller.shareLink(
      "wechat_session",
      "Title",
      "https://example.com",
      "Description",
      null,
      promises[2],
    )
    controller.isInstalled("dingtalk", promises[3])

    assertEquals(0, adapterAcquisitions)
    assertEquals(emptyList<ShareAdapterCall>(), adapter.calls)
    promises.forEach { promise ->
      assertEquals(listOf(Settlement.Rejected("E_NOT_INITIALIZED")), promise.settlements)
    }
  }

  @Test
  fun `initialized share entry points forward exact payloads`() {
    val adapter = RecordingShareAdapter(installed = true)
    val controller = controller(initialized = true, adapter = adapter)
    val text = RecordingPromise()
    val image = RecordingPromise()
    val link = RecordingPromise()
    val installed = RecordingPromise()

    controller.shareText("wechat_session", "hello", text)
    adapter.callbacks.removeFirst().onSuccess()
    controller.shareImage(
      "dingtalk",
      "https://example.com/image.png",
      "https://example.com/thumb.png",
      image,
    )
    adapter.callbacks.removeFirst().onSuccess()
    controller.shareLink(
      "wechat_session",
      "Title",
      "https://example.com",
      "Description",
      "https://example.com/thumb.png",
      link,
    )
    adapter.callbacks.removeFirst().onSuccess()
    controller.isInstalled("dingtalk", installed)

    assertEquals(
      listOf(
        ShareAdapterCall.Share(
          UmengSharePlatform.WECHAT_SESSION,
          UmengSharePayload.Text("hello"),
        ),
        ShareAdapterCall.Share(
          UmengSharePlatform.DINGTALK,
          UmengSharePayload.Image(
            "https://example.com/image.png",
            "https://example.com/thumb.png",
          ),
        ),
        ShareAdapterCall.Share(
          UmengSharePlatform.WECHAT_SESSION,
          UmengSharePayload.Link(
            "Title",
            "https://example.com",
            "Description",
            "https://example.com/thumb.png",
          ),
        ),
        ShareAdapterCall.IsInstalled(UmengSharePlatform.DINGTALK),
      ),
      adapter.calls,
    )
    assertEquals(
      listOf(Settlement.Resolved(UmengShareSuccess("wechat_session"))),
      text.settlements,
    )
    assertEquals(
      listOf(Settlement.Resolved(UmengShareSuccess("dingtalk"))),
      image.settlements,
    )
    assertEquals(
      listOf(Settlement.Resolved(UmengShareSuccess("wechat_session"))),
      link.settlements,
    )
    assertEquals(listOf(Settlement.Resolved(true)), installed.settlements)
  }

  @Test
  fun `handler post false rejects once and a late runnable does not acquire the adapter`() {
    val adapter = RecordingShareAdapter()
    var adapterAcquisitions = 0
    val dispatcher = RecordingUiDispatcher(onUiThread = false, postResult = false)
    val controller =
      controller(
        initialized = true,
        adapter = adapter,
        dispatcher = dispatcher,
        onAdapterAcquired = { adapterAcquisitions += 1 },
      )
    val promise = RecordingPromise()

    controller.shareText("wechat_session", "hello", promise)
    dispatcher.runQueued()

    assertEquals(listOf(Settlement.Rejected("E_SHARE_FAILED")), promise.settlements)
    assertEquals(0, adapterAcquisitions)
    assertEquals(emptyList<ShareAdapterCall>(), adapter.calls)
  }

  @Test
  fun `a synchronous runnable exception rejects once before destroy`() {
    val order = mutableListOf<String>()
    val adapter =
      RecordingShareAdapter(
        shareFailure = IllegalStateException("share exploded"),
        order = order,
      )
    val controller = controller(initialized = true, adapter = adapter)
    val promise = RecordingPromise(order)

    controller.shareText("wechat_session", "hello", promise)
    controller.onHostDestroy("activity")

    assertEquals(listOf(Settlement.Rejected("E_SHARE_FAILED")), promise.settlements)
    assertEquals(listOf("share", "reject:E_SHARE_FAILED", "release"), order)
  }

  @Test
  fun `SDK cancel wins the settle race and maps to user cancel`() {
    val adapter = RecordingShareAdapter()
    val controller = controller(initialized = true, adapter = adapter)
    val promise = RecordingPromise()

    controller.shareText("wechat_session", "hello", promise)
    val callback = adapter.callbacks.single()
    callback.onCancel()
    callback.onFailure(IllegalStateException("late failure"))
    callback.onSuccess()
    controller.onHostDestroy("activity")

    assertEquals(listOf(Settlement.Rejected("E_USER_CANCEL")), promise.settlements)
  }

  @Test
  fun `SDK failure wins the settle race and maps to share failed`() {
    val adapter = RecordingShareAdapter()
    val controller = controller(initialized = true, adapter = adapter)
    val promise = RecordingPromise()

    controller.shareText("wechat_session", "hello", promise)
    val callback = adapter.callbacks.single()
    callback.onFailure(IllegalStateException("failed"))
    callback.onCancel()

    assertEquals(listOf(Settlement.Rejected("E_SHARE_FAILED")), promise.settlements)
  }

  @Test
  fun `host destroy rejects before release and ignores a late SDK callback`() {
    val order = mutableListOf<String>()
    val adapter = RecordingShareAdapter(order = order)
    val controller = controller(initialized = true, adapter = adapter)
    val promise = RecordingPromise(order)

    controller.shareText("wechat_session", "hello", promise)
    val callback = adapter.callbacks.single()
    controller.onHostDestroy("activity")
    callback.onSuccess()

    assertEquals(listOf(Settlement.Rejected("E_SHARE_FAILED")), promise.settlements)
    assertEquals(listOf("share", "reject:E_SHARE_FAILED", "release"), order)
  }

  @Test
  fun `invalidate rejects before release and queued work stays cancelled`() {
    val order = mutableListOf<String>()
    val adapter = RecordingShareAdapter(order = order)
    val dispatcher = RecordingUiDispatcher(onUiThread = false, postResult = true)
    val controller =
      controller(
        initialized = true,
        adapter = adapter,
        dispatcher = dispatcher,
      )
    val promise = RecordingPromise(order)

    controller.shareText("wechat_session", "hello", promise)
    controller.invalidate("activity")
    dispatcher.runQueued()

    assertEquals(listOf(Settlement.Rejected("E_SHARE_FAILED")), promise.settlements)
    assertEquals(listOf("reject:E_SHARE_FAILED", "release"), order)
  }

  @Test
  fun `activity callbacks and destroy do not acquire a vendor adapter before initialization`() {
    val adapter = RecordingShareAdapter()
    var adapterAcquisitions = 0
    val controller =
      controller(
        initialized = false,
        adapter = adapter,
        onAdapterAcquired = { adapterAcquisitions += 1 },
      )

    controller.onActivityResult("activity", 7, 8, null)
    controller.onHostDestroy("activity")
    controller.invalidate("activity")

    assertEquals(0, adapterAcquisitions)
    assertEquals(emptyList<ShareAdapterCall>(), adapter.calls)
  }

  @Test
  fun `activity result and release forward only after initialization`() {
    val adapter = RecordingShareAdapter()
    val controller = controller(initialized = true, adapter = adapter)

    controller.onActivityResult("activity", 7, 8, null)
    controller.onHostDestroy("activity")

    assertEquals(
      listOf(
        ShareAdapterCall.ActivityResult(7, 8, null),
        ShareAdapterCall.Release,
      ),
      adapter.calls,
    )
  }

  @Test
  fun `termination waits for an in-flight share before release`() {
    assertTerminationWaitsForInvocation(BlockingVendorCall.SHARE) { controller, promise ->
      controller.shareText("wechat_session", "hello", promise)
    }
  }

  @Test
  fun `termination waits for an in-flight install query before release`() {
    assertTerminationWaitsForInvocation(BlockingVendorCall.IS_INSTALLED) { controller, promise ->
      controller.isInstalled("wechat_session", promise)
    }
  }

  @Test
  fun `termination waits for an in-flight activity result before release`() {
    assertTerminationWaitsForInvocation(BlockingVendorCall.ACTIVITY_RESULT) { controller, _ ->
      controller.onActivityResult("activity", 7, 8, null)
    }
  }

  @Test
  fun `termination prevents queued and new requests from acquiring an adapter`() {
    val adapter = RecordingShareAdapter()
    var adapterAcquisitions = 0
    val dispatcher = RecordingUiDispatcher(onUiThread = false, postResult = true)
    val controller =
      controller(
        initialized = true,
        adapter = adapter,
        dispatcher = dispatcher,
        onAdapterAcquired = { adapterAcquisitions += 1 },
      )
    val queued = RecordingPromise()
    val lateShare = RecordingPromise()
    val lateInstallQuery = RecordingPromise()

    controller.shareText("wechat_session", "queued", queued)
    controller.invalidate("activity")
    dispatcher.runQueued()

    controller.shareText("wechat_session", "late", lateShare)
    dispatcher.runQueued()
    controller.isInstalled("wechat_session", lateInstallQuery)
    controller.onActivityResult("activity", 7, 8, null)

    assertEquals(listOf(Settlement.Rejected("E_SHARE_FAILED")), queued.settlements)
    assertEquals(listOf(Settlement.Rejected("E_SHARE_FAILED")), lateShare.settlements)
    assertEquals(
      listOf(Settlement.Rejected("E_SHARE_FAILED")),
      lateInstallQuery.settlements,
    )
    assertEquals(1, adapterAcquisitions)
    assertEquals(listOf(ShareAdapterCall.Release), adapter.calls)
  }

  @Test
  fun `release failure never escapes lifecycle termination or replaces request rejection`() {
    listOf<(UmengShareController<String>) -> Unit>(
      { controller -> controller.onHostDestroy("activity") },
      { controller -> controller.invalidate("activity") },
    ).forEach { terminate ->
      val adapter =
        RecordingShareAdapter(
          releaseFailure = IllegalStateException("release exploded"),
        )
      val controller = controller(initialized = true, adapter = adapter)
      val promise = RecordingPromise()

      controller.shareText("wechat_session", "hello", promise)
      terminate(controller)

      assertEquals(
        listOf(Settlement.Rejected("E_SHARE_FAILED")),
        promise.settlements,
      )
      assertEquals(
        listOf(
          ShareAdapterCall.Share(
            UmengSharePlatform.WECHAT_SESSION,
            UmengSharePayload.Text("hello"),
          ),
          ShareAdapterCall.Release,
        ),
        adapter.calls,
      )
    }
  }

  private fun assertTerminationWaitsForInvocation(
    blockedCall: BlockingVendorCall,
    invoke: (UmengShareController<String>, RecordingPromise) -> Unit,
  ) {
    val invocationEntered = CountDownLatch(1)
    val allowInvocationToReturn = CountDownLatch(1)
    val rejectionEntered = CountDownLatch(1)
    val allowRejectionToReturn = CountDownLatch(1)
    val releaseEntered = CountDownLatch(1)
    val requests = ShareRequestRegistry()
    requests.register(
      BlockingRejectionPromise(
        rejectionEntered = rejectionEntered,
        allowRejectionToReturn = allowRejectionToReturn,
      ),
    )
    val adapter =
      BlockingShareAdapter(
        blockedCall = blockedCall,
        invocationEntered = invocationEntered,
        allowInvocationToReturn = allowInvocationToReturn,
        releaseEntered = releaseEntered,
      )
    val controller =
      controller(
        initialized = true,
        adapter = adapter,
        requests = requests,
      )
    val executor = Executors.newFixedThreadPool(2)
    val invocation = executor.submit { invoke(controller, RecordingPromise()) }

    try {
      await(invocationEntered, "vendor invocation did not start")
      val termination = executor.submit { controller.invalidate("activity") }
      await(rejectionEntered, "termination did not reject active requests")
      allowRejectionToReturn.countDown()

      try {
        termination.get(1, TimeUnit.SECONDS)
        fail("termination released vendor before the in-flight invocation returned")
      } catch (_: TimeoutException) {
        // in-flight invocation 仍占用 lifecycle，termination 必须等待。
      }

      assertEquals(1L, releaseEntered.count)
      allowInvocationToReturn.countDown()
      invocation.get(5, TimeUnit.SECONDS)
      termination.get(5, TimeUnit.SECONDS)
      assertEquals(0L, releaseEntered.count)
    } finally {
      allowRejectionToReturn.countDown()
      allowInvocationToReturn.countDown()
      executor.shutdownNow()
    }
  }

  private fun controller(
    initialized: Boolean,
    adapter: UmengShareAdapter,
    dispatcher: RecordingUiDispatcher =
      RecordingUiDispatcher(onUiThread = true, postResult = true),
    onAdapterAcquired: () -> Unit = {},
    requests: ShareRequestRegistry = ShareRequestRegistry(),
  ): UmengShareController<String> =
    UmengShareController(
      isInitialized = { initialized },
      currentHost = { "activity" },
      adapterFactory = {
        onAdapterAcquired()
        adapter
      },
      uiDispatcher = dispatcher,
      requests = requests,
    )

  private fun await(
    latch: CountDownLatch,
    failureMessage: String,
  ) {
    if (!latch.await(5, TimeUnit.SECONDS)) {
      fail(failureMessage)
    }
  }

  private sealed interface Settlement {
    data class Resolved(
      val value: Any?,
    ) : Settlement

    data class Rejected(
      val code: String,
    ) : Settlement
  }

  private class RecordingPromise(
    private val order: MutableList<String>? = null,
  ) : ShareRequestPromise {
    val settlements = mutableListOf<Settlement>()

    override fun resolve(value: Any?) {
      settlements += Settlement.Resolved(value)
      order?.add("resolve")
    }

    override fun reject(
      code: String,
      message: String,
      cause: Throwable?,
    ) {
      settlements += Settlement.Rejected(code)
      order?.add("reject:$code")
    }
  }

  private class BlockingRejectionPromise(
    private val rejectionEntered: CountDownLatch,
    private val allowRejectionToReturn: CountDownLatch,
  ) : ShareRequestPromise {
    override fun resolve(value: Any?) = Unit

    override fun reject(
      code: String,
      message: String,
      cause: Throwable?,
    ) {
      rejectionEntered.countDown()
      check(allowRejectionToReturn.await(5, TimeUnit.SECONDS)) {
        "test did not release promise rejection"
      }
    }
  }

  private class RecordingUiDispatcher(
    private val onUiThread: Boolean,
    private val postResult: Boolean,
  ) : ShareUiDispatcher {
    private var queued: (() -> Unit)? = null

    override fun isOnUiThread(): Boolean = onUiThread

    override fun post(block: () -> Unit): Boolean {
      queued = block
      return postResult
    }

    fun runQueued() {
      queued?.invoke()
    }
  }

  private sealed interface ShareAdapterCall {
    data class Share(
      val platform: UmengSharePlatform,
      val payload: UmengSharePayload,
    ) : ShareAdapterCall

    data class IsInstalled(
      val platform: UmengSharePlatform,
    ) : ShareAdapterCall

    data class ActivityResult(
      val requestCode: Int,
      val resultCode: Int,
      val data: Intent?,
    ) : ShareAdapterCall

    data object Release : ShareAdapterCall
  }

  private enum class BlockingVendorCall {
    SHARE,
    IS_INSTALLED,
    ACTIVITY_RESULT,
  }

  private class BlockingShareAdapter(
    private val blockedCall: BlockingVendorCall,
    private val invocationEntered: CountDownLatch,
    private val allowInvocationToReturn: CountDownLatch,
    private val releaseEntered: CountDownLatch,
  ) : UmengShareAdapter {
    override fun share(
      platform: UmengSharePlatform,
      payload: UmengSharePayload,
      callback: UmengShareCallback,
    ) {
      blockIf(BlockingVendorCall.SHARE)
    }

    override fun isInstalled(platform: UmengSharePlatform): Boolean {
      blockIf(BlockingVendorCall.IS_INSTALLED)
      return false
    }

    override fun onActivityResult(
      requestCode: Int,
      resultCode: Int,
      data: Intent?,
    ) {
      blockIf(BlockingVendorCall.ACTIVITY_RESULT)
    }

    override fun release() {
      releaseEntered.countDown()
    }

    private fun blockIf(call: BlockingVendorCall) {
      if (blockedCall != call) return
      invocationEntered.countDown()
      check(allowInvocationToReturn.await(5, TimeUnit.SECONDS)) {
        "test did not release vendor invocation"
      }
    }
  }

  private class RecordingShareAdapter(
    private val installed: Boolean = false,
    private val shareFailure: Throwable? = null,
    private val releaseFailure: Throwable? = null,
    private val order: MutableList<String>? = null,
  ) : UmengShareAdapter {
    val calls = mutableListOf<ShareAdapterCall>()
    val callbacks = ArrayDeque<UmengShareCallback>()

    override fun share(
      platform: UmengSharePlatform,
      payload: UmengSharePayload,
      callback: UmengShareCallback,
    ) {
      calls += ShareAdapterCall.Share(platform, payload)
      order?.add("share")
      shareFailure?.let { throw it }
      callbacks += callback
    }

    override fun isInstalled(platform: UmengSharePlatform): Boolean {
      calls += ShareAdapterCall.IsInstalled(platform)
      return installed
    }

    override fun onActivityResult(
      requestCode: Int,
      resultCode: Int,
      data: Intent?,
    ) {
      calls += ShareAdapterCall.ActivityResult(requestCode, resultCode, data)
    }

    override fun release() {
      calls += ShareAdapterCall.Release
      order?.add("release")
      releaseFailure?.let { throw it }
    }
  }
}
