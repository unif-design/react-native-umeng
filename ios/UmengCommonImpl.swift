import Foundation
import React

@objcMembers
public class UmengCommonImpl: NSObject {

  public func initResolve(_ resolve: @escaping RCTPromiseResolveBlock,
                          reject: @escaping RCTPromiseRejectBlock) {
    do {
      try UmengBootstrap.shared.ensureInit()
      resolve(NSNull())
    } catch let nsError as NSError {
      reject("E_UNKNOWN", nsError.localizedDescription, nsError)
    } catch {
      reject("E_UNKNOWN", "init failed: \(error)", nil)
    }
  }

  public func isInitedResolve(_ resolve: @escaping RCTPromiseResolveBlock,
                              reject: @escaping RCTPromiseRejectBlock) {
    resolve(UmengBootstrap.shared.isInited())
  }
}
