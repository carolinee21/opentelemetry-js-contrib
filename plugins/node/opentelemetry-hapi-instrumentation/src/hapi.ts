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
import {
  HapiComponentName,
  HapiServerRouteInput,
  handlerPatched,
  PatchableServerRoute,
  HapiServerRouteInputMethod,
  HapiPluginInput,
  RegisterFunction,
} from './types';
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

    // Casting as any is necessary here due to an issue with the @types/hapi__hapi
    // type definition for Hapi.Server. Hapi.Server (note the uppercase) can also function
    // as a factory function, similarly to Hapi.server, and so should also be supported and
    // instrumented. This is an issue with the DefinitelyTyped repo.
    // Function is defined at: https://github.com/hapijs/hapi/blob/master/lib/index.js#L9
    shimmer.wrap(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this._moduleExports as any,
      'Server',
      this._getServerPatch.bind(this)
    );

    return this._moduleExports;
  }

  protected unpatch(): void {
    shimmer.massUnwrap([this._moduleExports], ['server', 'Server']);
  }

  private _getServerPatch(
    original: (options?: Hapi.ServerOptions) => Hapi.Server // recent
  ) {
    const instrumentation = this;
    return function server(this: Hapi.Server, opts?: Hapi.ServerOptions) {
      const newServer: Hapi.Server = original.apply(this, [opts]);

      shimmer.wrap(
        newServer,
        'route',
        instrumentation._getServerRoutePatch.bind(instrumentation)
      );
      // Casting as any is necessary here due to multiple overloads on the Hapi.Server.register
      // function, which requires supporting a variety of different types of Plugin inputs
      shimmer.wrap(
        newServer,
        'register',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        instrumentation._getServerRegisterPatch.bind(instrumentation) as any
      );
      return newServer;
    };
  }

  private _getServerRegisterPatch<T>(
    original: RegisterFunction<T>
  ): RegisterFunction<T> {
    const instrumentation = this;
    return async function register(
      this: Hapi.Server,
      pluginInput: HapiPluginInput<T>,
      options?: Hapi.ServerRegisterOptions
    ) {
      if (Array.isArray(pluginInput)) {
        for (let i = 0; i < pluginInput.length; i++) {
          instrumentation._wrapRegisterHandler(pluginInput[i].plugin);
        }
      } else {
        instrumentation._wrapRegisterHandler(pluginInput.plugin);
      }
      await original.call(this, pluginInput, options);
    };
  }

  private _getServerRoutePatch(original: HapiServerRouteInputMethod) {
    const instrumentation = this;

    return function route(
      this: Hapi.Server,
      route: HapiServerRouteInput
    ): void {
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

  private _wrapRoute(route: PatchableServerRoute): PatchableServerRoute {
    const instrumentation = this;
    if (route[handlerPatched] === true) return route;
    route[handlerPatched] = true;
    if (typeof route.handler === 'function') {
      const handler = route.handler as Hapi.Lifecycle.Method;
      const newHandler: Hapi.Lifecycle.Method = async function (
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
        err?: Error | undefined
      ) {
        if (instrumentation._tracer.getCurrentSpan() === undefined) {
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
    }
    return route;
  }

  private _wrapRegisterHandler<T>(plugin: Hapi.Plugin<T>): void {
    const instrumentation = this;
    if (typeof plugin.register === 'function') {
      const oldHandler = plugin.register;
      const newHandler = async function (server: Hapi.Server, options: T) {
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
