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
    if (this._moduleExports === undefined || this._moduleExports === null) {
      return this._moduleExports;
    }
    
    shimmer.wrap(
      this._moduleExports,
      'server',
      this._getServerPatch.bind(this)
    );

    shimmer.wrap(
      this._moduleExports,
      'Server',
      this._getBIGServerPatch.bind(this)
    );

    

    return this._moduleExports;
  }

  protected unpatch(): void {
    shimmer.unwrap(this._moduleExports, 'server');
  }


   private _getBIGServerPatch(
      original: typeof Hapi.Server
  
    ) {
      const plugin = this;
  
     //return function Server(this: Hapi.Server) {
        //const newServer = original.apply(this, []);
        console.log(original)
        var og = original.prototype;
        console.log(og);
        shimmer.wrap(
          og,
          'route',
          plugin._getServerRoutePatch.bind(plugin)
        );
        return original;
      //};
    }

  private _getServerPatch(
    original: (options?: Hapi.ServerOptions) => Hapi.Server
  ) {
    const plugin = this;

    return function server(this: Hapi.Server, opts?: Hapi.ServerOptions) {
      const newServer = original.apply(this, [opts]);
      console.log("wrapping server obj");

      shimmer.wrap(
        newServer,
        'route',
        plugin._getServerRoutePatch.bind(plugin)
      );

      // shimmer.wrap(
      //   newServer,
      //   'register',
      //   plugin._getServerRegisterPatch.bind(plugin)
      // );

      return newServer;
    };
  }

  // private _getServerRegisterPatch(original: any) {
  //   const instrumentation = this;

  //   return async function route(
  //     plugins: Hapi.ServerRegisterPluginObjectArray<any, any, any, any, any, any, any>,
  //     options?: Hapi.ServerRegisterOptions | undefined
  //   ) {
      

  //     await original.apply(plugin, [options]);
  //   };
  // }

  private _getServerRoutePatch(original: HapiServerRouteInput) {
    const plugin = this;
    console.log("gsp");

    return function route(
      this: Hapi.Server,
      route: Hapi.ServerRoute | Hapi.ServerRoute[]
    ): void {
      console.log("server.route called");

      if (Array.isArray(route)) {
        for (let i = 0; i < route.length; i++) {
          const newRoute = plugin._wrapRoute.call(plugin, route[i]);
          route[i] = newRoute;
        }
      } else {
        route = plugin._wrapRoute.call(plugin, route);
      }

      original.apply(this, [route]);
    };
  }

  private _wrapRoute(route: Hapi.ServerRoute): Hapi.ServerRoute {
    const plugin = this;
    console.log("wrapping route")
    if (typeof route.handler === 'function') {
      const handler = route.handler as Hapi.Lifecycle.Method;
      const newHandler: Hapi.Lifecycle.Method = async function (
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
        err?: Error | undefined
      ) {
        console.log("yes");
        if (plugin._tracer.getCurrentSpan() === undefined) {
          console.log("no curr span");
          return await handler(request, h, err);
        }
        const metadata = getRouteMetadata(route);
        const span = plugin._tracer.startSpan(metadata.name, {
          attributes: metadata.attributes,
        });
        const res = await handler(request, h, err);
        span.end();

        return res;
      };
      route.handler = newHandler;
    } else {
      console.log('Non function handler: ');
      console.log(typeof route.handler);
    }
    return route;
  }
}

export const plugin = new HapiInstrumentation(HapiComponentName);
