/*!
 * Copyright 2019, OpenTelemetry Authors
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
import { Middleware, ParameterizedContext, DefaultContext } from 'koa';

export type Parameters<T> = T extends (...args: infer T) => any ? T : unknown[];

export type KoaMiddleware = Middleware<ParameterizedContext<any, DefaultContext>>;

export type KoaContext = ParameterizedContext<ParameterizedContext<any, DefaultContext>, DefaultContext>;

export enum AttributeNames {
    COMPONENT = 'component',
    ROUTE = 'http.route',
    PATH = 'http.path',
    STATUS = 'http.status_code',
    PROTOCOL = 'http.protocol',
    HOST = 'http.host',
    METHOD = 'http.method',
    KOA_TYPE = 'koa.type',
    KOA_NAME = 'koa.name'
};

export const KoaComponentName : string = 'koa';

