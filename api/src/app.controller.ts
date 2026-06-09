import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  // Lightweight liveness check used by the docker-compose healthcheck.
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
