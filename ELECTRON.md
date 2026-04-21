# Electron 桌面应用打包说明

## 一、安装依赖

```bash
npm install
```

## 二、准备图标（可选）

将图标文件放到 `public/` 目录：
- Windows: `icon.ico` (256x256)
- macOS: `icon.icns` (512x512)

如果没有图标，会使用默认图标。

## 三、打包命令

### Windows 绿色版（推荐）
```bash
npm run electron:build:win
```

输出文件：`release/ScaleUp Packet Parser-1.0.0-Portable.exe`

### macOS
```bash
npm run electron:build:mac
```

### 全平台
```bash
npm run electron:build:all
```

## 四、输出目录

```
release/
├── ScaleUp Packet Parser-1.0.0-Portable.exe  # Windows 绿色版
├── ScaleUp Packet Parser Setup 1.0.0.exe     # Windows 安装包
└── ScaleUp Packet Parser-1.0.0.dmg           # macOS 安装包
```

## 五、使用方式

### Windows 绿色版
1. 双击 `ScaleUp Packet Parser-1.0.0-Portable.exe`
2. 无需安装，直接运行
3. 可复制到任意位置使用

### Windows 安装版
1. 双击 `ScaleUp Packet Parser Setup 1.0.0.exe`
2. 按提示安装
3. 安装后从开始菜单启动

## 六、统计功能

桌面版使用本地文件存储统计数据：
- 位置：`%APPDATA%/packet-parser/stats.json`
- 每次解析自动记录
- 支持按协议、时间统计

## 七、开发调试

```bash
# 启动开发模式
npm run electron:dev
```
