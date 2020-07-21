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
import type * as Hapi from '@hapi/hapi';
import { VERSION } from './version';
import { HapiComponentName, HapiServerRouteInput } from './types';

import * as shimmer from 'shimmer';
import { getRouteMetadata } from './utils';

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

      shimmer.wrap(
        newServer,
        'route',
        plugin._getServerRoutePatch.bind(plugin)
      );
      return newServer;
    };
  }

  private _getServerRoutePatch(original: HapiServerRouteInput) {
    const plugin = this;

    return function route(
      this: Hapi.Server,
      route: Hapi.ServerRoute | Hapi.ServerRoute[]
    ): void {
      console.log('test');

      if (Array.isArray(route)) {
        console.log('multiple routes: ' + route.length);
        for (let i = 0; i < route.length; i++) {
          const newRoute = plugin._wrapRoute.call(plugin, route[i]);
          route[i] = newRoute;
        }
      } else {
        console.log('one route');
        route = plugin._wrapRoute.call(plugin, route);
      }

      original.apply(this, [route]);
    };
  }

  private _wrapRoute(route: Hapi.ServerRoute): Hapi.ServerRoute {
    const plugin = this;

    if (typeof route.handler === 'function') {
      const handler = route.handler as Hapi.Lifecycle.Method;
      console.log('typeof handler = function');
      const newHandler: Hapi.Lifecycle.Method = async function (
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
        err?: Error | undefined
      ) {
        console.log('starting span');
        const metadata = getRouteMetadata(route);

        const span = plugin._tracer.startSpan(metadata.name, {
          attributes: metadata.attributes,
        });
        const res = await handler(request, h, err);
        span.end();

        return res;
      };
      route.handler = newHandler;
    }

    return route;
  }
}

export const plugin = new HapiInstrumentation(HapiComponentName);
