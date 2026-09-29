---
title: 测试
description: 用官方 mock 构造三态结果，并区分原生验证范围。
---

# 测试

```ts
jest.mock('@unif/react-native-umeng', () => require('@unif/react-native-umeng/mock'));
```

mock 入口隔离原生模块与 Design。独立操作是 `jest.fn`，可以显式覆盖一次调用结果：

```ts
import { share } from '@unif/react-native-umeng';
import { shareSuccess, shareCancelled, shareFailed } from '@unif/react-native-umeng/mock';

jest.mocked(share).mockResolvedValueOnce(shareSuccess('dingtalk'));
jest.mocked(share).mockResolvedValueOnce(shareCancelled());
jest.mocked(share).mockResolvedValueOnce(shareFailed({ reason: 'sdk_failed', message: 'SDK failed' }, 'dingtalk'));
```

mock 的 `useShareSheet` 返回每个 hook 自己的稳定控制器与空宿主，默认 open 返回无目标的 cancelled；消费测试可用 `jest.mocked(useShareSheet).mockReturnValue([controller, host])` 提供所需结果。

源码定向验证：

```sh
yarn test src/__tests__ --runInBand --watchman=false
yarn workspace @unif/react-native-umeng-example test --runInBand --watchman=false
yarn typecheck
yarn lint
yarn verify:consumers
```

`verify:consumers` 安装真实打包产物，验证公开 native/Web 与 mock 入口、Metro 解析和独立 Jest。原生完整构建、回调、微信／钉钉安装与真实收发、Universal Link、release 混淆仍需对应 CI 或设备验证。Mock、类型检查和 Web 构建不能证明这些结果。
