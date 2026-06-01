import { Injectable } from '@nestjs/common';
import { AskAgentChatboxDto } from './dto/ask-agent-chatbox.dto';

@Injectable()
export class AgentChatboxService {
  ask(askAgentChatboxDto: AskAgentChatboxDto) {
    return {
      question: askAgentChatboxDto.question,
      answer:
        'Agent chatbox is ready. AI response handling will be added here.',
    };
  }
}
