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

import { writeFile } from 'fs/promises'
import { Browser, remote } from 'webdriverio'

const capabilities = {
  platformName: 'iOS',
  'appium:automationName': 'XCUITest'
}

const wdOpts = {
  hostname: process.env.APPIUM_HOST || '0.0.0.0',
  port: process.env.APPIUM_PORT ? parseInt(process.env.APPIUM_PORT, 10) : 4723,
  path: '/wd/hub',
  capabilities
}

const perfTraceDir = process.env.DEVICEFARM_LOG_DIR ?? '.'

type benchmarkAsync = (testId: string, driver: Browser, skipIfJavaScriptCore: boolean) => Promise<void>

async function runBenchmark(testId: string, driver: Browser, skipIfJavaScriptCore: boolean) {
  const engineVersion = driver.$(`~EngineVersion`)
  await engineVersion.waitForDisplayed({ timeout: 40000 })
  const engineVersionText = await engineVersion.getText()

  if (skipIfJavaScriptCore && engineVersionText === 'Using JavaScriptCore') {
    return '-1'
  }

  const benchmark = driver.$(`~${testId}`)
  await benchmark.click()

  const completed = driver.$(`~${testId}Completed`)

  await completed.waitForDisplayed({ timeout: 40000 })
  const result = await completed.getText()
  return result
}

async function runBenchmarkWithProfiler(
  profileName: string,
  testId: string,
  driver: Browser,
  skipIfJavaScriptCore: boolean
) {
  const perfTracePath = `${perfTraceDir}/${testId}-trace.zip`
  try {
    await driver.execute('mobile: startPerfRecord', {
      profileName,
      pid: 'current',
      timeout: 1000
    })

    await runBenchmark(testId, driver, skipIfJavaScriptCore)

    const output = (await driver.execute('mobile: stopPerfRecord', {
      profileName
    })) as string

    const buff = Buffer.from(output, 'base64')
    await writeFile(perfTracePath, buff)
    console.log('Performance profile written to', perfTracePath)
  } catch (err) {
    console.error(err)
  }
}

async function runBenchmarkWithFlameGraph(testId: string, driver: Browser, skipIfJavaScriptCore: boolean) {
  const perfTracePath = `${perfTraceDir}/${testId}-flamegraph.cpuprofile`
  const toggleFlamegraphButton = driver.$('~toggleFlamegraph')
  await toggleFlamegraphButton.click()

  const result = await runBenchmark(testId, driver, skipIfJavaScriptCore)

  if (parseInt(result) === -1) {
    console.log('Skipped writing flamegraph')
    return
  }

  const profileLocationText = driver.$('~profileLocation')
  const path = await profileLocationText.getText()

  const libraryPath = path.match(/\/Library\/Caches\/.+\.cpuprofile/g)?.at(0)

  if (!libraryPath) {
    console.log('Skipped writing flamegraph')
    return
  }

  const appPath = `@com.rbckr.TestApp${libraryPath}`
  console.log('Searching for artifact at:', libraryPath)

  const traceBase64 = await driver.pullFile(appPath).catch(() => undefined)
  if (!traceBase64) {
    console.log('Failed to find trace at:', libraryPath)
    return
  }

  const buff = Buffer.from(traceBase64, 'base64')
  await writeFile(perfTracePath, buff)
  console.log('Flamegraph written to', perfTracePath)
}

async function runBenchmarkWithWallClockTime(testId: string, driver: Browser, skipIfJavaScriptCore: boolean) {
  const outputPath = `${perfTraceDir}/${testId}WallClock-ms.txt`

  const text = await runBenchmark(testId, driver, skipIfJavaScriptCore)

  await writeFile(outputPath, text)
  console.log('Benchmark time written to', outputPath)
}

function withDriver(benchmarkAsync: benchmarkAsync) {
  return async (testId: string, skipIfJavaScriptCore = false) => {
    const driver = await remote(wdOpts)
    try {
      await benchmarkAsync(testId, driver, skipIfJavaScriptCore)
    } catch (err) {
      throw new Error(`${testId} failed with the following error: ${err}`)
    } finally {
      await driver.deleteSession()
    }
  }
}

export const benchmarkWithWallClockTime = withDriver(runBenchmarkWithWallClockTime)
export const benchmarkWithProfiler = withDriver(runBenchmarkWithProfiler.bind(null, 'Time Profiler'))
export const benchmarkWithMemoryProfiler = withDriver(runBenchmarkWithProfiler.bind(null, 'Allocations'))
export const benchmarkWithFlamegraph = withDriver(runBenchmarkWithFlameGraph)
