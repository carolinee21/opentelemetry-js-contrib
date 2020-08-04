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
'use strict';
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

describe('Hapi Instrumentation - Server.Ext Tests', () => {
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
      port: 5000,
      host: 'localhost',
    });
    server.route({ method: 'GET', path: '/test', handler: () => 'okay' });
  });

  afterEach(async () => {
    await server.stop();

    memoryExporter.reset();
    context.disable();
  });

  after(() => {
    plugin.disable();
  });

  describe('Instrumenting Hapi Server Extension methods', () => {
    it('instruments direct Hapi.Lifecycle.Method extensions', async () => {
      const rootSpan = tracer.startSpan('rootSpan');

      server.ext('onRequest', async (request, h, err) => {
        return h.continue;
      });
      await server.start();
      assert.strictEqual(memoryExporter.getFinishedSpans().length, 0);

      await tracer.withSpan(rootSpan, async () => {
        const res = await server.inject({
          method: 'GET',
          url: '/test',
        });
        assert.strictEqual(res.statusCode, 200);

        rootSpan.end();
        assert.deepStrictEqual(memoryExporter.getFinishedSpans().length, 3);
        const extHandlerSpan = memoryExporter
          .getFinishedSpans()
          .find(span => span.name === 'ext - onRequest');
        assert.notStrictEqual(extHandlerSpan, undefined);
        assert.strictEqual(
          extHandlerSpan?.attributes[AttributeNames.HAPI_TYPE],
          HapiLayerType.EXT
        );
        assert.strictEqual(
          extHandlerSpan?.attributes[AttributeNames.EXT_TYPE],
          'onRequest'
        );

        const exportedRootSpan = memoryExporter
          .getFinishedSpans()
          .find(span => span.name === 'rootSpan');
        assert.notStrictEqual(exportedRootSpan, undefined);
      });
    });

    it('instruments single ServerExtEventsRequestObject', async () => {
      const rootSpan = tracer.startSpan('rootSpan');
      const extension: hapi.ServerExtEventsRequestObject = {
        type: 'onRequest',
        method: async (request, h, err) => {
          return h.continue;
        },
      };
      server.ext(extension);
      await server.start();
      assert.strictEqual(memoryExporter.getFinishedSpans().length, 0);

      await tracer.withSpan(rootSpan, async () => {
        const res = await server.inject({
          method: 'GET',
          url: '/test',
        });
        assert.strictEqual(res.statusCode, 200);

        rootSpan.end();
        assert.deepStrictEqual(memoryExporter.getFinishedSpans().length, 3);
        const extHandlerSpan = memoryExporter
          .getFinishedSpans()
          .find(span => span.name === 'ext - onRequest');
        assert.notStrictEqual(extHandlerSpan, undefined);
        assert.strictEqual(
          extHandlerSpan?.attributes[AttributeNames.HAPI_TYPE],
          HapiLayerType.EXT
        );
        assert.strictEqual(
          extHandlerSpan?.attributes[AttributeNames.EXT_TYPE],
          'onRequest'
        );

        const exportedRootSpan = memoryExporter
          .getFinishedSpans()
          .find(span => span.name === 'rootSpan');
        assert.notStrictEqual(exportedRootSpan, undefined);
      });
    });

    it('instruments single ServerExtEventsRequestObject with multiple handlers', async () => {
      const rootSpan = tracer.startSpan('rootSpan');
      const firstHandler: hapi.Lifecycle.Method = async (request, h, err) => {
        return h.continue;
      };
      const secondHandler: hapi.Lifecycle.Method = async (request, h, err) => {
        return h.continue;
      };

      const extension: hapi.ServerExtEventsRequestObject = {
        type: 'onRequest',
        method: [firstHandler, secondHandler],
      };
      server.ext(extension);
      await server.start();
      assert.strictEqual(memoryExporter.getFinishedSpans().length, 0);

      await tracer.withSpan(rootSpan, async () => {
        const res = await server.inject({
          method: 'GET',
          url: '/test',
        });
        assert.strictEqual(res.statusCode, 200);

        rootSpan.end();
        assert.deepStrictEqual(memoryExporter.getFinishedSpans().length, 4);

        const extHandlerSpans = memoryExporter
          .getFinishedSpans()
          .filter(span => span.name === 'ext - onRequest');
        assert.notStrictEqual(extHandlerSpans, undefined);
        assert.strictEqual(extHandlerSpans.length, 2);

        assert.strictEqual(
          extHandlerSpans[0]?.attributes[AttributeNames.HAPI_TYPE],
          HapiLayerType.EXT
        );
        assert.strictEqual(
          extHandlerSpans[0]?.attributes[AttributeNames.EXT_TYPE],
          'onRequest'
        );
        assert.strictEqual(
          extHandlerSpans[1]?.attributes[AttributeNames.HAPI_TYPE],
          HapiLayerType.EXT
        );
        assert.strictEqual(
          extHandlerSpans[1]?.attributes[AttributeNames.EXT_TYPE],
          'onRequest'
        );

        const exportedRootSpan = memoryExporter
          .getFinishedSpans()
          .find(span => span.name === 'rootSpan');
        assert.notStrictEqual(exportedRootSpan, undefined);
      });
    });

    it('instruments array of ServerExtEventsRequestObject', async () => {
      const rootSpan = tracer.startSpan('rootSpan');
      const extensions: hapi.ServerExtEventsRequestObject[] = [
        {
          type: 'onRequest',
          method: async (request, h, err) => {
            return h.continue;
          },
        },
        {
          type: 'onPostAuth',
          method: async (request, h, err) => {
            return h.continue;
          },
        },
      ];
      server.ext(extensions);
      await server.start();
      assert.strictEqual(memoryExporter.getFinishedSpans().length, 0);

      await tracer.withSpan(rootSpan, async () => {
        const res = await server.inject({
          method: 'GET',
          url: '/test',
        });
        assert.strictEqual(res.statusCode, 200);

        rootSpan.end();
        assert.deepStrictEqual(memoryExporter.getFinishedSpans().length, 4);
        const firstExtHandlerSpan = memoryExporter
          .getFinishedSpans()
          .find(span => span.name === 'ext - onRequest');
        assert.notStrictEqual(firstExtHandlerSpan, undefined);
        assert.strictEqual(
          firstExtHandlerSpan?.attributes[AttributeNames.HAPI_TYPE],
          HapiLayerType.EXT
        );
        assert.strictEqual(
          firstExtHandlerSpan?.attributes[AttributeNames.EXT_TYPE],
          'onRequest'
        );

        const secondExtHandlerSpan = memoryExporter
          .getFinishedSpans()
          .find(span => span.name === 'ext - onPostAuth');
        assert.notStrictEqual(secondExtHandlerSpan, undefined);
        assert.strictEqual(
          secondExtHandlerSpan?.attributes[AttributeNames.HAPI_TYPE],
          HapiLayerType.EXT
        );
        assert.strictEqual(
          secondExtHandlerSpan?.attributes[AttributeNames.EXT_TYPE],
          'onPostAuth'
        );

        const exportedRootSpan = memoryExporter
          .getFinishedSpans()
          .find(span => span.name === 'rootSpan');
        assert.notStrictEqual(exportedRootSpan, undefined);
      });
    });

    it('does not instrument Hapi.ServerExtPointFunction handlers', async () => {
      const rootSpan = tracer.startSpan('rootSpan');
      await tracer.withSpan(rootSpan, async () => {
        server.ext('onPreStart', async (server: hapi.Server) => {
          return;
        });
        assert.strictEqual(memoryExporter.getFinishedSpans().length, 0);

        await server.start();

        const res = await server.inject({
          method: 'GET',
          url: '/test',
        });
        assert.strictEqual(res.statusCode, 200);

        rootSpan.end();
        assert.deepStrictEqual(memoryExporter.getFinishedSpans().length, 2);

        const exportedRootSpan = memoryExporter
          .getFinishedSpans()
          .find(span => span.name === 'rootSpan');
        assert.notStrictEqual(exportedRootSpan, undefined);
      });
    });

    it('should not create span if there is no parent span', async () => {
      server.ext('onRequest', async (request, h, err) => {
        return h.continue;
      });
      await server.start();
      assert.strictEqual(memoryExporter.getFinishedSpans().length, 0);

      const res = await server.inject({
        method: 'GET',
        url: '/test',
      });
      assert.strictEqual(res.statusCode, 200);
      assert.deepStrictEqual(memoryExporter.getFinishedSpans().length, 0);
    });
  });
});
