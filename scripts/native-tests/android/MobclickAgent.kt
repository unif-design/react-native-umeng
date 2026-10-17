package com.umeng.analytics
object MobclickAgent {
  val calls = mutableListOf<List<Any?>>()

  fun onEventObject(c: android.content.Context, id: String, params: Map<String, Any?>) {
    calls.add(listOf("event", c, id, params))
  }

  fun onProfileSignIn(user: String) {
    calls.add(listOf("user", user))
  }

  fun onProfileSignIn(provider: String, user: String) {
    calls.add(listOf("user", provider, user))
  }

  fun onProfileSignOff() {
    calls.add(listOf("clear"))
  }
}
