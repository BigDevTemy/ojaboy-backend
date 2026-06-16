import { AddressZoneStatus } from '@prisma/client';
import { AddressesService } from './addresses.service';

describe('AddressesService order address resolution', () => {
  const address = {
    formattedAddress: '12 Herbert Macaulay Way, Yaba, Lagos, Nigeria',
    addressLine1: '12 Herbert Macaulay Way',
    locality: 'Yaba',
    state: 'Lagos',
    country: 'Nigeria',
    googlePlaceId: 'google-place-id',
    latitude: 6.5158,
    longitude: 3.389,
  };

  it('resolves a supplied quote address without saving it', async () => {
    const deliveryZone = {
      id: 'zone-id',
      name: 'Yaba',
      isActive: true,
    };
    const prisma = {
      deliveryArea: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'area-id',
            deliveryZoneId: 'zone-id',
            name: 'Yaba',
            normalizedName: 'yaba',
            aliases: ['akoka'],
            state: 'Lagos',
            country: 'Nigeria',
            isActive: true,
            deliveryZone,
          },
        ]),
      },
      userAddress: {
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const service = new AddressesService(prisma as never);

    await expect(service.resolveOrderAddress(address)).resolves.toEqual(
      expect.objectContaining({
        deliveryZoneId: 'zone-id',
        deliveryZone,
        googlePlaceId: 'google-place-id',
        recipientName: null,
        phoneNumber: null,
      }),
    );
    expect(prisma.userAddress.create).not.toHaveBeenCalled();
    expect(prisma.userAddress.update).not.toHaveBeenCalled();
  });

  it('stops a quote when the supplied address is outside coverage', async () => {
    const service = new AddressesService({
      deliveryArea: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as never);

    await expect(service.resolveOrderAddress(address)).rejects.toMatchObject({
      response: {
        statusCode: 422,
        code: 'ADDRESS_OUTSIDE_DELIVERY_COVERAGE',
        zoneStatus: AddressZoneStatus.unsupported,
      },
    });
  });
});
