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

import { VRMHumanBoneList } from '@pixiv/three-vrm'
import { useEffect } from 'react'
import { AnimationClip, AnimationMixer, Group, MathUtils, Matrix4, Quaternion, Vector3 } from 'three'

import {
  defineQuery,
  defineSystem,
  ECSState,
  Entity,
  getComponent,
  getOptionalComponent,
  hasComponent,
  setComponent,
  useComponent,
  useOptionalComponent,
  useQuery
} from '@ir-engine/ecs'
import { defineState, getMutableState, getState } from '@ir-engine/hyperflux'
import { NetworkObjectComponent } from '@ir-engine/network'
import {
  createPriorityQueue,
  createSortAndApplyPriorityQueue
} from '@ir-engine/spatial/src/common/functions/PriorityQueue'
import { RigidBodyComponent } from '@ir-engine/spatial/src/physics/components/RigidBodyComponent'
import { compareDistanceToCamera } from '@ir-engine/spatial/src/transform/components/DistanceComponents'
import { TransformComponent } from '@ir-engine/spatial/src/transform/components/TransformComponent'
import { TransformSystem } from '@ir-engine/spatial/src/transform/TransformModule'
import { XRLeftHandComponent, XRRightHandComponent } from '@ir-engine/spatial/src/xr/XRComponents'
import { XRState } from '@ir-engine/spatial/src/xr/XRState'

import { NameComponent } from '@ir-engine/spatial/src/common/NameComponent'
import { BoneComponent } from '@ir-engine/spatial/src/renderer/components/BoneComponent'
import { ObjectLayerMaskComponent } from '@ir-engine/spatial/src/renderer/components/ObjectLayerComponent'
import { SkinnedMeshComponent } from '@ir-engine/spatial/src/renderer/components/SkinnedMeshComponent'
import { ObjectLayerMasks } from '@ir-engine/spatial/src/renderer/constants/ObjectLayers'
import { EntityTreeComponent, traverseEntityNode } from '@ir-engine/spatial/src/transform/components/EntityTree'
import React from 'react'
import { DomainConfigState } from '../../assets/state/DomainConfigState'
import { GLTFComponent } from '../../gltf/GLTFComponent'
import { addError, removeError } from '../../scene/functions/ErrorFunctions'
import { applyHandRotationFK } from '../animation/applyHandRotationFK'
import { getRootSpeed, updateAnimationGraph } from '../animation/AvatarAnimationGraph'
import { getArmIKHint } from '../animation/getArmIKHint'
import { blendIKChain, solveTwoBoneIK } from '../animation/TwoBoneIKSolver'
import { ikTargets, preloadedAnimations } from '../animation/Util'
import { AnimationState } from '../AnimationManager'
import { mixamoVRMRigMap } from '../AvatarBoneMatching'
import { AnimationComponent, useLoadAnimationFromBatchGLTF } from '../components/AnimationComponent'
import { AvatarAnimationComponent, AvatarRigComponent, createVRM } from '../components/AvatarAnimationComponent'
import { AvatarComponent } from '../components/AvatarComponent'
import { AvatarIKTargetComponent } from '../components/AvatarIKComponents'
import { NormalizedBoneComponent } from '../components/NormalizedBoneComponent'
import { getAllLoadedAnimations, setupAvatarProportions } from '../functions/avatarFunctions'
import { normalizeAnimationClips, retargetAnimationClips } from '../functions/retargetingFunctions'
import { updateVRMRetargeting } from '../functions/updateVRMRetargeting'
import { AvatarMovementSettingsState } from '../state/AvatarMovementSettingsState'
import { AnimationSystem } from './AnimationSystem'

export const AvatarAnimationState = defineState({
  name: 'AvatarAnimationState',
  initial: () => {
    const accumulationBudget = 100 //isMobileXRHeadset ? 2 : 6

    const priorityQueue = createPriorityQueue({
      accumulationBudget
    })

    return {
      priorityQueue,
      sortedTransformEntities: [] as Entity[],
      visualizers: [] as Entity[]
    }
  }
})

