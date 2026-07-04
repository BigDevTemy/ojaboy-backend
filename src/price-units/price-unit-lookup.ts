import { PackageType, PriceUnit } from '@prisma/client';

/**
 * Normalize an arbitrary unit-ish string (package name, alias, code) into the
 * canonical snake_case form used for matching. Mirrors the normalization the
 * services previously did inline.
 */
export function normalizeUnitKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/**
 * An in-memory, synchronous view over the price_units table. Built once from a
 * list of PriceUnit rows and handed to callers that need to resolve units while
 * iterating (e.g. bulk parsing) without awaiting per lookup.
 */
export class PriceUnitLookup {
  private readonly byCode = new Map<string, PriceUnit>();
  private readonly byId = new Map<string, PriceUnit>();
  private readonly byAlias = new Map<string, PriceUnit>();
  private readonly byPackageType = new Map<PackageType, PriceUnit>();

  constructor(private readonly units: PriceUnit[]) {
    for (const unit of units) {
      this.byId.set(unit.id, unit);
      this.byCode.set(normalizeUnitKey(unit.code), unit);

      for (const alias of unit.aliases ?? []) {
        this.byAlias.set(normalizeUnitKey(alias), unit);
        this.byAlias.set(alias.trim().toLowerCase(), unit);
      }

      if (unit.packageType && !this.byPackageType.has(unit.packageType)) {
        this.byPackageType.set(unit.packageType, unit);
      }
    }
  }

  all(): PriceUnit[] {
    return this.units;
  }

  activeCodes(): string[] {
    return this.units.filter((unit) => unit.isActive).map((unit) => unit.code);
  }

  getById(id: string): PriceUnit | undefined {
    return this.byId.get(id);
  }

  getByCode(code: string): PriceUnit | undefined {
    return this.byCode.get(normalizeUnitKey(code));
  }

  isValidCode(code: string): boolean {
    const unit = this.getByCode(code);
    return Boolean(unit && unit.isActive);
  }

  /** Resolve a free-form name/alias/code to a unit. */
  resolveByName(name: string): PriceUnit | undefined {
    const normalized = normalizeUnitKey(name);
    return (
      this.byCode.get(normalized) ??
      this.byAlias.get(normalized) ??
      this.byAlias.get(name.trim().toLowerCase())
    );
  }

  getByPackageType(packageType: PackageType): PriceUnit | undefined {
    return this.byPackageType.get(packageType);
  }

  /**
   * Derive the unit for a product package: first by matching its name against
   * unit codes/aliases, then by falling back to the package type mapping.
   */
  resolveFromPackage(productPackage: {
    name: string;
    packageType: PackageType;
  }): PriceUnit | undefined {
    return (
      this.resolveByName(productPackage.name) ??
      this.getByPackageType(productPackage.packageType)
    );
  }

  /** Human-friendly rendering of a unit code (e.g. "big_basket" -> "big basket"). */
  display(code: string): string {
    return this.getByCode(code)?.label ?? code.replace(/_/g, ' ');
  }
}
