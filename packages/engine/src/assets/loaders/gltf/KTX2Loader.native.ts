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

import { read } from '@callstack/react-native-basis-universal'
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
