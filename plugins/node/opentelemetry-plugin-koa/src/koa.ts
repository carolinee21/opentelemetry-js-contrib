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
// import * as shimmer from 'shimmer';
import { VERSION } from './version';


/** Koa instrumentation plugin for OpenTelemetry */
export class KoaPlugin extends BasePlugin<typeof koa> {

    constructor(readonly moduleName: string) {
        super('@opentelemetry/plugin-koa', VERSION);
    }

    protected patch(): typeof koa {
        throw new Error("Method not implemented.");
    }
    protected unpatch(): void {
        throw new Error("Method not implemented.");
    }
}