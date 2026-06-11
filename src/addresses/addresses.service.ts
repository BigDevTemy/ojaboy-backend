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
import { AddressDetailsDto } from './dto/address-details.dto';
import { CreateAddressDto } from './dto/create-address.dto';

type DeliveryAreaWithZone = DeliveryArea & {
  deliveryZone: DeliveryZone;
};

type ZoneResolution = {
  status: AddressZoneStatus;
  deliveryArea?: DeliveryAreaWithZone;
  detail: string;
};

type AddressLocation = {
  neighborhood?: string | null;
  sublocality?: string | null;
  localGovernmentArea?: string | null;
  locality?: string | null;
  administrativeArea?: string | null;
  state?: string | null;
  country: string;
};

type DatabaseClient = Prisma.TransactionClient | PrismaService;

export type ResolvedDeliveryAddress = {
  id?: string;
  deliveryZoneId: string;
  label: string | null;
  recipientName: string;
  phoneNumber: string;
  formattedAddress: string;
  googlePlaceId: string;
  latitude: Prisma.Decimal | number;
  longitude: Prisma.Decimal | number;
  deliveryZone: DeliveryZone;
};

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateAddressDto) {
    const resolution = await this.resolveDeliveryZone(dto, this.prisma);
    const address = await this.prisma.$transaction(async (tx) => {
      const isSupported = resolution.status === AddressZoneStatus.supported;
      const existingDefault = await tx.userAddress.findFirst({
        where: { userId, isDefault: true },
        select: { id: true },
      });
      const isDefault = Boolean(
        isSupported && (dto.isDefault || !existingDefault),
      );

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

  async getOrCreateOrderAddress(
    userId: string,
    dto: AddressDetailsDto,
    db: DatabaseClient = this.prisma,
  ) {
    const resolution = await this.resolveDeliveryZone(dto, db);
    const existingAddress = await db.userAddress.findFirst({
      where: {
        userId,
        googlePlaceId: dto.googlePlaceId.trim(),
        recipientName: dto.recipientName.trim(),
        phoneNumber: dto.phoneNumber.trim(),
        formattedAddress: dto.formattedAddress.trim(),
      },
      include: { deliveryZone: true },
    });

    const address = existingAddress
      ? await db.userAddress.update({
          where: { id: existingAddress.id },
          data: this.addressData(dto, resolution),
          include: { deliveryZone: true },
        })
      : await db.userAddress.create({
          data: {
            userId,
            ...this.addressData(dto, resolution),
            isDefault: false,
          },
          include: { deliveryZone: true },
        });

    if (
      resolution.status !== AddressZoneStatus.supported ||
      !address.deliveryZoneId ||
      !address.deliveryZone
    ) {
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

    return address as typeof address & {
      deliveryZoneId: string;
      deliveryZone: DeliveryZone;
    };
  }

  async resolveOrderAddress(
    dto: AddressDetailsDto,
    db: DatabaseClient = this.prisma,
  ): Promise<ResolvedDeliveryAddress> {
    const resolution = await this.resolveDeliveryZone(dto, db);

    if (
      resolution.status !== AddressZoneStatus.supported ||
      !resolution.deliveryArea
    ) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code:
          resolution.status === AddressZoneStatus.zone_inactive
            ? 'DELIVERY_ZONE_INACTIVE'
            : 'ADDRESS_OUTSIDE_DELIVERY_COVERAGE',
        message: resolution.detail,
        zoneStatus: resolution.status,
        deliveryZoneId: resolution.deliveryArea?.deliveryZoneId,
      });
    }

    return {
      deliveryZoneId: resolution.deliveryArea.deliveryZoneId,
      label: this.clean(dto.label) ?? null,
      recipientName: dto.recipientName.trim(),
      phoneNumber: dto.phoneNumber.trim(),
      formattedAddress: dto.formattedAddress.trim(),
      googlePlaceId: dto.googlePlaceId.trim(),
      latitude: dto.latitude,
      longitude: dto.longitude,
      deliveryZone: resolution.deliveryArea.deliveryZone,
    };
  }

  async getValidatedDefaultAddress(
    userId: string,
    db: DatabaseClient = this.prisma,
  ) {
    const address = await db.userAddress.findFirst({
      where: { userId, isDefault: true },
      include: { deliveryZone: true },
    });

    if (!address) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: 'DEFAULT_DELIVERY_ADDRESS_REQUIRED',
        message:
          'Add a supported delivery address and set it as your default before requesting an order quote.',
      });
    }

    if (
      address.zoneStatus !== AddressZoneStatus.supported ||
      !address.deliveryZoneId ||
      !address.deliveryZone
    ) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: 'DEFAULT_ADDRESS_NOT_DELIVERABLE',
        message:
          'Your default address is not assigned to a supported delivery zone. Update the address before requesting a quote.',
        addressId: address.id,
        deliveryZoneId: address.deliveryZoneId,
        zoneStatus: address.zoneStatus,
      });
    }

    if (!address.deliveryZone.isActive) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: 'DELIVERY_ZONE_INACTIVE',
        message: `Delivery is currently unavailable in ${address.deliveryZone.name}.`,
        addressId: address.id,
        deliveryZoneId: address.deliveryZoneId,
      });
    }

    const candidates = this.addressCandidates(address);
    const deliveryAreas = await db.deliveryArea.findMany({
      where: {
        deliveryZoneId: address.deliveryZoneId,
        isActive: true,
      },
      include: { deliveryZone: true },
    });
    const matchingArea = deliveryAreas.find((area) =>
      this.areaMatches(area, candidates, address),
    );

    if (!matchingArea) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: 'ADDRESS_DELIVERY_ZONE_MISMATCH',
        message:
          'Your default address no longer matches its assigned delivery zone. Update the address so delivery coverage can be resolved again.',
        addressId: address.id,
        deliveryZoneId: address.deliveryZoneId,
      });
    }

    return address as typeof address & {
      deliveryZoneId: string;
      deliveryZone: DeliveryZone;
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
    const deleted = await this.prisma.$transaction(async (tx) => {
      const address = await tx.userAddress.findFirst({
        where: { id, userId },
      });

      if (!address) {
        throw new NotFoundException('Address not found');
      }

      await tx.userAddress.delete({ where: { id: address.id } });

      if (address.isDefault) {
        const replacement = await tx.userAddress.findFirst({
          where: {
            userId,
            zoneStatus: AddressZoneStatus.supported,
            deliveryZoneId: { not: null },
          },
          orderBy: { createdAt: 'desc' },
        });

        if (replacement) {
          await tx.userAddress.update({
            where: { id: replacement.id },
            data: { isDefault: true },
          });
        }
      }

      return address;
    });

    return {
      message: 'Address deleted successfully.',
      deletedAddressId: deleted.id,
    };
  }

  async setDefault(userId: string, id: string) {
    const address = await this.prisma.userAddress.findFirst({
      where: { id, userId },
      include: { deliveryZone: true },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    if (
      address.zoneStatus !== AddressZoneStatus.supported ||
      !address.deliveryZoneId ||
      !address.deliveryZone?.isActive
    ) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: 'ADDRESS_NOT_ELIGIBLE_AS_DEFAULT',
        message:
          'Only an address in an active supported delivery zone can be set as default.',
        addressId: address.id,
      });
    }

    const updatedAddress = await this.prisma.$transaction(async (tx) => {
      await tx.userAddress.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });

      return tx.userAddress.update({
        where: { id: address.id },
        data: { isDefault: true },
        include: { deliveryZone: true },
      });
    });

    return {
      message: 'Default delivery address updated successfully.',
      address: updatedAddress,
    };
  }

  private async resolveDeliveryZone(
    address: AddressDetailsDto,
    db: DatabaseClient,
  ): Promise<ZoneResolution> {
    const candidates = this.addressCandidates(address);
    const deliveryAreas = await db.deliveryArea.findMany({
      include: { deliveryZone: true },
    });
    const deliveryArea = deliveryAreas.find((area) =>
      this.areaMatches(area, candidates, address),
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

  private addressData(dto: AddressDetailsDto, resolution: ZoneResolution) {
    return {
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
    };
  }

  private addressCandidates(address: AddressLocation): Set<string> {
    return new Set(
      [
        address.neighborhood,
        address.sublocality,
        address.localGovernmentArea,
        address.locality,
        address.administrativeArea,
      ]
        .filter((value): value is string => Boolean(value?.trim()))
        .map((value) => this.normalize(value)),
    );
  }

  private areaMatches(
    area: DeliveryAreaWithZone,
    candidates: Set<string>,
    address: AddressLocation,
  ): boolean {
    const names = [
      area.normalizedName,
      ...area.aliases.map((alias) => this.normalize(alias)),
    ];
    const nameMatches = names.some((name) => candidates.has(name));
    const stateMatches =
      !area.state ||
      !address.state ||
      this.normalize(area.state) === this.normalize(address.state);
    const countryMatches =
      !area.country ||
      this.normalize(area.country) === this.normalize(address.country);

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