const avatarAnimationQuery = defineQuery([AnimationComponent, AvatarAnimationComponent, AvatarRigComponent])
const avatarComponentQuery = defineQuery([AvatarComponent, RigidBodyComponent, AvatarAnimationComponent])
const avatarRigQuery = defineQuery([AvatarRigComponent])

const _quat = new Quaternion()
const _quat2 = new Quaternion()
const _vector3 = new Vector3()
const _hint = new Vector3()
const mat4 = new Matrix4()
const hipsForward = new Vector3(0, 0, 1)

const sortAndApplyPriorityQueue = createSortAndApplyPriorityQueue(avatarComponentQuery, compareDistanceToCamera)

const execute = () => {
  const { priorityQueue, sortedTransformEntities, visualizers } = getState(AvatarAnimationState)
  const { elapsedSeconds, deltaSeconds } = getState(ECSState)

  const selfAvatarEntity = AvatarComponent.getSelfAvatarEntity()

  /** Calculate avatar locomotion animations outside of priority queue */

  for (const entity of avatarComponentQuery()) {
    const avatarAnimationComponent = getComponent(entity, AvatarAnimationComponent)
    const rigidbodyComponent = getComponent(entity, RigidBodyComponent)
    // TODO: use x locomotion for side-stepping when full 2D blending spaces are implemented
    avatarAnimationComponent.locomotion.x = 0
    avatarAnimationComponent.locomotion.y = rigidbodyComponent.linearVelocity.y
    // lerp animated forward animation to smoothly animate to a stop
    avatarAnimationComponent.locomotion.z = MathUtils.lerp(
      avatarAnimationComponent.locomotion.z || 0,
      _vector3.copy(rigidbodyComponent.linearVelocity).setComponent(1, 0).length(),
      10 * deltaSeconds
    )
  }

  /**
   * 1 - Sort & apply avatar priority queue
   */
  sortAndApplyPriorityQueue(priorityQueue, sortedTransformEntities, deltaSeconds)

  /**
   * 2 - Apply avatar animations
   */
  const avatarAnimationQueryArr = avatarAnimationQuery()
  const avatarAnimationEntities: Entity[] = []
  for (let i = 0; i < avatarAnimationQueryArr.length; i++) {
    const _entity = avatarAnimationQueryArr[i]
    if (priorityQueue.priorityEntities.has(_entity) || _entity === selfAvatarEntity) {
      avatarAnimationEntities.push(_entity)
    }
  }

  updateAnimationGraph(avatarAnimationEntities)

  for (const entity of avatarAnimationEntities) {
    const rigComponent = getComponent(entity, AvatarRigComponent)
    const avatarComponent = getComponent(entity, AvatarComponent)

    const rig = rigComponent.bonesToEntities

    if (!rig.hips) continue

    const ownerID = getComponent(entity, NetworkObjectComponent).ownerId
    const leftFoot = AvatarIKTargetComponent.getTargetEntity(ownerID, ikTargets.leftFoot)
    const leftFootTransform = getOptionalComponent(leftFoot, TransformComponent)
    const leftFootTargetBlendWeight = AvatarIKTargetComponent.blendWeight[leftFoot]

    const rightFoot = AvatarIKTargetComponent.getTargetEntity(ownerID, ikTargets.rightFoot)
    const rightFootTransform = getOptionalComponent(rightFoot, TransformComponent)
    const rightFootTargetBlendWeight = AvatarIKTargetComponent.blendWeight[rightFoot]

    const leftHand = AvatarIKTargetComponent.getTargetEntity(ownerID, ikTargets.leftHand)
    const leftHandTransform = getOptionalComponent(leftHand, TransformComponent)
    const leftHandTargetBlendWeight = AvatarIKTargetComponent.blendWeight[leftHand]

    const rightHand = AvatarIKTargetComponent.getTargetEntity(ownerID, ikTargets.rightHand)
    const rightHandTransform = getOptionalComponent(rightHand, TransformComponent)
    const rightHandTargetBlendWeight = AvatarIKTargetComponent.blendWeight[rightHand]

    const head = AvatarIKTargetComponent.getTargetEntity(ownerID, ikTargets.head)
    const headTargetBlendWeight = AvatarIKTargetComponent.blendWeight[head]

    const transform = getComponent(entity, TransformComponent)

    const rigidbodyComponent = getComponent(entity, RigidBodyComponent)

    if (headTargetBlendWeight) {
      const headTransform = getComponent(head, TransformComponent)
      const normalizedHips = getComponent(rig.hips, NormalizedBoneComponent)

      normalizedHips.position.set(
        headTransform.position.x,
        headTransform.position.y - avatarComponent.torsoLength - 0.125,
        headTransform.position.z
      )

      //offset target forward to account for hips being behind the head
      hipsForward.set(0, 0, 1)
      hipsForward.applyQuaternion(rigidbodyComponent.rotation)
      hipsForward.multiplyScalar(0.125)
      normalizedHips.position.sub(hipsForward)

      // convert to local space
      normalizedHips.position.applyMatrix4(mat4.copy(transform.matrixWorld).invert())

      _quat2.copy(headTransform.rotation)

      //calculate head look direction and apply to head bone
      //look direction should be set outside of the xr switch
      getComponent(rig.head, NormalizedBoneComponent).quaternion.multiplyQuaternions(
        getComponent(rig.spine, NormalizedBoneComponent).getWorldQuaternion(_quat).invert(),
        _quat2
      )

      const hips = getComponent(rig.hips, BoneComponent)
      /** Place normalized rig in world space for ik calculations */
      const newWorldMatrix = transform.matrixWorld.clone()
      newWorldMatrix.elements[13] = hips.position.y - transform.position.y
      normalizedHips.matrix.setPosition(new Vector3())
      normalizedHips.matrixWorld.multiplyMatrices(newWorldMatrix, normalizedHips.matrix)
      normalizedHips.matrixWorld.scale(new Vector3(100, 100, 100))
      for (const boneName of VRMHumanBoneList) {
        const bone = getComponent(rigComponent.bonesToEntities[boneName], NormalizedBoneComponent)
        if (!bone) continue
        bone.scale.setScalar(1)
        bone.updateMatrix()
        if (boneName === 'hips') continue
        bone.updateMatrixWorld()
        const worldMatrix = getComponent(rig[boneName], BoneComponent).matrixWorld.elements
        bone.matrixWorld.elements[13] = worldMatrix[13]
        bone.matrixWorld.elements[12] = worldMatrix[12]
        bone.matrixWorld.elements[14] = worldMatrix[14]
      }
    }

    if (rightHandTargetBlendWeight && rightHandTransform) {
      getArmIKHint(
        entity,
        rightHandTransform.position,
        rightHandTransform.rotation,
        getComponent(rig.rightUpperArm, BoneComponent).getWorldPosition(_vector3),
        'right',
        _hint
      )

      const upperArmEntity = getComponent(rig.rightUpperArm, EntityTreeComponent).parentEntity
      solveTwoBoneIK(
        getComponent(upperArmEntity, NormalizedBoneComponent).matrixWorld,
        rigComponent.ikMatrices.rightUpperArm!,
        rigComponent.ikMatrices.rightLowerArm!,
        rigComponent.ikMatrices.rightHand!,
        rightHandTransform.position,
        rightHandTransform.rotation,
        _hint
      )

      blendIKChain(entity, ['rightUpperArm', 'rightLowerArm', 'rightHand'], rightHandTargetBlendWeight)
    }

    if (leftHandTargetBlendWeight && leftHandTransform) {
      getArmIKHint(
        entity,
        leftHandTransform.position,
        leftHandTransform.rotation,
        getComponent(rig.leftUpperArm, BoneComponent).getWorldPosition(_vector3),
        'left',
        _hint
      )

      const upperArmEntity = getComponent(rig.leftUpperArm, EntityTreeComponent).parentEntity
      solveTwoBoneIK(
        getComponent(upperArmEntity, NormalizedBoneComponent).matrixWorld,
        rigComponent.ikMatrices.leftUpperArm!,
        rigComponent.ikMatrices.leftLowerArm!,
        rigComponent.ikMatrices.leftHand!,
        leftHandTransform.position,
        leftHandTransform.rotation,
        _hint
      )

      blendIKChain(entity, ['leftUpperArm', 'leftLowerArm', 'leftHand'], leftHandTargetBlendWeight)
    }

    if (rightFootTargetBlendWeight && rightFootTransform) {
      _hint
        .set(-avatarComponent.footGap * 1.5, 0, 1)
        .applyQuaternion(transform.rotation)
        .add(transform.position)

      solveTwoBoneIK(
        getComponent(rig.hips, NormalizedBoneComponent).matrixWorld,
        rigComponent.ikMatrices.rightUpperLeg!,
        rigComponent.ikMatrices.rightLowerLeg!,
        rigComponent.ikMatrices.rightFoot!,
        rightFootTransform.position,
        rightFootTransform.rotation,
        _hint
      )

      blendIKChain(entity, ['rightUpperLeg', 'rightLowerLeg', 'rightFoot'], rightFootTargetBlendWeight)
    }

    if (leftFootTargetBlendWeight && leftFootTransform) {
      _hint
        .set(-avatarComponent.footGap * 1.5, 0, 1)
        .applyQuaternion(transform.rotation)
        .add(transform.position)

      solveTwoBoneIK(
        getComponent(rig.hips, NormalizedBoneComponent).matrixWorld,
        rigComponent.ikMatrices.leftUpperLeg!,
        rigComponent.ikMatrices.leftLowerLeg!,
        rigComponent.ikMatrices.leftFoot!,
        leftFootTransform.position,
        leftFootTransform.rotation,
        _hint
      )

      blendIKChain(entity, ['leftUpperLeg', 'leftLowerLeg', 'leftFoot'], leftFootTargetBlendWeight)
    }

    if (hasComponent(entity, XRRightHandComponent)) {
      applyHandRotationFK(entity, 'right', getComponent(entity, XRRightHandComponent).rotations)
    }

    if (hasComponent(entity, XRLeftHandComponent)) {
      applyHandRotationFK(entity, 'left', getComponent(entity, XRLeftHandComponent).rotations)
    }
  }

  for (const entity of avatarRigQuery()) updateVRMRetargeting(entity)
}

