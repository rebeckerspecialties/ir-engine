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

import React, { CSSProperties, Fragment } from 'react'

import { defineState } from '@ir-engine/hyperflux'

export const NotificationState = defineState({
  name: 'ee.client.NotificationState',
  initial: {
    snackbar: null as null | undefined
  }
})

export type NotificationOptions = {
  variant: '' // 'default' | 'error' | 'success' | 'warning' | 'info'
  actionType?: keyof typeof NotificationActions
  persist?: boolean
  style?: CSSProperties
  hideIconVariant?: boolean
}

export const defaultAction = (key: any, content?: React.ReactNode) => {
  return <Fragment>{content}</Fragment>
}
export const inviteActions = (key: any, content?: React.ReactNode) => {
  return <Fragment>{content}</Fragment>
}

export const NotificationActions = {
  default: defaultAction,
  invite: inviteActions
}

export const NotificationService = {
  dispatchNotify(message: React.ReactNode, options: NotificationOptions) {
    console.log('NotificationService.dispatchNotify', message, options)
  },
  closeNotification(key: any) {
    console.log('NotificationService.closeNotification', key)
  }
}

export const NotificationSnackbar = (props: { style?: CSSProperties }) => {
  return null
}
