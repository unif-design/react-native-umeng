#import <Foundation/Foundation.h>
@interface UMConfigure : NSObject
+ (NSMutableArray *)calls;
+ (void)setFailure:(NSException *)failure;
+ (void)initWithAppkey:(NSString *)key channel:(NSString *)channel;
@end
