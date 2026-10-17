package android.util
object Log {
  val failures = mutableListOf<Throwable>()

  fun e(tag: String, message: String, error: Throwable): Int {
    failures.add(error)
    return 0
  }
}
