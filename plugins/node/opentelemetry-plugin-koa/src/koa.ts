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
import { Parameters, KoaMiddleware, KoaContext, AttributeNames } from './types';
import { VERSION } from './version';


/** Koa instrumentation plugin for OpenTelemetry */
export class KoaPlugin extends BasePlugin<typeof koa> {
  static readonly component = 'koa';

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
   * Get the patch for Application.use function
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

        var span = plugin._tracer.startSpan('app.use');

        var oldMiddleware = middlewareFunction;
        var patchedFunction = plugin._patchLayer(oldMiddleware);
        const route = original.apply(this, [patchedFunction]);
        // var lastLayer = route.middleware[route.middleware.length - 1];

        span.end();

        return route;
        // tslint:disable-next-line:no-any
      } as any;
    
  }

  private _patchLayer (oldMiddleware: KoaMiddleware) {
    const patchedLayer = (context: KoaContext, next: koa.Next) => {
        const currentSpan = this._tracer.getCurrentSpan();
        if (!currentSpan) {
            console.log('--- No current span');
        } 

        var mwSpan = this._tracer.startSpan('middleware');

        mwSpan.setAttribute(AttributeNames.COMPONENT, KoaPlugin.component);
        mwSpan.setAttribute(AttributeNames.PATH, context.path);
        mwSpan.setAttribute(AttributeNames.PROTOCOL, context.protocol);
        mwSpan.setAttribute(AttributeNames.STATUS, context.status);
        mwSpan.setAttribute(AttributeNames.HOST, context.host);
        mwSpan.setAttribute(AttributeNames.METHOD, context.method);
        mwSpan.setAttribute(AttributeNames.KOA_TYPE, 'middleware');
        
        oldMiddleware(context, next);
        mwSpan.end();

    }
    return patchedLayer;
  }
}

export const plugin = new KoaPlugin(KoaPlugin.component);
