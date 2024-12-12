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

import './engine';

import {
  UndefinedEntity,
  createEntity,
  defineSystem,
  getComponent,
  setComponent,
} from '@ir-engine/ecs';
import {ECSState} from '@ir-engine/ecs/src/ECSState';
import {Engine} from '@ir-engine/ecs/src/Engine';
import {
  defineState,
  getMutableState,
  getState,
  useImmediateEffect,
  useMutableState,
} from '@ir-engine/hyperflux';
import {EngineState} from '@ir-engine/spatial/src/EngineState';
import {CameraComponent} from '@ir-engine/spatial/src/camera/components/CameraComponent';
import {NameComponent} from '@ir-engine/spatial/src/common/NameComponent';
import {Vector3_Up} from '@ir-engine/spatial/src/common/constants/MathConstants';
import {
  destroySpatialEngine,
  initializeSpatialEngine,
} from '@ir-engine/spatial/src/initializeEngine';
import {addObjectToGroup} from '@ir-engine/spatial/src/renderer/components/GroupComponent';
import {VisibleComponent} from '@ir-engine/spatial/src/renderer/components/VisibleComponent';
import {EntityTreeComponent} from '@ir-engine/spatial/src/transform/components/EntityTree';
import {TransformComponent} from '@ir-engine/spatial/src/transform/components/TransformComponent';
import {
  TransformSystem,
  computeTransformMatrix,
} from '@ir-engine/spatial/src/transform/systems/TransformSystem';

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {BoxGeometry, Mesh, MeshBasicMaterial} from 'three';
import {createCanvasEventHandler} from './polyfill/CanvasEventHandler';
import {Dimensions, View} from 'react-native';
import {
  NativeHTMLCanvasElement,
  NativeWebGLRenderingContext,
} from './polyfill/NativeHTMLCanvasElement';
import {useEngineCanvas} from '@ir-engine/client-core-mobile/src/hooks/useEngineCanvas';
import {GLView} from 'expo-gl';
import '@ir-engine/spatial/src/input/systems/ClientInputSystem';

const SceneState = defineState({
  name: 'ee.minimalist.SceneState',
  initial: {
    entity: UndefinedEntity,
  },
});

const UpdateSystem = defineSystem({
  uuid: 'ee.minimalist.UpdateSystem',
  insert: {before: TransformSystem},
  execute: () => {
    const entity = getState(SceneState).entity;
    if (!entity) return;

    const elapsedSeconds = getState(ECSState).elapsedSeconds;
    const transformComponent = getComponent(entity, TransformComponent);
    transformComponent.rotation.setFromAxisAngle(Vector3_Up, elapsedSeconds);
  },
  reactor: function () {
    const viewerEntity = useMutableState(EngineState).viewerEntity.value;

    useEffect(() => {
      if (!viewerEntity) return;

      // Create a new entity
      const entity = createEntity();
      setComponent(entity, TransformComponent);
      setComponent(entity, EntityTreeComponent, {
        parentEntity: Engine.instance.originEntity,
      });

      // Create a box at the origin
      const mesh = new Mesh(
        new BoxGeometry(1, 1, 1),
        new MeshBasicMaterial({color: 0x00ff00}),
      );
      addObjectToGroup(entity, mesh);
      setComponent(entity, NameComponent, 'Box');
      setComponent(entity, VisibleComponent);

      // Make the camera look at the box
      const cameraTransform = getComponent(viewerEntity, TransformComponent);
      const camera = getComponent(viewerEntity, CameraComponent);
      cameraTransform.position.set(5, 2, 0);
      cameraTransform.rotation.copy(camera.quaternion);
      computeTransformMatrix(viewerEntity);
      camera.lookAt(0, 0, 0);

      getMutableState(SceneState).entity.set(entity);
    }, [viewerEntity]);

    return null;
  },
});

const {eventListenerRegistry, pointerEvents} = createCanvasEventHandler();

const {width, height} = Dimensions.get('window');
console.log(width, height);

export default function Template() {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  const onContextCreate = useCallback(
    (context: NativeWebGLRenderingContext) => {
      setCanvas(new NativeHTMLCanvasElement(context, eventListenerRegistry));
    },
    [],
  );

  useImmediateEffect(() => {
    initializeSpatialEngine();
    return () => {
      destroySpatialEngine();
    };
  }, []);

  useEngineCanvas(canvas);

  return (
    <View {...pointerEvents}>
      <GLView style={{width, height}} onContextCreate={onContextCreate} />
    </View>
  );
}
