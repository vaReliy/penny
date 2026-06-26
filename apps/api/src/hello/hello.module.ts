import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { HelloController } from './hello.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [HelloController],
})
export class HelloModule {}
