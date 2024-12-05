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

import {
  benchmarkWithFlamegraph,
  benchmarkWithMemoryProfiler,
  benchmarkWithProfiler,
  benchmarkWithWallClockTime
} from './testUtils'

const runBenchmarkSuite = async () => {
  console.log('Running benchmarks with wall clock time')
  await benchmarkWithWallClockTime('simpleBenchmark')
  await benchmarkWithWallClockTime('bitEcsBenchmark')
  await benchmarkWithWallClockTime('threeJsBenchmark')
  await benchmarkWithWallClockTime('hyperfluxBenchmark')
  await benchmarkWithWallClockTime('irEcsBenchmark')

  console.log('Running graphics benchmarks')
  await benchmarkWithWallClockTime('triangleWebGpuBenchmark')
  await benchmarkWithWallClockTime('sdfWebGpuBenchmark', true)
  await benchmarkWithWallClockTime('dragonFxaaBenchmark', true)
  await benchmarkWithWallClockTime('ssgiBenchmark', true)
  await benchmarkWithWallClockTime('ssrBenchmark', true)
  await benchmarkWithWallClockTime('rayTracerBenchmark', true)

  await benchmarkWithMemoryProfiler('sdfWebGpuBenchmark', true)

  console.log('Running benchmarks with flamegraph')
  await benchmarkWithFlamegraph('simpleBenchmark')
  await benchmarkWithFlamegraph('bitEcsBenchmark')
  await benchmarkWithFlamegraph('threeJsBenchmark')
  await benchmarkWithFlamegraph('hyperfluxBenchmark')
  await benchmarkWithFlamegraph('irEcsBenchmark')

  console.log('Running benchmarks with profiler')
  await benchmarkWithProfiler('simpleBenchmark')
  await benchmarkWithProfiler('bitEcsBenchmark')
  await benchmarkWithProfiler('threeJsBenchmark')
  await benchmarkWithProfiler('hyperfluxBenchmark')
  await benchmarkWithProfiler('irEcsBenchmark')
}

runBenchmarkSuite()
