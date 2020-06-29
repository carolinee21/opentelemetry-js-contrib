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
// import { Attributes } from '@opentelemetry/api';
import * as koa from 'koa';
import * as shimmer from 'shimmer';
import { VERSION } from './version';


/** Koa instrumentation plugin for OpenTelemetry */
export class KoaPlugin extends BasePlugin<typeof koa> {
  static readonly component = 'koa';

    constructor(readonly moduleName: string) {
        super('@opentelemetry/plugin-koa', VERSION);
        console.log('constructing');
    }

    protected patch(): typeof koa {
        console.log('PATCHING!!');
        if (this._moduleExports === undefined || this._moduleExports === null) {
            console.log("undefiiiiined");
            return this._moduleExports;
        }
        // var appProto = (this._moduleExports as unknown) as koa;// as Application<koa.DefaultState, koa.DefaultContext>;
        var appProto = this._moduleExports.prototype;
        console.log('appProto type: ' + (typeof appProto));
        shimmer.wrap(
            appProto,
            'use',
            this._getAppUsePatch.bind(this)
          );

          return this._moduleExports;

    }
    protected unpatch(): void {
        // const appProto = (this._moduleExports as unknown) as koa;// as Application<koa.DefaultState, koa.DefaultContext>;
        var appProto = this._moduleExports.prototype;
        shimmer.unwrap(appProto, 'use');
    }

    /**
   * Get the patch for Application.use function
   * @param original
   */
  private _getAppUsePatch(
    original: any
  ) {
    const plugin = this;
    
    return function use(
        this : {},
        ...args: Parameters<typeof original>
      ) {
        const currentSpan = plugin._tracer.getCurrentSpan();
        if (!currentSpan) {
            console.log('no curr span');
        } else {
            currentSpan.addEvent('CURR SPAN EVENT');
            console.log('tried adding to current span');
        }

        args

        // AQUIII
        var span = plugin._tracer.startSpan('App.use! testing');
        span.setAttribute('key', 'value');
        console.log("Starting request!");
        span.addEvent('NEW SPAN EVENT');
        const route = original.apply(this, args);


        span.end();

        console.log("doneeee!");

        return route;
        // tslint:disable-next-line:no-any
      } as any;
    
  }
}

export const plugin = new KoaPlugin(KoaPlugin.component);
