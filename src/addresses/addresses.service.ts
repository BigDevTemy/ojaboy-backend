import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AddressZoneStatus,
  DeliveryArea,
  DeliveryZone,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';

type DeliveryAreaWithZone = DeliveryArea & {
  deliveryZone: DeliveryZone;
};

type ZoneResolution = {
  status: AddressZoneStatus;
  deliveryArea?: DeliveryAreaWithZone;
  detail: string;
};

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateAddressDto) {
    const resolution = await this.resolveDeliveryZone(dto);
    const address = await this.prisma.$transaction(async (tx) => {
      const isSupported = resolution.status === AddressZoneStatus.supported;
      const isDefault = Boolean(dto.isDefault && isSupported);

      if (isDefault) {
        await tx.userAddress.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.userAddress.create({
        data: {
          userId,
          deliveryZoneId: resolution.deliveryArea?.deliveryZoneId,
          label: this.clean(dto.label),
          recipientName: dto.recipientName.trim(),
          phoneNumber: dto.phoneNumber.trim(),
          formattedAddress: dto.formattedAddress.trim(),
          addressLine1: dto.addressLine1.trim(),
          addressLine2: this.clean(dto.addressLine2),
          streetNumber: this.clean(dto.streetNumber),
          route: this.clean(dto.route),
          neighborhood: this.clean(dto.neighborhood),
          sublocality: this.clean(dto.sublocality),
          locality: this.clean(dto.locality),
          localGovernmentArea: this.clean(dto.localGovernmentArea),
          administrativeArea: this.clean(dto.administrativeArea),
          state: this.clean(dto.state),
          country: dto.country.trim(),
          countryCode: dto.countryCode?.trim().toUpperCase(),
          postalCode: this.clean(dto.postalCode),
          googlePlaceId: dto.googlePlaceId.trim(),
          latitude: dto.latitude,
          longitude: dto.longitude,
          googleAddressData: dto.googleAddressData as
            | Prisma.InputJsonValue
            | undefined,
          zoneStatus: resolution.status,
          zoneResolutionDetail: resolution.detail,
          isDefault,
        },
        include: { deliveryZone: true },
      });
    });

    if (resolution.status !== AddressZoneStatus.supported) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code:
          resolution.status === AddressZoneStatus.zone_inactive
            ? 'DELIVERY_ZONE_INACTIVE'
            : 'ADDRESS_OUTSIDE_DELIVERY_COVERAGE',
        message: resolution.detail,
        addressId: address.id,
        zoneStatus: resolution.status,
        deliveryZoneId: address.deliveryZoneId,
      });
    }

    return {
      message: 'Address saved and assigned to a delivery zone.',
      address,
    };
  }

  async findAll(userId: string) {
    const addresses = await this.prisma.userAddress.findMany({
      where: { userId },
      include: { deliveryZone: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return { data: addresses };
  }

  async findOne(userId: string, id: string) {
    const address = await this.prisma.userAddress.findFirst({
      where: { id, userId },
      include: { deliveryZone: true },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    return { address };
  }

  async remove(userId: string, id: string) {
    const result = await this.prisma.userAddress.deleteMany({
      where: { id, userId },
    });

    if (result.count === 0) {
      throw new NotFoundException('Address not found');
    }

    return { message: 'Address deleted successfully.' };
  }

  private async resolveDeliveryZone(
    dto: CreateAddressDto,
  ): Promise<ZoneResolution> {
    const candidates = this.addressCandidates(dto);
    const deliveryAreas = await this.prisma.deliveryArea.findMany({
      include: { deliveryZone: true },
    });
    const deliveryArea = deliveryAreas.find((area) =>
      this.areaMatches(area, candidates, dto),
    );

    if (!deliveryArea) {
      return {
        status: AddressZoneStatus.unsupported,
        detail: 'This address is outside the delivery areas currently covered.',
      };
    }

    if (!deliveryArea.isActive || !deliveryArea.deliveryZone.isActive) {
      return {
        status: AddressZoneStatus.zone_inactive,
        deliveryArea,
        detail: `Delivery is currently unavailable in ${deliveryArea.name}.`,
      };
    }

    return {
      status: AddressZoneStatus.supported,
      deliveryArea,
      detail: `Assigned through the ${deliveryArea.name} delivery area.`,
    };
  }

  private addressCandidates(dto: CreateAddressDto): Set<string> {
    return new Set(
      [
        dto.neighborhood,
        dto.sublocality,
        dto.localGovernmentArea,
        dto.locality,
        dto.administrativeArea,
      ]
        .filter((value): value is string => Boolean(value?.trim()))
        .map((value) => this.normalize(value)),
    );
  }

  private areaMatches(
    area: DeliveryAreaWithZone,
    candidates: Set<string>,
    dto: CreateAddressDto,
  ): boolean {
    const names = [
      area.normalizedName,
      ...area.aliases.map((alias) => this.normalize(alias)),
    ];
    const nameMatches = names.some((name) => candidates.has(name));
    const stateMatches =
      !area.state ||
      !dto.state ||
      this.normalize(area.state) === this.normalize(dto.state);
    const countryMatches =
      !area.country ||
      this.normalize(area.country) === this.normalize(dto.country);

    return nameMatches && stateMatches && countryMatches;
  }

  private normalize(value: string): string {
    return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ');
  }

  private clean(value?: string): string | undefined {
    const cleaned = value?.trim();
    return cleaned || undefined;
  }
}
