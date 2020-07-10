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

import { BasePlugin, hrTime } from '@opentelemetry/core';
import * as koa from 'koa';
import * as shimmer from 'shimmer';
import {
  Parameters,
  KoaMiddleware,
  KoaContext,
  KoaComponentName,
} from './types';
import { VERSION } from './version';
import { getMiddlewareMetadata } from './utils';
import Router = require('@koa/router');

/**
 * This symbol is used to mark a Koa layer as being already instrumented
 * since its possible to use a given layer multiple times (ex: middlewares)
 */
export const kLayerPatched: unique symbol = Symbol('koa-layer-patched');

/** Koa instrumentation plugin for OpenTelemetry */
export class KoaPlugin extends BasePlugin<typeof koa> {
  static readonly component = KoaComponentName;

  constructor(readonly moduleName: string) {
    super('@opentelemetry/plugin-koa', VERSION);
  }

  protected patch(): typeof koa {
    this._logger.debug('Patching Koa');

    if (this._moduleExports === undefined || this._moduleExports === null) {
      return this._moduleExports;
    }
    this._logger.debug('Patching Koa.use');
    const appProto = this._moduleExports.prototype;
    shimmer.wrap(appProto, 'use', this._getKoaUsePatch.bind(this));

    return this._moduleExports;
  }
  protected unpatch(): void {
    const appProto = this._moduleExports.prototype;
    shimmer.unwrap(appProto, 'use');
  }

  /**
   * Patches the Koa.use function in order to instrument each original
   * middleware layer which is introduced
   * @param original
   */
  private _getKoaUsePatch(original: (middleware: KoaMiddleware) => koa) {
    return function use(
      this: koa,
      middlewareFunction: KoaMiddleware,
      ...args: Parameters<typeof original>
    ) {
      let patchedFunction;
      if (middlewareFunction.router) {
        patchedFunction = plugin._patchRouterDispatch(middlewareFunction);
      } else {
        patchedFunction = plugin._patchLayer(middlewareFunction, false);
      }

      args[0] = patchedFunction;
      const res = original.apply(this, args);

      return res;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }

  private _patchRouterDispatch(dispatchLayer: KoaMiddleware) {
    this._logger.debug('Patching @koa/router dispatch');

    const router = dispatchLayer.router;

    const routesStack = router?.stack ?? [];
    for (let i = 0; i < routesStack.length; i++) {
      const pathLayer: Router.Layer = routesStack[i];
      const path = pathLayer.path;
      const pathStack = pathLayer.stack;
      for (let j = 0; j < pathStack.length; j++) {
        const routedMiddleware: KoaMiddleware = pathStack[j];
        pathStack[j] = this._patchLayer(routedMiddleware, true, path);
      }
    }

    const dispatcher = (context: KoaContext, next: koa.Next) => {
      const result = dispatchLayer(context, next);
      return result;
    };
    return dispatcher;
  }

  private _patchLayer(
    middlewareLayer: KoaMiddleware,
    isRouter: boolean,
    layerPath?: string
  ): KoaMiddleware {
    if (middlewareLayer[kLayerPatched] === true) return middlewareLayer;
    middlewareLayer[kLayerPatched] = true;
    this._logger.debug('patching Koa middleware layer');

    return (context: KoaContext, next: koa.Next) => {
      if (this._tracer.getCurrentSpan() === undefined) {
        return middlewareLayer(context, next);
      }
      const metadata = getMiddlewareMetadata(
        context,
        middlewareLayer,
        isRouter,
        layerPath
      );
      const span = this._tracer.startSpan(metadata.name, {
        attributes: metadata.attributes,
      });
      const startTime = hrTime();

      const result = middlewareLayer(context, next);
      span.end(startTime);
      return result;
    };
  }
}

export const plugin = new KoaPlugin(KoaPlugin.component);
