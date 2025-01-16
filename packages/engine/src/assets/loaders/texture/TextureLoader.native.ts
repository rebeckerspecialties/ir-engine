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

import { resolveAsync } from 'expo-asset-utils'
import { Image, Platform } from 'react-native'

import THREE from 'three'

export class TextureLoader extends THREE.TextureLoader {
  load(
    asset: any,
    onLoad?: (texture: THREE.Texture) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: unknown) => void
  ): THREE.Texture {
    if (!asset) {
      throw new Error('ExpoTHREE.TextureLoader.load(): Cannot parse a null asset')
    }

    const texture = new THREE.Texture()

    const loader = new THREE.ImageLoader(this.manager)
    loader.setCrossOrigin(this.crossOrigin)
    loader.setPath(this.path)
    ;(async () => {
      const nativeAsset = await resolveAsync(asset)

      function parseAsset(image) {
        texture.image = image
        texture.needsUpdate = true

        if (onLoad !== undefined) {
          onLoad(texture)
        }
      }

      if (Platform.OS === 'web') {
        loader.load(
          nativeAsset.localUri!,
          (image) => {
            parseAsset(image)
          },
          onProgress,
          onError
        )
      } else {
        if (!nativeAsset.width || !nativeAsset.height) {
          const { width, height } = await new Promise<{
            width: number
            height: number
          }>((res, rej) => {
            Image.getSize(nativeAsset.localUri!, (width: number, height: number) => res({ width, height }), rej)
          })
          nativeAsset.width = width
          nativeAsset.height = height
        }
        texture['isDataTexture'] = true // Forces passing to `gl.texImage2D(...)` verbatim

        parseAsset({
          data: nativeAsset,
          width: nativeAsset.width,
          height: nativeAsset.height
        })
      }
    })()

    return texture
  }
}
