/*!
 * Copyright 2020, OpenTelemetry Authors
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
import * as koa from 'koa';
import * as shimmer from 'shimmer';
import { Parameters, KoaMiddleware, KoaContext, KoaComponentName } from './types';
import { VERSION } from './version';
import { getMiddlewareMetadata } from './utils';
// import { Layer } from '@koa/router';
import Router = require('@koa/router');


/** Koa instrumentation plugin for OpenTelemetry */
export class KoaPlugin extends BasePlugin<typeof koa> {
  static readonly component = KoaComponentName;

    constructor(readonly moduleName: string) {
        super('@opentelemetry/plugin-koa', VERSION);
    }

    protected patch(): typeof koa {
        if (this._moduleExports === undefined || this._moduleExports === null) {
            return this._moduleExports;
        }
        var appProto = this._moduleExports.prototype;
        shimmer.wrap(
            appProto,
            'use',
            this._getAppUsePatch.bind(this)
        );

        return this._moduleExports;

    }
    protected unpatch(): void {
        var appProto = this._moduleExports.prototype;
        shimmer.unwrap(appProto, 'use');
    }

    /**
   * Patches the Application.use function in order to instrument each original
   * middleware layer which is introduced
   * @param original
   */
  private _getAppUsePatch( original: Function )
    {
    const plugin = this;

    return function use(
        this : koa,
        middlewareFunction : KoaMiddleware,
        ...args: Parameters<typeof original>
      ) {
        console.log("mw name: " + middlewareFunction.name);
        var isRouterDispatch = middlewareFunction.name == "dispatch";
        isRouterDispatch = (middlewareFunction as any).router;
      var patchedFunction;
        if (isRouterDispatch) {
          patchedFunction = plugin._patchRoutes(middlewareFunction);
        } else {
          patchedFunction = plugin._patchLayer(middlewareFunction, false);         
        }
        const route = original.apply(this, [patchedFunction]);

        return route;

        // tslint:disable-next-line:no-any
      } as any;
    
  }

  private _patchLayer (middlewareLayer: KoaMiddleware, isRouter: boolean, layerName?: string) {
    const plugin = this;
    console.log(".....setting up span patch for: " + layerName ?? middlewareLayer.name);
    const patchedLayer = (context: KoaContext, next: koa.Next) => {
        const currentSpan = this._tracer.getCurrentSpan();
        if (!currentSpan) {
            console.log('--- No current span');
        } 

        const metadata = getMiddlewareMetadata(context);
        var spanName = layerName ?? middlewareLayer.name;
        if (!spanName) {
          spanName = metadata.name;
        }
        const span = plugin._tracer.startSpan(spanName, {
          attributes: metadata.attributes,
        });
        var result = middlewareLayer(context, next);
        span.end();
        return result;
    }
    return patchedLayer;
  }
  

  private _patchRoutes (dispatchLayer: KoaMiddleware) {
    const plugin = this;
    console.log(".....set up");

    var smth = (dispatchLayer as any);
    var router = smth.router as Router;
    
    var routesStack = router.stack;
    for (var i = 0; i < routesStack.length; i++) {
      var pathLayer : Router.Layer = routesStack[i];
      var path = pathLayer.path;
      var pathStack = pathLayer.stack;
      for (var j = 0; j < pathStack.length; j++) {
        var pop = pathStack[j];
        var newpop = plugin._patchLayer(pop, true, path);
        pathStack[j] = newpop;
      }
    }
    
    const dispatcher = (context: KoaContext, next: koa.Next) => {
      console.log(".....dispatching");
      var result = smth(context, next);
      return result;
    }
    return dispatcher;

  }
  
}

export const plugin = new KoaPlugin(KoaPlugin.component);