const Reactor = () => {
  const selfAvatarEntity = AvatarComponent.useSelfAvatarEntity()
  const selfAvatarLoaded = useOptionalComponent(selfAvatarEntity, GLTFComponent)?.progress?.value === 100

  useEffect(() => {
    if (!selfAvatarLoaded) {
      XRState.setTrackingSpace()
      return
    }
    const eyeHeight = getComponent(selfAvatarEntity, AvatarComponent).eyeHeight
    getMutableState(XRState).userEyeHeight.set(eyeHeight)
    XRState.setTrackingSpace()
  }, [selfAvatarLoaded])

  return null
}

/**
 * @todo replace this with a retargeting utility to retarget the source animation assets rather than every time on load,
 * and introduce a loader function that only loads the necessary data to avoid cleanup of the ecs armature
 */
export const setupMixamoAnimation = (entity: Entity) => {
  normalizeAnimationClips(entity)
  setComponent(entity, AvatarRigComponent)
  traverseEntityNode(entity, (child) => {
    const name = getComponent(child, NameComponent).replace(':', '')
    if (mixamoVRMRigMap[name]) AvatarRigComponent.setBone(entity, child, mixamoVRMRigMap[name])
  })
  retargetAnimationClips(entity)
}

const runClipName = 'Run_RootMotion',
  walkClipName = 'Walk_RootMotion'
