import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CatalogueService } from './catalogue.service';
import {
  CreateBrandDto,
  CreateManufacturerDto,
  CreateProductOfferingDto,
  CreateProductPackageDto,
  CreateProductVariantDto,
  UpdateBrandDto,
  UpdateManufacturerDto,
  UpdateProductOfferingDto,
  UpdateProductPackageDto,
  UpdateProductVariantDto,
} from './dto/catalogue.dto';

@Controller()
export class CatalogueController {
  constructor(private readonly catalogueService: CatalogueService) {}

  @Post('products/:productId/variants')
  createVariant(
    @Param('productId') productId: string,
    @Body() dto: CreateProductVariantDto,
  ) {
    return this.catalogueService.createVariant(productId, dto);
  }

  @Get('products/:productId/variants')
  findVariants(@Param('productId') productId: string) {
    return this.catalogueService.findVariants(productId);
  }

  @Patch('product-variants/:id')
  updateVariant(@Param('id') id: string, @Body() dto: UpdateProductVariantDto) {
    return this.catalogueService.updateVariant(id, dto);
  }

  @Delete('product-variants/:id')
  removeVariant(@Param('id') id: string) {
    return this.catalogueService.deactivateVariant(id);
  }

  @Post('manufacturers')
  createManufacturer(@Body() dto: CreateManufacturerDto) {
    return this.catalogueService.createManufacturer(dto);
  }

  @Get('manufacturers')
  findManufacturers() {
    return this.catalogueService.findManufacturers();
  }

  @Patch('manufacturers/:id')
  updateManufacturer(
    @Param('id') id: string,
    @Body() dto: UpdateManufacturerDto,
  ) {
    return this.catalogueService.updateManufacturer(id, dto);
  }

  @Delete('manufacturers/:id')
  removeManufacturer(@Param('id') id: string) {
    return this.catalogueService.deactivateManufacturer(id);
  }

  @Post('brands')
  createBrand(@Body() dto: CreateBrandDto) {
    return this.catalogueService.createBrand(dto);
  }

  @Get('brands')
  findBrands() {
    return this.catalogueService.findBrands();
  }

  @Patch('brands/:id')
  updateBrand(@Param('id') id: string, @Body() dto: UpdateBrandDto) {
    return this.catalogueService.updateBrand(id, dto);
  }

  @Delete('brands/:id')
  removeBrand(@Param('id') id: string) {
    return this.catalogueService.deactivateBrand(id);
  }

  @Post('product-packages')
  createPackage(@Body() dto: CreateProductPackageDto) {
    return this.catalogueService.createPackage(dto);
  }

  @Get('product-packages')
  findPackages() {
    return this.catalogueService.findPackages();
  }

  @Patch('product-packages/:id')
  updatePackage(@Param('id') id: string, @Body() dto: UpdateProductPackageDto) {
    return this.catalogueService.updatePackage(id, dto);
  }

  @Delete('product-packages/:id')
  removePackage(@Param('id') id: string) {
    return this.catalogueService.deactivatePackage(id);
  }

  @Post('product-offerings')
  createOffering(@Body() dto: CreateProductOfferingDto) {
    return this.catalogueService.createOffering(dto);
  }

  @Get('product-offerings')
  findOfferings(
    @Query('productId') productId?: string,
    @Query('variantId') variantId?: string,
    @Query('brandId') brandId?: string,
    @Query('packageId') packageId?: string,
  ) {
    return this.catalogueService.findOfferings({
      productId,
      variantId,
      brandId,
      packageId,
    });
  }

  @Get('product-offerings/:id')
  findOffering(@Param('id') id: string) {
    return this.catalogueService.findOffering(id);
  }

  @Patch('product-offerings/:id')
  updateOffering(
    @Param('id') id: string,
    @Body() dto: UpdateProductOfferingDto,
  ) {
    return this.catalogueService.updateOffering(id, dto);
  }

  @Delete('product-offerings/:id')
  removeOffering(@Param('id') id: string) {
    return this.catalogueService.deactivateOffering(id);
  }
}
