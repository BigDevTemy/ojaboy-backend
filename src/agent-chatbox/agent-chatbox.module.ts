import { Module } from '@nestjs/common';
import { AgentChatboxController } from './agent-chatbox.controller';
import { AgentChatboxService } from './agent-chatbox.service';

@Module({
  controllers: [AgentChatboxController],
  providers: [AgentChatboxService],
})
export class AgentChatboxModule {}
