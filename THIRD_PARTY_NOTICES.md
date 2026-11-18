# 第三方组件与许可

本项目自身以 MIT 协议开源。下面这些随构建产物一起分发的第三方组件带有各自的许可要求，
完整文本见本目录下的对应文件。

| 组件 | 版本 | 许可 | 用途 | 许可文本 |
| --- | --- | --- | --- | --- |
| [`@ai-ecoverse/wasm-webrtc-audio-processing`](https://www.npmjs.com/package/@ai-ecoverse/wasm-webrtc-audio-processing) | 2.1.0-2 | BSD-3-Clause AND Apache-2.0 | WebRTC AEC3 回声消除（WASM），用于本机麦克风降噪/回声消除 | [LICENSE](wasm-webrtc-audio-processing.LICENSE.txt)、[THIRD-PARTY-NOTICES](wasm-webrtc-audio-processing.THIRD-PARTY-NOTICES.md) |

其中 wasm 由 freedesktop 的 `webrtc-audio-processing` 2.1（WebRTC AudioProcessing，BSD-3-Clause）
与 abseil-cpp（Apache-2.0）编译而来，`THIRD-PARTY-NOTICES` 列出了它链接的全部上游许可，
包括 WebRTC 的专利授权、rnnoise、pffft、Ooura FFT 等。
