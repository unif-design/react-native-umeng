import Foundation
import UIKit
import UMCommon
import UMShare
import React

@objcMembers
public class UmengShareImpl: NSObject {

  // MARK: - Public bridge

  public func shareText(platform: String, text: String,
                        resolve: @escaping RCTPromiseResolveBlock,
                        reject: @escaping RCTPromiseRejectBlock) {
    guard let umPlatform = mapPlatform(platform, reject: reject) else { return }
    DispatchQueue.main.async {
      let msg = UMSocialMessageObject()
      msg.text = text
      self.runShare(platform: platform, umPlatform: umPlatform, message: msg,
                    resolve: resolve, reject: reject)
    }
  }

  public func shareImage(platform: String, image: String, thumb: String?,
                         resolve: @escaping RCTPromiseResolveBlock,
                         reject: @escaping RCTPromiseRejectBlock) {
    guard let umPlatform = mapPlatform(platform, reject: reject) else { return }
    DispatchQueue.main.async {
      let img = UMShareImageObject()
      img.shareImage = image as NSString
      if let t = thumb, !t.isEmpty { img.thumbImage = t as NSString }
      let msg = UMSocialMessageObject()
      msg.shareObject = img
      self.runShare(platform: platform, umPlatform: umPlatform, message: msg,
                    resolve: resolve, reject: reject)
    }
  }

  public func shareLink(platform: String,
                        title: String,
                        url: String,
                        description: String?,
                        thumb: String?,
                        resolve: @escaping RCTPromiseResolveBlock,
                        reject: @escaping RCTPromiseRejectBlock) {
    guard let umPlatform = mapPlatform(platform, reject: reject) else { return }
    DispatchQueue.main.async {
      let web = UMShareWebpageObject.shareObject(
        withTitle: title,
        descr: description ?? "",
        thumImage: thumb as Any?
      )
      web.webpageUrl = url
      let msg = UMSocialMessageObject()
      msg.shareObject = web
      self.runShare(platform: platform, umPlatform: umPlatform, message: msg,
                    resolve: resolve, reject: reject)
    }
  }

  public func isInstalled(platform: String,
                          resolve: @escaping RCTPromiseResolveBlock,
                          reject: @escaping RCTPromiseRejectBlock) {
    let scheme: String
    switch platform {
    case "wechat_session": scheme = "weixin://"
    case "dingtalk":        scheme = "dingtalk://"
    default:
      reject("E_PLATFORM_NOT_SUPPORTED", "Platform '\(platform)' is not supported", nil)
      return
    }
    DispatchQueue.main.async {
      let url = URL(string: scheme)!
      resolve(UIApplication.shared.canOpenURL(url))
    }
  }

  // MARK: - Helpers

  private func mapPlatform(_ p: String, reject: RCTPromiseRejectBlock) -> UMSocialPlatformType? {
    switch p {
    case "wechat_session": return .wechatSession
    case "dingtalk":        return .dingDing
    default:
      reject("E_PLATFORM_NOT_SUPPORTED", "Platform '\(p)' is not supported", nil)
      return nil
    }
  }

  private func runShare(platform: String,
                        umPlatform: UMSocialPlatformType,
                        message: UMSocialMessageObject,
                        resolve: @escaping RCTPromiseResolveBlock,
                        reject: @escaping RCTPromiseRejectBlock) {
    UMSocialManager.default()?.share(
      to: umPlatform,
      messageObject: message,
      currentViewController: nil,
      completion: { _, error in
        if let err = error as NSError? {
          // 友盟错误码：2009 = cancel；2008 = NotInstall；其他 = failed
          if err.code == 2009 {
            resolve(["code": "cancel", "platform": platform])
          } else if err.code == 2008 {
            resolve(["code": "failed",
                     "message": "platform not installed",
                     "platform": platform])
          } else {
            resolve(["code": "failed",
                     "message": err.localizedDescription,
                     "platform": platform])
          }
          return
        }
        resolve(["code": "success", "platform": platform])
      }
    )
  }
}
