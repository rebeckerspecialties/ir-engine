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

import { useEffect } from 'react'

import { LocationService, LocationState } from '@ir-engine/client-core/src/social/services/LocationService'
import { useGet } from '@ir-engine/common'
import { staticResourcePath } from '@ir-engine/common/src/schema.type.module'
import { GLTFAssetState } from '@ir-engine/engine/src/gltf/GLTFState'
import { getMutableState, getState, useMutableState } from '@ir-engine/hyperflux'

import { ClientContextState } from '@ir-engine/client-core/src/util/ClientContextState'

import { DomainConfigState } from '@ir-engine/engine/src/assets/state/DomainConfigState'

export const useLoadLocation = (props: { locationName: string }) => {
  const locationState = useMutableState(LocationState)
  const scene = useGet(staticResourcePath, locationState.currentLocation.location.sceneId.value).data

  ClientContextState.useValue('location_id', locationState.currentLocation.location.id.value)
  ClientContextState.useValue('project_id', locationState.currentLocation.location.projectId.value)

  useEffect(() => {
    LocationState.setLocationName(props.locationName)
    if (locationState.locationName.value) LocationService.getLocationByName(locationState.locationName.value)
  }, [])

  useEffect(() => {
    if (locationState.invalidLocation.value) {
      alert('Invalid location')
    }
  }, [locationState.invalidLocation])

  // useEffect(() => {
  //   if (locationState.currentLocation.selfNotAuthorized.value) {
  //     WarningUIService.openWarning({
  //       title: t('common:instanceServer.notAuthorizedAtLocationTitle'),
  //       body: t('common:instanceServer.notAuthorizedAtLocation'),
  //       action: () => RouterState.navigate('/')
  //     })
  //   }
  // }, [locationState.currentLocation.selfNotAuthorized])

  /**
   * Once we have the location, fetch the current scene data
   */
  useEffect(() => {
    if (
      !locationState.currentLocation.location.sceneId.value ||
      locationState.invalidLocation.value ||
      locationState.currentLocation.selfNotAuthorized.value ||
      !locationState.currentLocation.location.sceneURL.value
    )
      return
    const sceneURL = locationState.currentLocation.location.sceneURL.value
    const sceneID = locationState.currentLocation.location.sceneId.value
    return GLTFAssetState.loadScene(sceneURL, sceneID)
  }, [locationState.currentLocation.location.sceneId, locationState.currentLocation.location.sceneURL])
}

export const useLoadScene = (props: { projectName: string; sceneName: string }) => {
  useEffect(() => {
    if (!props.sceneName || !props.projectName) return
    const key = `${props.projectName}/${props.sceneName}`
    const url = getState(DomainConfigState).cloudDomain + `/projects/${key}`
    getMutableState(LocationState).currentLocation.location.sceneId.set(key)
    getMutableState(LocationState).currentLocation.location.sceneURL.set(url)
    const unload = GLTFAssetState.loadScene(url, key)
    return () => {
      getMutableState(LocationState).currentLocation.location.sceneId.set('')
      getMutableState(LocationState).currentLocation.location.sceneURL.set('')
      unload()
    }
  }, [])
}