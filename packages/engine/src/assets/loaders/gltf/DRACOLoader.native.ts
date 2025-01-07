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

import { DracoDecoderModule, GeometryAttribute } from '@callstack/react-native-draco'
import { BufferAttribute, BufferGeometry, Loader, LoadingManager } from 'three'

const defaultAttributeIDs = {
  position: 'POSITION',
  normal: 'NORMAL',
  color: 'COLOR',
  uv: 'TEX_COORD'
}

export class DRACOLoader extends Loader {
  dracoDecoder = DracoDecoderModule()

  constructor(manager?: LoadingManager) {
    super(manager)
  }

  load(
    url: string,
    onLoad: (geometry: BufferGeometry) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void,
    signal?: AbortSignal
  ): void {
    console.log('[DracoLoaderNative] loading:', url)
  }

  setDecoderPath(path: string): DRACOLoader {
    // no-op
    return this
  }

  setDecoderConfig(config: object): DRACOLoader {
    // no-op
    return this
  }

  setWorkerLimit(workerLimit: number): DRACOLoader {
    // no-op
    return this
  }

  getDecoderModule(): Promise<any> {
    return this.dracoDecoder
  }

  getEncoderModule(): Promise<any> {
    return Promise.resolve()
  }

  preload(): DRACOLoader {
    return this
  }

  dispose(): DRACOLoader {
    return this
  }

  decodeDracoFile(
    arrayBuffer: ArrayBuffer,
    callback: (geometry: BufferGeometry) => void,
    attributeIDs,
    attributeTypes
  ): void {
    const buffer = new this.dracoDecoder.DecoderBuffer()
    const decoder = new this.dracoDecoder.Decoder()

    buffer.Init(new Int8Array(arrayBuffer), arrayBuffer.byteLength)

    const taskConfig = {
      useUniqueIDs: false
    }

    /*
     * Determine what type is this file: mesh or point cloud.
     */

    let dracoGeometry

    const geometryType = decoder.GetEncodedGeometryType(buffer)
    let status
    if (geometryType == this.dracoDecoder.TRIANGULAR_MESH) {
      console.log('Loaded a mesh.')
      dracoGeometry = new this.dracoDecoder.Mesh()
      status = decoder.DecodeBufferToMesh(buffer, dracoGeometry)
    } else if (geometryType == this.dracoDecoder.POINT_CLOUD) {
      console.log('Loaded a point cloud.')
      dracoGeometry = new this.dracoDecoder.PointCloud()
      status = decoder.DecodeBufferToPointCloud(buffer, dracoGeometry)
    } else {
      const errorMsg = 'DracoNativeLoader: Unknown geometry type.'
      console.error(errorMsg)
      throw new Error(errorMsg)
    }

    console.log('[DracoLoaderNative] finished decoding. Number of points in model:', dracoGeometry.num_points())

    const geometry = { index: null, attributes: [] }

    // Gather all vertex attributes.
    for (const attributeName in attributeIDs) {
      const attributeType = self[attributeTypes[attributeName]]

      let attribute
      let attributeID

      // A Draco file may be created with default vertex attributes, whose attribute IDs
      // are mapped 1:1 from their semantic name (POSITION, NORMAL, ...). Alternatively,
      // a Draco file may contain a custom set of attributes, identified by known unique
      // IDs. glTF files always do the latter, and `.drc` files typically do the former.
      if (taskConfig.useUniqueIDs) {
        attributeID = attributeIDs[attributeName]
        attribute = decoder.GetAttributeByUniqueId(dracoGeometry, attributeID)
      } else {
        attributeID = decoder.GetAttributeId(
          dracoGeometry,
          // @ts-ignore
          GeometryAttribute[defaultAttributeIDs[attributeName]]
        )

        if (attributeID === -1) continue

        attribute = decoder.GetAttribute(dracoGeometry, attributeID)
      }
      const dataType = attribute.data_type()

      geometry.attributes.push(this.decodeAttribute(decoder, dracoGeometry, attributeName, dataType, attribute))
    }

    // Add index.
    if (geometryType === this.dracoDecoder.TRIANGULAR_MESH) {
      geometry.index = this.decodeIndex(decoder, dracoGeometry)
    }

    callback(this._createGeometry(geometry))
  }

  decodeIndex(decoder, dracoGeometry) {
    const numFaces = dracoGeometry.num_faces()
    const numIndices = numFaces * 3
    const byteLength = numIndices * 4

    // NOTE: This API is different from Draco.js api as it relied on wasm memory. Has to be adjusted in IR-Engine.
    const outputArray = new Uint32Array(byteLength)
    decoder.GetTrianglesUInt32Array(dracoGeometry, byteLength, outputArray)

    return { array: outputArray, itemSize: 1 }
  }

  decodeAttribute(decoder, dracoGeometry, attributeName, attributeType, attribute) {
    const numComponents = attribute.num_components()
    const numPoints = dracoGeometry.num_points()
    const numValues = numPoints * numComponents
    const byteLength = numValues * attributeType.BYTES_PER_ELEMENT
    // const dataType = getDracoDataType(draco, attributeType)

    const outputArray = new Float32Array(numValues)

    // NOTE: This API is different from Draco.js api as it relied on wasm memory. Has to be adjusted in IR-Engine.
    decoder.GetAttributeDataArrayForAllPoints(dracoGeometry, attribute, attributeType, byteLength, outputArray)

    return {
      name: attributeName,
      array: outputArray,
      itemSize: numComponents
    }
  }

  _createGeometry(geometryData) {
    const geometry = new BufferGeometry()

    if (geometryData.index) {
      geometry.setIndex(new BufferAttribute(geometryData.index.array, 1))
    }

    for (let i = 0; i < geometryData.attributes.length; i++) {
      const attribute = geometryData.attributes[i]
      const name = attribute.name
      const array = attribute.array
      const itemSize = attribute.itemSize

      geometry.setAttribute(name, new BufferAttribute(array, itemSize))
    }

    return geometry
  }
}
