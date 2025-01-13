/*
CPAL-1.0 License

The contents of this file are subject to the Common Public Attribution License
Version 1.0. (the "License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at
https://github.com/ir-engine/ir-engine/blob/dev/LICENSE.
The License is based on the Mozilla Public License Version 1.1, but Sections 14
and 15 have been added to cover use of software over a computer network and
provide for limited attribution for the Original Developer. In addition,
Exhibit A has been modified to be consistent with Exhibit B.

Software distributed under the License is distributed on an "AS IS" basis,
WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the
specific language governing rights and limitations under the License.

The Original Code is Infinite Reality Engine.

The Original Developer is the Initial Developer. The Initial Developer of the
Original Code is the Infinite Reality Engine team.

All portions of the code written by the Infinite Reality Engine team are Copyright © 2021-2023
Infinite Reality Engine. All Rights Reserved.
*/

import * as BasisModule from '@callstack/react-native-basis-universal'
import { CompressedTexture, LoadingManager, WebGLRenderer } from 'three'
import { FileLoader } from '../base/FileLoader'
import { Loader } from '../base/Loader'

export class KTX2Loader extends Loader {
  constructor(manager?: LoadingManager) {
    super(manager)
    console.warn('NATIVE KTX2 LOADER IS INITIALIZED')
    return this
  }

  setTranscoderPath(path: string): KTX2Loader {
    return this
  }
  setWorkerLimit(limit: number): KTX2Loader {
    return this
  }
  detectSupport(renderer: WebGLRenderer | null): KTX2Loader {
    return this
  }
  dispose(): KTX2Loader {
    return this
  }

  load(
    url: string,
    onLoad: (texture: CompressedTexture) => void,
    onProgress?: (requrest: ProgressEvent<EventTarget>) => void | undefined,
    onError?: ((event: ErrorEvent) => void) | undefined,
    signal?: AbortSignal
  ) {
    const loader = new FileLoader(this.manager)

    loader.setResponseType('arraybuffer')
    loader.setWithCredentials(this.withCredentials)

    loader.load(
      url,
      (buffer) => {
        this._createTexture(buffer)
          .then((texture) => (onLoad ? onLoad(texture) : null))
          .catch(onError)
      },
      onProgress,
      onError,
      signal
    )
  }

  /**
   * @param {ArrayBuffer} buffer
   * @param {object?} config
   * @return {Promise<CompressedTexture|CompressedArrayTexture|DataTexture|Data3DTexture>}
   */
  async _createTexture(buffer, config = {}) {
    const container = read(new Uint8Array(buffer))

    if (container.vkFormat !== VK_FORMAT_UNDEFINED) {
      return createRawTexture(container)
    }

    //
    const taskConfig = config
    const texturePending = this.init()
      .then(() => {
        return this.workerPool.postMessage({ type: 'transcode', buffer, taskConfig: taskConfig }, [buffer])
      })
      .then((e) => this._createTextureFrom(e.data, container))

    // Cache the task result.
    _taskCache.set(buffer, { promise: texturePending })

    return texturePending
  }
}

