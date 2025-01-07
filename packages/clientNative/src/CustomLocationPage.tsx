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
All portions of the code written by the Infinite Reality Engine team are Copyright � 2021-2023
Infinite Reality Engine. All Rights Reserved.
*/

import './engine';

import {
  EntityUUID,
  UUIDComponent,
  UndefinedEntity,
  createEntity,
  defineSystem,
  getComponent,
  setComponent,
} from '@ir-engine/ecs';
import {
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
import {VisibleComponent} from '@ir-engine/spatial/src/renderer/components/VisibleComponent';
import {EntityTreeComponent} from '@ir-engine/spatial/src/transform/components/EntityTree';
import {TransformComponent} from '@ir-engine/spatial/src/transform/components/TransformComponent';
import {
  TransformSystem,
  computeTransformMatrix,
} from '@ir-engine/spatial/src/transform/systems/TransformSystem';

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Color, Euler, Quaternion, Vector3} from 'three';
import {Dimensions, PanResponder, View} from 'react-native';
import {
  NativeHTMLCanvasElement,
  NativeWebGLRenderingContext,
} from './polyfill/NativeHTMLCanvasElement';
import {useEngineCanvas} from '@ir-engine/client-core-mobile/src/hooks/useEngineCanvas';
import {GLView} from 'expo-gl';
import config from '@ir-engine/common/src/config';
import {GLTFAssetState} from '@ir-engine/engine/src/gltf/GLTFState';
import {DirectionalLightComponent} from '@ir-engine/spatial';
import {createCanvasEventHandler} from './polyfill/CanvasEventHandler';

const defaultSource =
  config.client.fileServer +
  '/projects/ir-engine/default-project/assets/rings.glb';

const {eventListenerRegistry, pointerEvents} = createCanvasEventHandler();

defineSystem({
  uuid: 'ee.minimalist.UpdateSystem',
  insert: {before: TransformSystem},
  reactor: function () {
    const viewerEntity = useMutableState(EngineState).viewerEntity.value;

    useEffect(() => {
      if (!viewerEntity) return;

      const cameraTransform = getComponent(viewerEntity, TransformComponent);
      const camera = getComponent(viewerEntity, CameraComponent);
      cameraTransform.position.set(5, 2, 0);
      computeTransformMatrix(viewerEntity);
      camera.lookAt(0, 0, 0);

      // Add some light
      const entity = createEntity();
      setComponent(entity, UUIDComponent, 'directional light' as EntityUUID);
      setComponent(entity, NameComponent, 'Directional Light');
      setComponent(entity, TransformComponent, {
        rotation: new Quaternion().setFromEuler(new Euler(2, 5, 3)),
      });
      setComponent(entity, EntityTreeComponent, {
        parentEntity: getState(EngineState).originEntity,
      });
      setComponent(entity, VisibleComponent, true);
      setComponent(entity, DirectionalLightComponent, {
        color: new Color('white'),
        intensity: 1,
      });

      const ret = GLTFAssetState.loadScene(defaultSource, defaultSource);

      return () => {
        ret();
      };
    }, [viewerEntity]);

    return null;
  },
});

const {width, height} = Dimensions.get('window');

export default function Template() {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const lastPos = useRef({x: 0, y: 0});
  const isDragging = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        isDragging.current = true;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (!isDragging.current) return;

        const deltaX = gestureState.dx - lastPos.current.x;
        const deltaY = gestureState.dy - lastPos.current.y;

        const engineState = getMutableState(EngineState);
        const viewerEntity = engineState.viewerEntity.value;

        if (viewerEntity && viewerEntity !== UndefinedEntity) {
          const transform = getComponent(viewerEntity, TransformComponent);
          const camera = getComponent(viewerEntity, CameraComponent);

          // Orbit around target
          const rotationSpeed = 0.01;
          const position = new Vector3().copy(transform.position);

          // Rotate around Y axis for horizontal movement
          position.applyAxisAngle(Vector3_Up, -deltaX * rotationSpeed);

          // Rotate around right axis for vertical movement
          const right = new Vector3(1, 0, 0);
          position.applyAxisAngle(right, -deltaY * rotationSpeed);

          transform.position.copy(position);
          computeTransformMatrix(viewerEntity);
          camera.lookAt(0, 0, 0);
        }

        lastPos.current = {
          x: gestureState.dx,
          y: gestureState.dy,
        };
      },
      onPanResponderRelease: () => {
        isDragging.current = false;
        lastPos.current = {x: 0, y: 0};
      },
    }),
  ).current;

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
    <View {...panResponder.panHandlers}>
      <GLView style={{width, height}} onContextCreate={onContextCreate} />
    </View>
  );
}
