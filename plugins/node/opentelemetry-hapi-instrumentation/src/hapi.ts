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

    shimmer.massWrap(
      [this._moduleExports],
      ['server', 'Server'],
      this._getServerPatch.bind(this) as any // recent
    );
    return this._moduleExports;
  }

  protected unpatch(): void {
    shimmer.massUnwrap([this._moduleExports], ['server', 'Server']);
  }

  private _getServerPatch(
    original: (options?: Hapi.ServerOptions) => Hapi.Server // recent
  ) {
    const plugin = this;
    return function server(this: Hapi.Server, opts?: Hapi.ServerOptions) {
      const newServer: Hapi.Server = original.apply(this, [opts]);
      console.log('wrapping server obj');

      shimmer.wrap(
        newServer,
        'route',
        plugin._getServerRoutePatch.bind(plugin)
      );

      shimmer.wrap(
        newServer,
        'register',
        plugin._getServerRegisterPatch.bind(plugin)
      );

      return newServer;
    };
  }

  private _getServerRegisterPatch(original: any) {
    const instrumentation = this;

    //return original;
    return async function register(
      // plugin: any, // Hapi.ServerRegisterPluginObject<any>,
      // options?:  Hapi.ServerRegisterOptions | undefined
      this: Hapi.Server,
      myPlugin: any, // Hapi.ServerRegisterPluginObject<any>, // recent
      ...args: any
    ) {
      if (Array.isArray(myPlugin)) {
        for (let i = 0; i < myPlugin.length; i++) {
          if (!myPlugin[i].plugin) {
            console.log('Error: no plugin obj');
            console.log(myPlugin[i]);
          }
          instrumentation._wrapRegisterHandler(myPlugin[i].plugin);
        }
      } else {
        if (!myPlugin.plugin) {
          console.log('Error: no plugin obj');
          console.log(myPlugin);
        }
        instrumentation._wrapRegisterHandler(myPlugin.plugin);
      }
      // await original(plugin.plugin, options);
      await original.call(this, myPlugin);
    };
  }

  private _getServerRoutePatch(original: HapiServerRouteInput) {
    const instrumentation = this;

    return function route(
      this: Hapi.Server,
      route: Hapi.ServerRoute | Hapi.ServerRoute[]
    ): void {
      console.log('server.route called');

      if (Array.isArray(route)) {
        for (let i = 0; i < route.length; i++) {
          const newRoute = instrumentation._wrapRoute.call(
            instrumentation,
            route[i]
          );
          route[i] = newRoute;
        }
      } else {
        route = instrumentation._wrapRoute.call(instrumentation, route);
      }
      original.apply(this, [route]);
    };
  }

  private _wrapRoute(route: Hapi.ServerRoute): Hapi.ServerRoute {
    const instrumentation = this;
    console.log('wrapping route');
    if (typeof route.handler === 'function') {
      const handler = route.handler as Hapi.Lifecycle.Method;
      const newHandler: Hapi.Lifecycle.Method = async function (
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
        err?: Error | undefined
      ) {
        if (instrumentation._tracer.getCurrentSpan() === undefined) {
          console.log('no curr span');
          return await handler(request, h, err);
        }
        const metadata = getRouteMetadata(route);
        const span = instrumentation._tracer.startSpan(metadata.name, {
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

  private _wrapRegisterHandler(plugin: any): any {
    const instrumentation = this;
    console.log('wrapping true register');
    if (typeof plugin.register === 'function') {
      const oldHandler = plugin.register;
      const newHandler = async function (server: Hapi.Server, options: any) {
        shimmer.wrap(
          server,
          'route',
          instrumentation._getServerRoutePatch.bind(instrumentation)
        );
        const res = await oldHandler(server, options);
        return res;
      };
      plugin.register = newHandler;
    }
  }
}

export const plugin = new HapiInstrumentation(HapiComponentName);
