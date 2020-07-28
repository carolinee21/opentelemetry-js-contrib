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
import type * as Hapi from '@hapi/hapi';

export const HapiComponentName = '@hapi/hapi';

/**
 * This symbol is used to mark a Hapi route handler or plugin handler as
 * already patched, since its possible to use these handlers multiple times
 * i.e. when allowing multiple versions of one plugin, or when registering a plugin
 * multiple times on different servers, like in testing
 */
export const handlerPatched: unique symbol = Symbol('hapi-handler-patched');

export type HapiServerRouteInputMethod = (route: HapiServerRouteInput) => void;

export type HapiServerRouteInput =
  | PatchableServerRoute
  | PatchableServerRoute[];

export type PatchableServerRoute = Hapi.ServerRoute & {
  [handlerPatched]?: boolean;
};

export enum AttributeNames {
  HAPI_TYPE = 'hapi.type',
}

export enum HapiLayerType {
  ROUTER = 'router',
  PLUGIN = 'plugin',
}
