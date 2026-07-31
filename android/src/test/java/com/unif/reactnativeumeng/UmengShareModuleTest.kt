package com.unif.reactnativeumeng

import android.content.Intent
import org.junit.Assert.assertEquals
import org.junit.Test

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

  private fun controller(
    initialized: Boolean,
    adapter: RecordingShareAdapter,
    dispatcher: RecordingUiDispatcher =
      RecordingUiDispatcher(onUiThread = true, postResult = true),
    onAdapterAcquired: () -> Unit = {},
  ): UmengShareController<String> =
    UmengShareController(
      isInitialized = { initialized },
      currentHost = { "activity" },
      adapterFactory = {
        onAdapterAcquired()
        adapter
      },
      uiDispatcher = dispatcher,
    )

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

  private class RecordingShareAdapter(
    private val installed: Boolean = false,
    private val shareFailure: Throwable? = null,
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
    }
  }
}
