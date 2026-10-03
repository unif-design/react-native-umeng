---
title: 测试
description: 用官方 mock 构造三态结果，并区分原生验证范围。
---

# 测试

```ts
jest.mock('@unif/react-native-umeng', () =>
  require('@unif/react-native-umeng/mock')
);
```

mock 入口隔离原生模块与 Design。独立操作是 `jest.fn`，可以显式覆盖一次调用结果：

```ts
import { share } from '@unif/react-native-umeng';
import {
  shareSuccess,
  shareCancelled,
  shareFailed,
} from '@unif/react-native-umeng/mock';

jest.mocked(share).mockResolvedValueOnce(shareSuccess('dingtalk'));
jest.mocked(share).mockResolvedValueOnce(shareCancelled());
jest
  .mocked(share)
  .mockResolvedValueOnce(
    shareFailed({ reason: 'sdk_failed', message: 'SDK failed' }, 'dingtalk')
  );
```

mock 的 `useShareSheet` 返回每个 hook 自己的稳定控制器与空宿主，默认 open 返回无目标的 cancelled；消费测试可用 `jest.mocked(useShareSheet).mockReturnValue([controller, host])` 提供所需结果。

源码定向验证：

```sh
yarn test src/__tests__ --runInBand --watchman=false
yarn workspace @unif/react-native-umeng-example test --runInBand --watchman=false
yarn typecheck
yarn lint
yarn prepare
yarn verify:consumers
```

## 分享面板生命周期回归

库内用例从公开的 `useShareSheet` 渲染真实 controller 和 host，只替换原生 SDK、Design 等外部边界。example 的集成用例使用真实 Design 组件、局部主题和字号设置。

| 场景                                         | 应验证的结果                                                                |
| -------------------------------------------- | --------------------------------------------------------------------------- |
| iOS Modal 开始呈现但 `onShow` 尚未到达时取消 | 选择结果为 cancelled；原生退出结束前重入返回 busy，`onDismiss` 只属于原调用 |
| Modal 尚未提交呈现、查询仍在进行时取消       | 无需原生关闭事件即可结束，迟到查询不能重新显示面板                          |
| 滑入、展示或退出期间卸载并替换宿主           | 原调用只结束一次；旧宿主的显示、关闭和取消事件不能改变新调用                |
| 重复关闭或重复原生回调                       | Promise 与 `onDismiss` 各交付一次，下一轮仍能正常打开和关闭                 |
| 已发起 SDK 分享后结束呈现                    | 释放呈现内容与 signal 监听，原 Promise 继续等待实际 SDK 回执                |

模拟 Modal 回调时，应在事件投递时读取对应 Modal 实例的最新 props。只保存一份旧 props 再调用，会漏掉 React Native 在动画完成时读取 `this.props.onDismiss` 的时序问题。iOS 滑入中的取消会先等待 `onShow` 确认原生已呈现，再请求退出；尚未提交呈现或已卸载的宿主直接收尾，不等待不存在的 `onDismiss`。

### 2026-09-30 本地复验

使用 Node 24.13.0；发布脚本中的 Podfile 检查复用 Ruby 4.0.7 与 CocoaPods 1.15.2。

- 红灯：先加入真实 hook/controller/host 的最新 props 回归，旧实现为 6 通过、1 失败；旧 Modal 的关闭事件错误触发了重入调用的 `onDismiss`。
- 继续补充回归后，原 controller 又暴露两项失败：原生结束呈现时未结算选择结果，以及等待 SDK 回执期间未释放 abort 监听。修复后，host/controller 两个测试集共 18 项通过。
- 完整库 Jest：11 个测试集、67 项通过；example Jest：9 个测试集、53 项通过，包含实际 Design 组件集成。
- `typecheck`、`lint`、`prepare`、`verify:package`、`verify:consumers`、依赖／开发入口／example 契约检查通过。Lint 排除 Android 构建生成的报告目录，源码仍全量检查。
- 发布验证脚本 62 项全部通过、无跳过；LLM 文档生成及生成器测试通过。

本轮只修改 TypeScript、测试与验证接线，未重跑原生 example 完整构建。既有 iOS 补充记录中的 XCTest 实际执行数为 0，不能算作 iOS 运行测试通过。上述回归控制了原生事件顺序，没有在设备上运行 UIKit 动画，也没有执行微信／钉钉真实分享。

`verify:consumers` 安装真实打包产物，验证公开 native/Web 与 mock 入口、Metro 解析和独立 Jest。原生完整构建、回调、微信／钉钉安装与真实收发、Universal Link、release 混淆仍需对应 CI 或设备验证。Mock、类型检查和 Web 构建不能证明这些结果。
