# RN 0.88 开发基线与覆盖率

正式开发、example与网站使用React Native0.88.0、React19.3.0；发布版本保持2.1.0，Node engines对齐RN正式要求。example的SceneDelegate/AppDelegate对齐community正式模板，同时保留友盟/微信/钉钉的冷启动URL、Universal Link及回调顺序。

## 完整实测范围

| 范围 | 结果 |
| --- | --- |
| 库全部JS/TS运行源码 | 15 suites /133 tests；语句477、分支390、函数106、行430，全部100% |
| example全部JS/TS运行源码 | 11 suites /92 tests；语句568、分支370、函数168、行546，全部100% |
| Android全部11 Kotlin /33classes | 指令3000、分支255、行758、方法173、复杂度303、类33，全部100% |
| iOS全部6个Objective-C++ | 同源码哈希双collector物理行654/654；LLVM函数84/84、显式分支162/162；原始LLVM行793/795、区域388/392保留 |
| Android example原始4 Kotlin宿主 | 指令67、行15、方法9、复杂度9、类4，全部100%；无条件分支，分支N/A |
| iOS example原始3 Swift宿主 | DEBUG行148、RELEASE行142；函数20、区域40，全部100%；Swift不生成branch counters，分支N/A |

标准 `yarn test --maxWorkers=2 --coverage` 顺序执行库与example两个独立Jest配置，两组都强制语句/分支/函数/行100。完整清单、SHA256和分母分别在 `coverage/scope.json`、`example/coverage/scope.json`。只排除测试与声明文件，类型/纯导出入口保留；自有实现不mock。原生完整方法、边界、原始计数及六处计数差异详见[原生证明报告](rn88-native-coverage.md)。iOS不能表述为“单工具四项100%”；原 `@try/@catch` 机制保留，双collector交叉物理行算法与全部原始数据公开。

## JS最小清理与实际可达路径

库删除前分母语句484、分支402、函数106、行435；之后477/390/106/430。`installed()` 已检查不可变TurboModule绑定后才返回true，因此share入口的第二次模块空值判断重复。ShareSheet只从内部真实controller接收show/dismiss两个字面事件；ready/closing渲染注册的回调持有已建立的session/content，closed/loading不挂载这些控件，旧闭包也保持其原快照，因此删除这些位置重复null判断。真实控制器的缺SDK、未安装、畸形输入、过期回调、错误、取消、重入和observer异常仍全部验证。

保留三个函数式state updater中的“当前会话已改变”判断：React startTransition测试实际构造了这些重排路径。浮动closing保护也保留：ReactTestRenderer19.3强制并发，而RN0.88实际ReactFabric仍支持legacy root。新增测试使用原ReactFabric实现、实际React hooks和controller/Host，只替换系统挂载与第三方UI边界；在外部AbortSignal回调下同步提交closing，实际命中此前缺失分支。

example删除前分母语句578、分支378、函数168、行555；之后568/370/168/546：

- 导航初态单元素，navigate追加，reset单元素，back只有长度>1才删除，因此栈恒非空，删除空栈fallback。`initialized`与`resetNavigation(home)`分两次提交，legacy Fabric能在其间渲染setup路由；这条case保留，已实际执行。
- `YOUR_`占位从字符串起始匹配，与前置绝对HTTPS检查互斥；非法占位早已由HTTPS错误路径处理，仅删后置重复判断。
- 私有executeInitialize只有“awaitingConsent且已同意”或“initFailedLocked”两个同步入口，立即dispatch的固定reducer动作必进入initializing，配置快照从成功review保存后不会被这两个状态清空。删除重复phase/null检查，入口检查、所有SDK异常与重试逻辑保留。
- reviewConfiguration只调固定自有reducer action并排队日志updater，无SDK或await。真实legacy Fabric测试在reviewSucceeded的同步原生commit注入挂载错误，React实际接管并卸载root，错误不从review的同步栈传播。源码链路与该测试共同证明原同步catch不承担错误边界，删除该catch；review失败reducer契约测试及所有初始化/平台查询/分享/analytics异常处理保留。

example的可见UI流程覆盖凭据、同意、初始化失败重试、平台刷新/过期状态、图片预览加载/错误、分享内容与全部选项、成功/取消/失败、analytics用户及日志。SetupScreen另以真实Context输入边界验证状态展示与未知状态处理；provider/reducer行为独立实测。

## 工程与门禁

原生库入口为 `yarn test:native:android` 和 `test:native:ios`；example宿主入口为 `test:example:native:android` 和 `test:example:native:ios`，均接入本库 `.github/ci` 现有钩子。共享workflow未改。Android用正式Kotlin编译器和校验SHA256的JaCoCo0.8.13，iOS Foundation/dispatch/异常和XCTest真实运行，仅替换系统/RN/vendor边界。

Android Debug、iOS Debug实际工程构建通过。example自身Gemfile/lock固定Ruby>=3.3、CocoaPods1.17.0、ActiveSupport7.2.4、xcodeproj1.28.1，bundle check/pod --deployment均通过。lint/typecheck/bob、65个发布契约测试、依赖和example契约校验通过；lint保留2个测试使用实际Fabric深层入口的弃用提示，无错误。CocoaPods相关脚本以本库Gemfile的bundle环境运行。

工程指令校验同步了正式开发依赖预期，保留 peer 兼容范围与独立测试 fixture；实际20个Markdown/MDX文件路由检查及8个校验器测试通过。package校验实际检查194个打包文件（含27个原生生产文件），Android/iOS原生契约检查均通过。

网站RNW0.21.4+SVG15.16.0+assets-registry0.88.0，registry仅使用混合模块CommonJS转换；SSG、类型检查、llms与真实webpack共享资产表验证通过。网站和工程工具脚本独立记录检查，不将库/example100%扩张成全仓覆盖。

原始日志在 `coverage/rn88-logs`，native库报告在 `coverage/native`。厂商SDK真机登录/分享、平台回流、性能、远程CI与发布属于统一交付阶段，本任务未发布、推送或安装手机。
