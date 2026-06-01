import { Body, Controller, Post } from '@nestjs/common';
import { AgentChatboxService } from './agent-chatbox.service';
import { AskAgentChatboxDto } from './dto/ask-agent-chatbox.dto';

@Controller('agent-chatbox')
export class AgentChatboxController {
  constructor(private readonly agentChatboxService: AgentChatboxService) {}

  @Post('ask')
  ask(@Body() askAgentChatboxDto: AskAgentChatboxDto) {
    return this.agentChatboxService.ask(askAgentChatboxDto);
  }
}
