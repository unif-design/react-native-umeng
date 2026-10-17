package com.umeng.commonsdk
object UMConfigure {
  const val DEVICE_TYPE_PHONE = 1
  val calls = mutableListOf<List<Any?>>()
  var failure: Throwable? = null

  fun preInit(c: android.content.Context, key: String, channel: String) {
    calls.add(listOf("preInit", c, key, channel))
    failure?.let { throw it }
  }

  fun init(c: android.content.Context, key: String, channel: String, type: Int, push: String) {
    calls.add(listOf("init", c, key, channel, type, push))
    failure?.let { throw it }
  }
}
