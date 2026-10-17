#import <Foundation/Foundation.h>
typedef NS_ENUM(NSInteger, RCTLogLevel) { RCTLogLevelInfo = 1 };
typedef NSInteger RCTLogSource;
typedef void (^RCTLogFunction)(RCTLogLevel, RCTLogSource, NSString *, NSNumber *, NSString *);
void RCTPerformBlockWithLogFunction(dispatch_block_t block, RCTLogFunction logger);
void RCTLogInfo(NSString *message, ...);
