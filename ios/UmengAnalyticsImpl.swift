import Foundation
import UMCommon

@objcMembers
public class UmengAnalyticsImpl: NSObject {

  public func onEvent(eventId: String, params: NSDictionary?) {
    if let p = params as? [String: Any], !p.isEmpty {
      // MobClick.event attributes 要求 value 是 NSString — JS 端已 stringify
      var stringDict: [String: NSString] = [:]
      for (k, v) in p {
        stringDict[k] = (v as? String).map { $0 as NSString } ?? NSString(string: "\(v)")
      }
      MobClick.event(eventId, attributes: stringDict)
    } else {
      MobClick.event(eventId)
    }
  }

  public func signIn(userId: String, provider: String?) {
    if let pr = provider, !pr.isEmpty {
      MobClick.profileSignIn(withPUID: userId, provider: pr)
    } else {
      MobClick.profileSignIn(withPUID: userId)
    }
  }

  public func signOut() {
    MobClick.profileSignOff()
  }
}