const AnimationLoader = () => {
  const animations = [preloadedAnimations.locomotion, preloadedAnimations.emotes]

  const loadedAnimations = useLoadAnimationFromBatchGLTF(
    animations.map((animationFile) => {
      return `${
        getState(DomainConfigState).cloudDomain
      }/projects/ir-engine/default-project/assets/animations/${animationFile}.glb`
    }),
    true
  )

  useEffect(() => {
    if (!loadedAnimations.value) return

    let i = 0
    for (const [clips, entity] of loadedAnimations.value as [AnimationClip[] | null, Entity][]) {
      if (getState(AnimationState).loadedAnimations[animations[i]]) continue

      setupMixamoAnimation(entity)

      /** @todo handle avatar animation clips generically */
      const run = AnimationClip.findByName(clips ?? [], runClipName)
      const walk = AnimationClip.findByName(clips ?? [], walkClipName)

      const movement = getMutableState(AvatarMovementSettingsState)
      if (run) movement.runSpeed.set(getRootSpeed(run))
      if (walk) movement.walkSpeed.set(getRootSpeed(walk))

      getMutableState(AnimationState).loadedAnimations[animations[i]].set(entity!)
      i++
    }
  }, [loadedAnimations.value])

  return null
}

const RigReactor = (props: { entity: Entity }) => {
  const entity = props.entity
  const gltfComponent = useOptionalComponent(entity, GLTFComponent)
  const avatarAnimationComponent = useOptionalComponent(entity, AvatarAnimationComponent)
  useEffect(() => {
    if (gltfComponent?.progress?.value !== 100 || !avatarAnimationComponent?.value) return
    try {
      createVRM(entity)
      setComponent(entity, ObjectLayerMaskComponent, ObjectLayerMasks.Avatars)
      setupAvatarProportions(entity)
    } catch (e) {
      console.error('Failed to load avatar', e)
      addError(entity, AvatarRigComponent, 'UNSUPPORTED_AVATAR')
      return () => {
        removeError(entity, AvatarRigComponent, 'UNSUPPORTED_AVATAR')
      }
    }
  }, [gltfComponent?.progress?.value, gltfComponent?.src.value, avatarAnimationComponent])

  return null
}

