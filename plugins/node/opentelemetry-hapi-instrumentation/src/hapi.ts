/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { BasePlugin } from '@opentelemetry/core';
import * as Hapi from '@hapi/hapi';
import { VERSION } from './version';
import { HapiComponentName } from './types';

import * as shimmer from 'shimmer';

/** Hapi instrumentation for OpenTelemetry */
export class HapiInstrumentation extends BasePlugin<typeof Hapi> {
  static readonly component = HapiComponentName;

  constructor(readonly moduleName: string) {
    super('@opentelemetry/hapi-instrumentation', VERSION);
  }

  protected patch(): typeof Hapi {
    this._logger.debug('Patching hapi');
    console.log('patching hapi');
    if (this._moduleExports === undefined || this._moduleExports === null) {
      return this._moduleExports;
    }
    shimmer.wrap(
      this._moduleExports,
      'server',
      this._getServerPatch.bind(this)
    );

    return this._moduleExports;
  }

  protected unpatch(): void {
    const serverProto = this._moduleExports.Server.prototype;

    shimmer.unwrap(serverProto, 'route');
  }

  private _getServerPatch(
    original: (options?: Hapi.ServerOptions) => Hapi.Server
  ) {
    const plugin = this;

    return function server(this: Hapi.Server, opts?: Hapi.ServerOptions) {
      const newServer = original.apply(this, [opts]);

      shimmer.wrap(newServer, 'route', plugin._getServerRoutePatch.bind(this));

      return newServer;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }

  private _getServerRoutePatch(
    original: (route: Hapi.ServerRoute | Hapi.ServerRoute[]) => void
  ): (route: Hapi.ServerRoute | Hapi.ServerRoute[]) => void {
    console.log('well then');
    return function route(
      this: Hapi.Server,
      route: Hapi.ServerRoute | Hapi.ServerRoute[]
    ): void {
      console.log('test');
      original.apply(this, [route]);
    };
  }
}

export const plugin = new HapiInstrumentation(HapiComponentName);
