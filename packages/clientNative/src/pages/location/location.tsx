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

import {useEngineInjection} from '@ir-engine/client-core-mobile/src/components/World/EngineHooks';
import {useEngineCanvas} from '@ir-engine/client-core-mobile/src/hooks/useEngineCanvas';
import {createEngine} from '@ir-engine/ecs';
import {createHyperStore} from '@ir-engine/hyperflux';
import {startTimer} from '@ir-engine/spatial/src/startTimer';
import {
  destroySpatialEngine,
  initializeSpatialEngine,
} from '@ir-engine/spatial/src/initializeEngine';
import {GLView} from 'expo-gl';
import {useCallback, useState, useEffect, useRef} from 'react';
import {PanResponder, Text, View} from 'react-native';
import {
  NativeHTMLCanvasElement,
  NativeWebGLRenderingContext,
} from '../../polyfill/NativeHTMLCanvasElement';

createEngine(createHyperStore());
startTimer();

const LocationRoutes = () => {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      // Ask to be the responder:
      onStartShouldSetPanResponder: (evt, gestureState) => true,
      onStartShouldSetPanResponderCapture: (evt, gestureState) => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => true,
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => true,

      onPanResponderGrant: (evt, gestureState) => {
        // The gesture has started. Show visual feedback so the user knows
        // what is happening!
        // gestureState.d{x,y} will be set to zero now
      },
      onPanResponderMove: (evt, gestureState) => {
        // The most recent move distance is gestureState.move{X,Y}
        // The accumulated gesture distance since becoming responder is
        // gestureState.d{x,y}
      },
      onPanResponderTerminationRequest: (evt, gestureState) => true,
      onPanResponderRelease: (evt, gestureState) => {
        // The user has released all touches while this view is the
        // responder. This typically means a gesture has succeeded
      },
      onPanResponderTerminate: (evt, gestureState) => {
        // Another component has become the responder, so this gesture
        // should be cancelled
      },
      onShouldBlockNativeResponder: (evt, gestureState) => {
        // Returns whether this component should block native components from becoming the JS
        // responder. Returns true by default. Is currently only supported on android.
        return true;
      },
    }),
  ).current;

  const onContextCreate = useCallback(
    (context: NativeWebGLRenderingContext) => {
      // TODO: update canvas event listeners
      setCanvas(new NativeHTMLCanvasElement(context));
    },
    [],
  );

  useEffect(() => {
    initializeSpatialEngine();
    return () => {
      destroySpatialEngine();
    };
  }, []);

  useEngineCanvas(canvas);

  const projectsLoaded = useEngineInjection();

  if (!projectsLoaded) {
    return (
      <View>
        <Text>Loading Project</Text>
      </View>
    );
  }
  return (
    <View {...panResponder.panHandlers}>
      <Text>Loaded Project</Text>
      <GLView
        style={{width: 300, height: 300}}
        onContextCreate={onContextCreate}
      />
    </View>
  );
};

export default LocationRoutes;
