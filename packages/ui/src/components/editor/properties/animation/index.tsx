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

import { getOptionalComponent, useComponent, useOptionalComponent } from '@etherealengine/ecs'
import {
  EditorComponentType,
  commitProperties,
  commitProperty,
  updateProperty
} from '@etherealengine/editor/src/components/properties/Util'
import { AnimationComponent } from '@etherealengine/engine/src/avatar/components/AnimationComponent'
import { LoopAnimationComponent } from '@etherealengine/engine/src/avatar/components/LoopAnimationComponent'
import { getEntityErrors } from '@etherealengine/engine/src/scene/components/ErrorComponent'
import { ModelComponent } from '@etherealengine/engine/src/scene/components/ModelComponent'
import { useState } from '@etherealengine/hyperflux'
import { getCallback } from '@etherealengine/spatial/src/common/CallbackComponent'
import StreetviewIcon from '@mui/icons-material/Streetview'
import { VRM } from '@pixiv/three-vrm'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { SelectOptionsType } from '../../../../primitives/tailwind/Select'
import InputGroup from '../../input/Group'
import ModelInput from '../../input/Model'
import NumericInput from '../../input/Numeric'
import ProgressBar from '../../input/Progress'
import SelectInput from '../../input/Select'
import NodeEditor from '../nodeEditor'

export const LoopAnimationNodeEditor: EditorComponentType = (props) => {
  const { t } = useTranslation()
  const entity = props.entity

  const animationOptions = useState([] as { label: string; value: number }[])
  const loopAnimationComponent = useComponent(entity, LoopAnimationComponent)

  const modelComponent = useOptionalComponent(entity, ModelComponent)
  const animationComponent = useOptionalComponent(entity, AnimationComponent)

  const errors = getEntityErrors(props.entity, ModelComponent)

  useEffect(() => {
    const animationComponent = getOptionalComponent(entity, AnimationComponent)
    if (!animationComponent || !animationComponent.animations.length) return
    animationOptions.set([
      { label: 'None', value: -1 },
      ...animationComponent.animations.map((clip, index) => ({ label: clip.name, value: index }))
    ])
  }, [modelComponent?.asset, modelComponent?.convertToVRM, animationComponent?.animations])

  const onChangePlayingAnimation = (index) => {
    commitProperties(LoopAnimationComponent, {
      activeClipIndex: index
    })
    getCallback(props.entity, 'xre.play')!()
  }

  return (
    <NodeEditor
      {...props}
      name={t('editor:properties.loopAnimation.title')}
      description={t('editor:properties.loopAnimation.description')}
    >
      <ProgressBar value={5} paused={false} totalTime={100} />
      <InputGroup name="Loop Animation" label={t('editor:properties.loopAnimation.lbl-loopAnimation')}>
        <SelectInput
          key={props.entity}
          options={animationOptions.value as SelectOptionsType[]}
          value={loopAnimationComponent.value.activeClipIndex}
          onChange={onChangePlayingAnimation}
        />
      </InputGroup>
      {modelComponent?.asset.value instanceof VRM && (
        <InputGroup name="Animation Pack" label={t('editor:properties.loopAnimation.lbl-animationPack')}>
          <ModelInput
            value={loopAnimationComponent.animationPack.value}
            onRelease={commitProperty(LoopAnimationComponent, 'animationPack')}
          />
          {errors?.LOADING_ERROR && (
            <div style={{ marginTop: 2, color: '#FF8C00' }}>{t('editor:properties.model.error-url')}</div>
          )}
        </InputGroup>
      )}
      <InputGroup name="Time Scale" label={t('editor:properties.loopAnimation.lbl-timeScale')}>
        <NumericInput
          value={loopAnimationComponent.timeScale.value}
          onChange={updateProperty(LoopAnimationComponent, 'timeScale')}
          onRelease={commitProperty(LoopAnimationComponent, 'timeScale')}
        />
      </InputGroup>
    </NodeEditor>
  )
}

LoopAnimationNodeEditor.iconComponent = StreetviewIcon

export default LoopAnimationNodeEditor