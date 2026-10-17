#import <Foundation/Foundation.h>
@interface MobClick : NSObject
+ (NSMutableArray *)calls;
+ (void)event:(NSString *)event;
+ (void)event:(NSString *)event attributes:(NSDictionary *)attributes;
+ (void)profileSignInWithPUID:(NSString *)user;
+ (void)profileSignInWithPUID:(NSString *)user provider:(NSString *)provider;
+ (void)profileSignOff;
@end
