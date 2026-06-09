import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Allow the Vite dev server (and any other local origin) to call the API
  // directly. In docker-compose the client also proxies /api -> this service.
  app.enableCors();

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`Blueprint analytics API listening on http://0.0.0.0:${port}`);
}

bootstrap();