const AnimationReactor = (props: { entity: Entity }) => {
  const entity = props.entity
  const rigComponent = useComponent(entity, AvatarRigComponent)
  useEffect(() => {
    if (!Object.values(rigComponent.entitiesToBones).length || !rigComponent.vrm.scene.value) return
    setComponent(entity, AnimationComponent, {
      animations: getAllLoadedAnimations(),
      mixer: new AnimationMixer(rigComponent.vrm.scene.value as Group)
    })
  }, [entity, rigComponent.entitiesToBones, rigComponent.vrm.scene])
  return null
}

export const AvatarAnimationSystem = defineSystem({
  uuid: 'ee.engine.AvatarAnimationSystem',
  insert: { after: AnimationSystem },
  execute,
  reactor: () => {
    const rigEntities = useQuery([AvatarRigComponent])
    const avatarAnimationEntities = useQuery([AvatarAnimationComponent, AvatarComponent, AvatarRigComponent])
    return (
      <>
        <Reactor />
        {rigEntities.length > 0 && <AnimationLoader />}
        <>
          {rigEntities.map((entity: Entity) => (
            <RigReactor entity={entity} key={entity} />
          ))}
          {avatarAnimationEntities.map((entity: Entity) => (
            <AnimationReactor entity={entity} key={entity} />
          ))}
        </>
      </>
    )
  }
})

const skinnedMeshQuery = defineQuery([SkinnedMeshComponent])

const updateSkinnedMeshes = () => {
  for (const entity of skinnedMeshQuery()) {
    const skinnedMesh = getComponent(entity, SkinnedMeshComponent)
    if (skinnedMesh.bindMode === 'attached') {
      skinnedMesh.bindMatrixInverse.copy(skinnedMesh.matrixWorld).invert()
    } else if (skinnedMesh.bindMode === 'detached') {
      skinnedMesh.bindMatrixInverse.copy(skinnedMesh.bindMatrix).invert()
    } else {
      console.warn('THREE.SkinnedMesh: Unrecognized bindMode: ' + skinnedMesh.bindMode)
    }
  }
}

export const SkinnedMeshTransformSystem = defineSystem({
  uuid: 'ee.engine.SkinnedMeshTransformSystem',
  insert: { after: TransformSystem },
  execute: updateSkinnedMeshes
})
