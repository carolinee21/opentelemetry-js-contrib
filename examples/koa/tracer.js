'use strict';

const opentelemetry = require('@opentelemetry/api');
const { NodeTracerProvider } = require('@opentelemetry/node');
const { SimpleSpanProcessor } = require('@opentelemetry/tracing');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { ZipkinExporter } = require('@opentelemetry/exporter-zipkin');

module.exports = (serviceName) => {
  const provider = new NodeTracerProvider({
    plugins: {
      koa: {
        enabled: true,
        path: "@opentelemetry/plugin-koa",
        enhancedDatabaseReporting: true
      },
      http: {
        enabled: true,
        path: '@opentelemetry/plugin-http',
      },
    },
  });

  
if (process.env.EXPORTER == 'jaeger') {
  provider.addSpanProcessor(new SimpleSpanProcessor(new JaegerExporter({serviceName})));
} else {
  provider.addSpanProcessor(new SimpleSpanProcessor(new ZipkinExporter({serviceName})));
}

  // Initialize the OpenTelemetry APIs to use the NodeTracerProvider bindings
  provider.register();

  return opentelemetry.trace.getTracer('koa-example');
};
