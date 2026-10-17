#import <Foundation/Foundation.h>
typedef NS_ENUM(NSInteger, UMSocialPlatformType) {
  UMSocialPlatformType_WechatSession = 1,
  UMSocialPlatformType_DingDing = 2
};
@interface UMSocialGlobal : NSObject
+ (instancetype)shareInstance;
@property NSDictionary *universalLinkDic;
@end
@interface UMSocialMessageObject : NSObject
@property NSString *text;
@property id shareObject;
@end
@interface UMShareImageObject : NSObject
@property id shareImage;
@property id thumbImage;
@end
@interface UMShareWebpageObject : NSObject
@property NSString *title;
@property NSString *descr;
@property id thumbImage;
@property NSString *webpageUrl;
+ (instancetype)shareObjectWithTitle:(NSString *)title descr:(NSString *)descr thumImage:(id)thumb;
@end
@interface UMSocialManager : NSObject
+ (instancetype)defaultManager;
@property NSMutableArray *calls;
@property NSMutableArray *completions;
@property BOOL configured;
@property BOOL handled;
@property NSException *lifecycleFailure;
- (BOOL)setPlaform:(UMSocialPlatformType)platform
            appKey:(NSString *)key
         appSecret:(NSString *)secret
       redirectURL:(NSString *)url;
- (BOOL)handleOpenURL:(NSURL *)url options:(NSDictionary *)options;
- (BOOL)handleUniversalLink:(NSUserActivity *)activity options:(NSDictionary *)options;
- (void)shareToPlatform:(UMSocialPlatformType)platform
            messageObject:(UMSocialMessageObject *)message
    currentViewController:(id)controller
               completion:(void (^)(id, NSError *))completion;
@end
