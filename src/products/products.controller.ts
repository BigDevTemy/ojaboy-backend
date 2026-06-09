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
import { ProductCategory } from '@prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('category') category?: ProductCategory,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.productsService.findAll({ search, category, limit, offset });
  }

  @Get('category/:category')
  findByCategory(@Param('category') category: ProductCategory) {
    return this.productsService.findByCategory(category);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() updateProductStatusDto: UpdateProductStatusDto,
  ) {
    return this.productsService.updateStatus(id, updateProductStatusDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
