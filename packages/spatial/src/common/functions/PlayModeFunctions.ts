/*
CPAL-1.0 License

The contents of this file are subject to the Common Public Attribution License
Version 1.0. (the "License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at
https://github.com/EtherealEngine/etherealengine/blob/dev/LICENSE.
The License is based on the Mozilla Public License Version 1.1, but Sections 14
and 15 have been added to cover use of software over a computer network and 
provide for limited attribution for the Original Developer. In addition, 
Exhibit A has been modified to be consistent with Exhibit B.

Software distributed under the License is distributed on an "AS IS" basis,
WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the
specific language governing rights and limitations under the License.

The Original Code is Ethereal Engine.

The Original Developer is the Initial Developer. The Initial Developer of the
Original Code is the Ethereal Engine team.

All portions of the code written by the Ethereal Engine team are Copyright © 2021-2023 
Ethereal Engine. All Rights Reserved.
*/

import { AuthState } from '@ir-engine/client-core/src/user/services/AuthService'
import { Engine, UUIDComponent, getComponent, removeComponent, removeEntity } from '@ir-engine/ecs'
import { TransformGizmoControlledComponent } from '@ir-engine/editor/src/classes/TransformGizmoControlledComponent'
import { EditorState } from '@ir-engine/editor/src/services/EditorServices'
import { transformGizmoControlledQuery } from '@ir-engine/editor/src/systems/GizmoSystem'
import { VisualScriptActions, visualScriptQuery } from '@ir-engine/engine'
import { AvatarComponent } from '@ir-engine/engine/src/avatar/components/AvatarComponent'
import { getRandomSpawnPoint } from '@ir-engine/engine/src/avatar/functions/getSpawnPoint'
import { spawnLocalAvatarInWorld } from '@ir-engine/engine/src/avatar/functions/receiveJoinWorld'
import { dispatchAction, getMutableState, getState } from '@ir-engine/hyperflux'
import { WorldNetworkAction } from '@ir-engine/network'
import { EngineState } from '../../EngineState'
import { FollowCameraComponent } from '../../camera/components/FollowCameraComponent'
import { TargetCameraRotationComponent } from '../../camera/components/TargetCameraRotationComponent'
import { ComputedTransformComponent } from '../../transform/components/ComputedTransformComponent'

/**
 * Returns true if we stopped play mode, false if we were not in play mode
 */
export const tryStopPlayMode = (): boolean => {
  const entity = AvatarComponent.getSelfAvatarEntity()
  if (entity) {
    dispatchAction(WorldNetworkAction.destroyEntity({ entityUUID: getComponent(entity, UUIDComponent) }))
    removeEntity(entity)
    const viewerEntity = getState(EngineState).viewerEntity
    removeComponent(viewerEntity, ComputedTransformComponent)
    removeComponent(viewerEntity, FollowCameraComponent)
    removeComponent(viewerEntity, TargetCameraRotationComponent)
    getMutableState(EngineState).isEditing.set(true)
    visualScriptQuery().forEach((entity) => dispatchAction(VisualScriptActions.stop({ entity })))
    // stop all visual script logic
  }
  return !!entity
}

export const startPlayMode = () => {
  const authState = getState(AuthState)
  // const authState = useHookstate(getMutableState(AuthState))
  const avatarDetails = authState.user.avatar //.value

  const avatarSpawnPose = getRandomSpawnPoint(Engine.instance.userID)
  const currentScene = getComponent(getState(EditorState).rootEntity, UUIDComponent)

  if (avatarDetails)
    spawnLocalAvatarInWorld({
      parentUUID: currentScene,
      avatarSpawnPose,
      avatarID: avatarDetails.id!,
      name: authState.user.name //.value
    })

  // todo
  getMutableState(EngineState).isEditing.set(false)
  // run all visual script logic
  visualScriptQuery().forEach((entity) => dispatchAction(VisualScriptActions.execute({ entity })))
  transformGizmoControlledQuery().forEach((entity) => removeComponent(entity, TransformGizmoControlledComponent))
  //just remove all gizmo in the scene
}