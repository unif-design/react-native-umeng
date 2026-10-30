# react-native-umeng 开发资料

本仓库维护 `@unif/react-native-umeng`，职责为初始化、分享与统计库。

## 库能力技能

使用 `unif-umeng` 定位本库当前版本的公开能力、接入与排障资料。应用仅消费库时可直接查公开类型和文档。

维护工程按职责采用独立的通用技能：`code-organization` 负责跨平台目录与文件组织，`react-native-development` 负责 React Native 实现，`react-native-library` 负责库工程和分发产物，`documentation` 负责文档与文档站。设计、测试、审查与交付继续从 [AGENTS.md](../AGENTS.md) 取得适用入口，本文只补充本库的契约和接线。

## 目标契约

[本库新版本设计](../../unif-platform-architecture/libraries/react-native-umeng.md)定义职责、公共输入输出、状态和验证边界；[库版本原则](../../unif-platform-architecture/libraries/README.md)明确新旧版本独立。规范根默认是并列的 `unif-platform-architecture` 工作区，其他目录布局由任务提供实际位置。

目标契约用于新版本开发；当前可用接口以实际源码和发布版本为准。版本采用原则在上述库设计索引维护。

## 开发起点

先实现初始化与 share 的独立操作，再组合实例内的分享面板；统计单独验证。按新目标移除旧命名空间和仅保存配置的公开预初始化步骤。

当前可定位的源码与验证入口：

- [公共源码入口](../src/index.ts)
- [初始化](../src/common.ts)
- [分享](../src/share.ts)
- [统计](../src/analytics.ts)
- [单元测试](../src/__tests__/)

命令与依赖版本以 [package.json](../package.json)、锁文件及实际安装为准，验证接线见 [.github/workflows](../.github/workflows/)。本文件不复制通用开发、测试或交付规则；按 AGENTS.md 的阶段技能取得所需规范。

历史 spec、plan 和审查记录用于溯源，不作为当前使用文档或新需求入口。

## LLM 文档生成

`website/docs` 是使用文档源；运行 `node website/scripts/build-llms.js` 可单独生成。共同实现由组织 `templates/llms` 分发，维护源后使用 `sync-llms.cjs` 同步，不手改生成副本。

索引按任务列出单页，全文位于 Optional；包版本取当前 package.json。`node website/scripts/build-llms.test.js` 验证公共生成契约与本库资料，文档站构建沿既有 CI 运行。

## RN 0.88 验证入口

[开发基线与覆盖率](rn88-coverage.md)记录正式依赖、完整源码分母、原生插桩与 example 宿主边界。标准 `yarn test --coverage` 强制库与 example 的 JS/TS 四项 100%；原生检查接入本库 `.github/ci` 钩子。

## 共享主题接入

分享面板使用 Design 的主题、字体、Cell 和玻璃材质，微信与钉钉图形保留品牌颜色。主题、字号和减少透明度设置只改变呈现，不重新发现平台或发起分享；结果仍由原分享操作交付。
