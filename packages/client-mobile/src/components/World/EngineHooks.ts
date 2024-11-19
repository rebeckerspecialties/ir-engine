import { useHookstate } from '@ir-engine/hyperflux'
import { useEffect } from 'react'
import { loadEngineInjection } from '../../projects/loadEngineInjection'

export const useEngineInjection = () => {
  const loaded = useHookstate(false)
  useEffect(() => {
    loadEngineInjection().then(() => {
      loaded.set(true)
    })
  }, [])
  return loaded.value
}
