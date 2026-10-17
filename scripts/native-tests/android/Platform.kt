package android.os
class Looper {
  companion object {
    val main = Looper()
    var current: Looper? = main

    fun myLooper() = current

    fun getMainLooper() = main
  }
}

class Handler(looper: Looper) {
  fun post(block: () -> Unit): Boolean {
    if (accept) tasks.add(block)
    return accept
  }

  companion object {
    var accept = true
    val tasks = mutableListOf<() -> Unit>()

    fun drain() {
      val work = tasks.toList()
      tasks.clear()
      work.forEach { it() }
    }
  }
}
