package android.app
import umeng.boundary.Boundary
open class Application {
  val applicationContext: Application get() = this
  open fun onCreate() { Boundary.record("application.create", this) }
}
