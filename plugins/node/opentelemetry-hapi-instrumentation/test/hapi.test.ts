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

import { context } from '@opentelemetry/api';
import { NoopLogger } from '@opentelemetry/core';
import { NodeTracerProvider } from '@opentelemetry/node';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/tracing';
import * as assert from 'assert';
import * as hapi from '@hapi/hapi';
import { plugin } from '../src';
import { AttributeNames, HapiLayerType } from '../src/types';

describe('Hapi Instrumentation - Core Tests', () => {
  const logger = new NoopLogger();
  const provider = new NodeTracerProvider();
  const memoryExporter = new InMemorySpanExporter();
  const spanProcessor = new SimpleSpanProcessor(memoryExporter);
  provider.addSpanProcessor(spanProcessor);
  const tracer = provider.getTracer('default');
  let contextManager: AsyncHooksContextManager;
  let server: hapi.Server;

  before(() => {
    plugin.enable(hapi, provider, logger);
  });

  beforeEach(async () => {
    contextManager = new AsyncHooksContextManager();
    context.setGlobalContextManager(contextManager.enable());
    server = hapi.server({
      port: 3000,
      host: 'localhost',
    });
  });

  afterEach(async () => {
    server.stop();
    memoryExporter.reset();
    context.disable();
  });

  describe('Instrumenting Hapi Routes', () => {
    it('should create a child span for single routes', async () => {
      const rootSpan = tracer.startSpan('rootSpan');
      server.route({
        method: 'GET',
        path: '/',
        handler: (request, h) => {
          return 'Hello World!';
        },
      });

      await server.start();
      assert.strictEqual(memoryExporter.getFinishedSpans().length, 0);

      await tracer.withSpan(rootSpan, async () => {
        const res = await server.inject({
          method: 'GET',
          url: '/',
        });
        assert.strictEqual(res.statusCode, 200);

        rootSpan.end();
        assert.deepStrictEqual(memoryExporter.getFinishedSpans().length, 2);

        const requestHandlerSpan = memoryExporter
          .getFinishedSpans()
          .find(span => span.name.includes('router'));
        assert.notStrictEqual(requestHandlerSpan, undefined);
        assert.strictEqual(
          requestHandlerSpan?.attributes[AttributeNames.HAPI_TYPE],
          HapiLayerType.ROUTER
        );

        const exportedRootSpan = memoryExporter
          .getFinishedSpans()
          .find(span => span.name === 'rootSpan');
        assert.notStrictEqual(exportedRootSpan, undefined);
      });
    });

    it('should instrument the Hapi.Server (note: uppercase) method', async () => {
      const rootSpan = tracer.startSpan('rootSpan');
      server = new hapi.Server({
        port: 3000,
        host: 'localhost',
      });

      server.route({
        method: 'GET',
        path: '/',
        handler: (request, h) => {
          return 'Hello World!';
        },
      });

      await server.start();
      assert.strictEqual(memoryExporter.getFinishedSpans().length, 0);

      await tracer.withSpan(rootSpan, async () => {
        const res = await server.inject({
          method: 'GET',
          url: '/',
        });
        assert.strictEqual(res.statusCode, 200);

        rootSpan.end();
        assert.deepStrictEqual(memoryExporter.getFinishedSpans().length, 2);

        const requestHandlerSpan = memoryExporter
          .getFinishedSpans()
          .find(span => span.name.includes('router'));
        assert.notStrictEqual(requestHandlerSpan, undefined);
        assert.strictEqual(
          requestHandlerSpan?.attributes[AttributeNames.HAPI_TYPE],
          HapiLayerType.ROUTER
        );

        const exportedRootSpan = memoryExporter
          .getFinishedSpans()
          .find(span => span.name === 'rootSpan');
        assert.notStrictEqual(exportedRootSpan, undefined);
      });
    });

    it('should create child spans for multiple routes', async () => {
      const rootSpan = tracer.startSpan('rootSpan');
      server.route([
        {
          method: 'GET',
          path: '/first',
          handler: (request, h) => {
            return 'First!';
          },
        },
        {
          method: 'GET',
          path: '/second',
          handler: (request, h) => {
            return 'Second!';
          },
        },
      ]);

      await server.start();
      assert.strictEqual(memoryExporter.getFinishedSpans().length, 0);

      await tracer.withSpan(rootSpan, async () => {
        const resFirst = await server.inject({
          method: 'GET',
          url: '/first',
        });
        const resSecond = await server.inject({
          method: 'GET',
          url: '/second',
        });

        assert.strictEqual(resFirst.statusCode, 200);
        assert.strictEqual(resSecond.statusCode, 200);

        rootSpan.end();
        assert.deepStrictEqual(memoryExporter.getFinishedSpans().length, 3);

        const firstHandlerSpan = memoryExporter
          .getFinishedSpans()
          .find(span => span.name.includes('router - /first'));
        assert.notStrictEqual(firstHandlerSpan, undefined);
        assert.strictEqual(
          firstHandlerSpan?.attributes[AttributeNames.HAPI_TYPE],
          HapiLayerType.ROUTER
        );

        const secondHandlerSpan = memoryExporter
          .getFinishedSpans()
          .find(span => span.name.includes('router - /second'));
        assert.notStrictEqual(secondHandlerSpan, undefined);
        assert.strictEqual(
          secondHandlerSpan?.attributes[AttributeNames.HAPI_TYPE],
          HapiLayerType.ROUTER
        );

        const exportedRootSpan = memoryExporter
          .getFinishedSpans()
          .find(span => span.name === 'rootSpan');
        assert.notStrictEqual(exportedRootSpan, undefined);
      });
    });

    it('should not create span if there is no parent span', async () => {
      server.route({
        method: 'GET',
        path: '/',
        handler: (request, h) => {
          return 'Hello World!';
        },
      });
      await server.start();
      assert.strictEqual(memoryExporter.getFinishedSpans().length, 0);

      const res = await server.inject({
        method: 'GET',
        url: '/',
      });
      assert.strictEqual(res.statusCode, 200);
      assert.deepStrictEqual(memoryExporter.getFinishedSpans().length, 0);
    });
  });

  describe('Disabling Hapi instrumentation', () => {
    it('should not create new spans', async () => {
      plugin.disable();

      // must reininitialize here for effects of disabling plugin to become apparent
      server = hapi.server({
        port: 3000,
        host: 'localhost',
      });

      const rootSpan = tracer.startSpan('rootSpan');

      server.route({
        method: 'GET',
        path: '/',
        handler: (request, h) => {
          return 'Hello World!';
        },
      });

      await server.start();

      assert.strictEqual(memoryExporter.getFinishedSpans().length, 0);

      await tracer.withSpan(rootSpan, async () => {
        const res = await server.inject({
          method: 'GET',
          url: '/',
        });
        assert.strictEqual(res.statusCode, 200);

        rootSpan.end();
        assert.deepStrictEqual(memoryExporter.getFinishedSpans().length, 1);
        assert.notStrictEqual(memoryExporter.getFinishedSpans()[0], undefined);
      });
    });
  });
});