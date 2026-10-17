package com.umeng.socialize.media
import umeng.boundary.Boundary
open class DingCallBack {
  init { Boundary.record("dingtalk.callback", this) }
}
