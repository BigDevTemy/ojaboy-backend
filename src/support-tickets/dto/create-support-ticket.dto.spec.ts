import { SupportTicketCategory } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSupportTicketDto } from './create-support-ticket.dto';

describe('CreateSupportTicketDto', () => {
  const validTicket = {
    subject: 'General support request',
    category: SupportTicketCategory.general,
    message: 'I need help with my account.',
  };

  it('accepts a ticket with no orderId', async () => {
    const dto = plainToInstance(CreateSupportTicketDto, validTicket);

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.orderId).toBeUndefined();
  });

  it('treats an empty multipart orderId as omitted', async () => {
    const dto = plainToInstance(CreateSupportTicketDto, {
      ...validTicket,
      orderId: '   ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.orderId).toBeUndefined();
  });

  it('still rejects a non-empty invalid orderId', async () => {
    const dto = plainToInstance(CreateSupportTicketDto, {
      ...validTicket,
      orderId: 'not-an-order-uuid',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'orderId')).toBe(true);
  });
});
