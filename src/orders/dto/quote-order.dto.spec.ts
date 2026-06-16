import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOrderDto } from './create-order.dto';
import { QuoteOrderDto } from './quote-order.dto';

describe('QuoteOrderDto delivery address', () => {
  const basePayload = {
    items: [
      {
        buyPriceId: '00000000-0000-0000-0000-000000000000',
        quantity: 1,
      },
    ],
  };

  it.each([undefined, null, {}, { formattedAddress: '   ', locality: '' }])(
    'treats an empty delivery address as omitted',
    async (deliveryAddress) => {
      const dto = plainToInstance(QuoteOrderDto, {
        ...basePayload,
        deliveryAddress,
      });

      expect(dto.deliveryAddress).toBeUndefined();
      await expect(validate(dto)).resolves.toHaveLength(0);
    },
  );

  it('rejects a partially supplied delivery address', async () => {
    const dto = plainToInstance(QuoteOrderDto, {
      ...basePayload,
      deliveryAddress: {
        formattedAddress: '12 Herbert Macaulay Way, Yaba',
      },
    });
    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'deliveryAddress')).toBe(
      true,
    );
  });

  it('accepts a complete Google Maps delivery address', async () => {
    const deliveryAddress = {
      formattedAddress: '12 Herbert Macaulay Way, Yaba, Lagos, Nigeria',
      addressLine1: '12 Herbert Macaulay Way',
      locality: 'Yaba',
      state: 'Lagos',
      country: 'Nigeria',
      countryCode: 'NG',
      googlePlaceId: 'google-place-id',
      latitude: 6.5158,
      longitude: 3.389,
    };
    const dto = plainToInstance(QuoteOrderDto, {
      ...basePayload,
      deliveryAddress,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.deliveryAddress).toEqual(
      expect.objectContaining({
        googlePlaceId: 'google-place-id',
        locality: 'Yaba',
      }),
    );
  });

  it('does not require recipient details for a temporary quote address', async () => {
    const dto = plainToInstance(QuoteOrderDto, {
      ...basePayload,
      deliveryAddress: {
        formattedAddress: '12 Herbert Macaulay Way, Yaba, Lagos, Nigeria',
        addressLine1: '12 Herbert Macaulay Way',
        locality: 'Yaba',
        state: 'Lagos',
        country: 'Nigeria',
        googlePlaceId: 'google-place-id',
        latitude: 6.5158,
        longitude: 3.389,
      },
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('allows recipient details in a quote address without requiring them', async () => {
    const dto = plainToInstance(QuoteOrderDto, {
      ...basePayload,
      deliveryAddress: {
        recipientName: 'Vincent Doe',
        phoneNumber: '+2348012345678',
        formattedAddress: '12 Herbert Macaulay Way, Yaba, Lagos, Nigeria',
        addressLine1: '12 Herbert Macaulay Way',
        locality: 'Yaba',
        state: 'Lagos',
        country: 'Nigeria',
        googlePlaceId: 'google-place-id',
        latitude: 6.5158,
        longitude: 3.389,
      },
    });

    await expect(
      validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).resolves.toHaveLength(0);
  });

  it('treats a blank quote phone number as omitted', async () => {
    const dto = plainToInstance(QuoteOrderDto, {
      ...basePayload,
      deliveryAddress: {
        recipientName: 'Geoffrey Odewumi',
        phoneNumber: '',
        formattedAddress: 'Obafemi Awolowo Way, Alausa, Lagos',
        addressLine1: 'Obafemi Awolowo Way',
        neighborhood: 'Oregun',
        locality: 'Ojodu',
        localGovernmentArea: 'Ikeja',
        state: 'Lagos',
        country: 'Nigeria',
        googlePlaceId: 'google-place-id',
        latitude: 6.6143564,
        longitude: 3.3581327,
      },
    });

    await expect(
      validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).resolves.toHaveLength(0);
    expect(dto.deliveryAddress?.phoneNumber).toBeUndefined();
  });

  it('requires recipient details when the same address creates an order', async () => {
    const dto = plainToInstance(CreateOrderDto, {
      ...basePayload,
      deliveryAddress: {
        formattedAddress: '12 Herbert Macaulay Way, Yaba, Lagos, Nigeria',
        addressLine1: '12 Herbert Macaulay Way',
        locality: 'Yaba',
        state: 'Lagos',
        country: 'Nigeria',
        googlePlaceId: 'google-place-id',
        latitude: 6.5158,
        longitude: 3.389,
      },
    });
    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'deliveryAddress')).toBe(
      true,
    );
  });
});
