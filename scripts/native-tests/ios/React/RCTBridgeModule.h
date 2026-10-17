#import <Foundation/Foundation.h>
typedef void (^RCTPromiseResolveBlock)(id result);
typedef void (^RCTPromiseRejectBlock)(NSString *code, NSString *message, NSError *error);
#define RCT_EXPORT_MODULE(name)                                                                                        \
  +(NSString *)moduleName {                                                                                            \
    return @ #name;                                                                                                    \
  }