KTX2Loader.BasisWorker = function () {
  let config
  let transcoderPending

  const EngineFormat = _EngineFormat
  const TranscoderFormat = _TranscoderFormat
  const BasisFormat = _BasisFormat

  self.addEventListener('message', function (e) {
    const message = e.data

    switch (message.type) {
      case 'init':
        config = message.config
        init(message.transcoderBinary)
        break

      case 'transcode':
        transcoderPending.then(() => {
          try {
            const { faces, buffers, width, height, hasAlpha, format, dfdFlags } = transcode(message.buffer)

            self.postMessage(
              { type: 'transcode', id: message.id, faces, width, height, hasAlpha, format, dfdFlags },
              buffers
            )
          } catch (error) {
            console.error(error)

            self.postMessage({ type: 'error', id: message.id, error: error.message })
          }
        })
        break
    }
  })

  function init(wasmBinary) {
    transcoderPending = new Promise((resolve) => {
      // BasisModule = { wasmBinary, onRuntimeInitialized: resolve }
      // BASIS(BasisModule)
    }).then(() => {
      BasisModule.initializeBasis()

      if (BasisModule.KTX2File === undefined) {
        console.warn('THREE.KTX2Loader: Please update Basis Universal transcoder.')
      }
    })
  }

  function transcode(buffer) {
    const ktx2File = new BasisModule.KTX2File(new Uint8Array(buffer))

    function cleanup() {
      ktx2File.close()
      ktx2File.delete()
    }

    if (!ktx2File.isValid()) {
      cleanup()
      throw new Error('THREE.KTX2Loader:	Invalid or unsupported .ktx2 file')
    }

    const basisFormat = ktx2File.isUASTC() ? BasisFormat.UASTC_4x4 : BasisFormat.ETC1S
    const width = ktx2File.getWidth()
    const height = ktx2File.getHeight()
    const layerCount = ktx2File.getLayers() || 1
    const levelCount = ktx2File.getLevels()
    const faceCount = ktx2File.getFaces()
    const hasAlpha = ktx2File.getHasAlpha()
    const dfdFlags = ktx2File.getDFDFlags()

    const { transcoderFormat, engineFormat } = getTranscoderFormat(basisFormat, width, height, hasAlpha)

    if (!width || !height || !levelCount) {
      cleanup()
      throw new Error('THREE.KTX2Loader:	Invalid texture')
    }

    if (!ktx2File.startTranscoding()) {
      cleanup()
      throw new Error('THREE.KTX2Loader: .startTranscoding failed')
    }

    const faces = []
    const buffers = []

    for (let face = 0; face < faceCount; face++) {
      const mipmaps = []

      for (let mip = 0; mip < levelCount; mip++) {
        const layerMips = []

        let mipWidth, mipHeight

        for (let layer = 0; layer < layerCount; layer++) {
          const levelInfo = ktx2File.getImageLevelInfo(mip, layer, face)

          if (
            face === 0 &&
            mip === 0 &&
            layer === 0 &&
            (levelInfo.origWidth % 4 !== 0 || levelInfo.origHeight % 4 !== 0)
          ) {
            console.warn('THREE.KTX2Loader: ETC1S and UASTC textures should use multiple-of-four dimensions.')
          }

          if (levelCount > 1) {
            mipWidth = levelInfo.origWidth
            mipHeight = levelInfo.origHeight
          } else {
            // Handles non-multiple-of-four dimensions in textures without mipmaps. Textures with
            // mipmaps must use multiple-of-four dimensions, for some texture formats and APIs.
            // See mrdoob/three.js#25908.
            mipWidth = levelInfo.width
            mipHeight = levelInfo.height
          }

          const dst = new Uint8Array(ktx2File.getImageTranscodedSizeInBytes(mip, layer, 0, transcoderFormat))
          const status = ktx2File.transcodeImage(dst, mip, layer, face, transcoderFormat, 0, -1, -1)

          if (!status) {
            cleanup()
            throw new Error('THREE.KTX2Loader: .transcodeImage failed.')
          }

          layerMips.push(dst)
        }

        const mipData = concat(layerMips)

        mipmaps.push({ data: mipData, width: mipWidth, height: mipHeight })
        buffers.push(mipData.buffer)
      }

      faces.push({ mipmaps, width, height, format: engineFormat })
    }

    cleanup()

    return { faces, buffers, width, height, hasAlpha, format: engineFormat, dfdFlags }
  }

  //

  // Optimal choice of a transcoder target format depends on the Basis format (ETC1S or UASTC),
  // device capabilities, and texture dimensions. The list below ranks the formats separately
  // for ETC1S and UASTC.
  //
  // In some cases, transcoding UASTC to RGBA32 might be preferred for higher quality (at
  // significant memory cost) compared to ETC1/2, BC1/3, and PVRTC. The transcoder currently
  // chooses RGBA32 only as a last resort and does not expose that option to the caller.
  const FORMAT_OPTIONS = [
    {
      if: 'astcSupported',
      basisFormat: [BasisFormat.UASTC_4x4],
      transcoderFormat: [TranscoderFormat.ASTC_4x4, TranscoderFormat.ASTC_4x4],
      engineFormat: [EngineFormat.RGBA_ASTC_4x4_Format, EngineFormat.RGBA_ASTC_4x4_Format],
      priorityETC1S: Infinity,
      priorityUASTC: 1,
      needsPowerOfTwo: false
    },
    {
      if: 'bptcSupported',
      basisFormat: [BasisFormat.ETC1S, BasisFormat.UASTC_4x4],
      transcoderFormat: [TranscoderFormat.BC7_M5, TranscoderFormat.BC7_M5],
      engineFormat: [EngineFormat.RGBA_BPTC_Format, EngineFormat.RGBA_BPTC_Format],
      priorityETC1S: 3,
      priorityUASTC: 2,
      needsPowerOfTwo: false
    },
    {
      if: 'dxtSupported',
      basisFormat: [BasisFormat.ETC1S, BasisFormat.UASTC_4x4],
      transcoderFormat: [TranscoderFormat.BC1, TranscoderFormat.BC3],
      engineFormat: [EngineFormat.RGB_S3TC_DXT1_Format, EngineFormat.RGBA_S3TC_DXT5_Format],
      priorityETC1S: 4,
      priorityUASTC: 5,
      needsPowerOfTwo: false
    },
    {
      if: 'etc2Supported',
      basisFormat: [BasisFormat.ETC1S, BasisFormat.UASTC_4x4],
      transcoderFormat: [TranscoderFormat.ETC1, TranscoderFormat.ETC2],
      engineFormat: [EngineFormat.RGB_ETC2_Format, EngineFormat.RGBA_ETC2_EAC_Format],
      priorityETC1S: 1,
      priorityUASTC: 3,
      needsPowerOfTwo: false
    },
    {
      if: 'etc1Supported',
      basisFormat: [BasisFormat.ETC1S, BasisFormat.UASTC_4x4],
      transcoderFormat: [TranscoderFormat.ETC1],
      engineFormat: [EngineFormat.RGB_ETC1_Format],
      priorityETC1S: 2,
      priorityUASTC: 4,
      needsPowerOfTwo: false
    },
    {
      if: 'pvrtcSupported',
      basisFormat: [BasisFormat.ETC1S, BasisFormat.UASTC_4x4],
      transcoderFormat: [TranscoderFormat.PVRTC1_4_RGB, TranscoderFormat.PVRTC1_4_RGBA],
      engineFormat: [EngineFormat.RGB_PVRTC_4BPPV1_Format, EngineFormat.RGBA_PVRTC_4BPPV1_Format],
      priorityETC1S: 5,
      priorityUASTC: 6,
      needsPowerOfTwo: true
    }
  ]

  const ETC1S_OPTIONS = FORMAT_OPTIONS.sort(function (a, b) {
    return a.priorityETC1S - b.priorityETC1S
  })
  const UASTC_OPTIONS = FORMAT_OPTIONS.sort(function (a, b) {
    return a.priorityUASTC - b.priorityUASTC
  })

  function getTranscoderFormat(basisFormat, width, height, hasAlpha) {
    let transcoderFormat
    let engineFormat

    const options = basisFormat === BasisFormat.ETC1S ? ETC1S_OPTIONS : UASTC_OPTIONS

    for (let i = 0; i < options.length; i++) {
      const opt = options[i]

      if (!config[opt.if]) continue
      if (!opt.basisFormat.includes(basisFormat)) continue
      if (hasAlpha && opt.transcoderFormat.length < 2) continue
      if (opt.needsPowerOfTwo && !(isPowerOfTwo(width) && isPowerOfTwo(height))) continue

      transcoderFormat = opt.transcoderFormat[hasAlpha ? 1 : 0]
      engineFormat = opt.engineFormat[hasAlpha ? 1 : 0]

      return { transcoderFormat, engineFormat }
    }

    console.warn('THREE.KTX2Loader: No suitable compressed texture format found. Decoding to RGBA32.')

    transcoderFormat = TranscoderFormat.RGBA32
    engineFormat = EngineFormat.RGBAFormat

    return { transcoderFormat, engineFormat }
  }

  function isPowerOfTwo(value) {
    if (value <= 2) return true

    return (value & (value - 1)) === 0 && value !== 0
  }

  /** Concatenates N byte arrays. */
  function concat(arrays) {
    if (arrays.length === 1) return arrays[0]

    let totalByteLength = 0

    for (let i = 0; i < arrays.length; i++) {
      const array = arrays[i]
      totalByteLength += array.byteLength
    }

    const result = new Uint8Array(totalByteLength)

    let byteOffset = 0

    for (let i = 0; i < arrays.length; i++) {
      const array = arrays[i]
      result.set(array, byteOffset)

      byteOffset += array.byteLength
    }

    return result
  }
}
