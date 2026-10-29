#import <Foundation/Foundation.h>
typedef NSString *UIApplicationOpenURLOptionsKey;
@interface UIApplication : NSObject
+ (instancetype)sharedApplication;
@property BOOL canOpen;
@property NSMutableArray<NSURL *> *openedURLs;
- (BOOL)canOpenURL:(NSURL *)url;
@end

extern NSNotificationName const UIApplicationDidEnterBackgroundNotification;
extern NSNotificationName const UIApplicationDidBecomeActiveNotification;
