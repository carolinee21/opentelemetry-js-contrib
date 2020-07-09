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
import { Middleware, ParameterizedContext} from 'koa';
import { RouterParamContext} from '@koa/router';

export type Parameters<T> = T extends (...args: infer T) => any ? T : unknown[];

export type KoaMiddleware = Middleware<any, RouterParamContext>;

// export type KoaContext = ParameterizedContext<ParameterizedContext<any, DefaultContext>, DefaultContext>;
export type KoaContext = ParameterizedContext<ParameterizedContext<any, any>, any>;

export type KoaLayer = {
    handle: Function;
    name: string;
    params: { [key: string]: string };
    path: string;
    regexp: RegExp;
  };

export enum AttributeNames {
    COMPONENT = 'component',
    HTTP_ROUTE = 'http.route',
    // PATH = 'http.path',
    // STATUS = 'http.status_code',
    // PROTOCOL = 'http.protocol',
    // HOST = 'http.host',
    // METHOD = 'http.method',
    KOA_TYPE = 'koa.type',
    KOA_NAME = 'koa.name'
};

export enum KoaLayerType {
  ROUTER = 'router',
  MIDDLEWARE = 'middleware',
}

export const KoaComponentName : string = 'koa';

/*

Argument of type 
'Middleware<ParameterizedContext<any, RouterParamContext<any, {}>>>' 
is not assignable to parameter of type 
'Middleware<ParameterizedContext<ParameterizedContext<any, DefaultContext>, DefaultContext>>'.



Type 
'ParameterizedContext<ParameterizedContext<any, DefaultContext>, DefaultContext>' 
is not assignable to type 
'ParameterizedContext<any, RouterParamContext<any, {}>>'.
Type 'ExtendableContext & { state: ParameterizedContext<any, DefaultContext>; } & DefaultContext' is missing the following properties from type 'RouterParamContext<any, {}>': params, router, _matchedRoute, _matchedRouteNamez



Argument of type 
'Middleware<ParameterizedContext<any, RouterParamContext<any, {}>>>' 
is not assignable to parameter of type 
'Middleware<ParameterizedContext<ParameterizedContext<string, DefaultContext>, DefaultContext>>'.
  

Type 
  'ParameterizedContext<ParameterizedContext<string, DefaultContext>, DefaultContext>' 
  is not assignable to type 
  'ParameterizedContext<any, RouterParamContext<any, {}>>'.


*/
